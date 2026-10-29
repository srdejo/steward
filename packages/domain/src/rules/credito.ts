import type { Credito, EstadoHogar, Fecha, Id, ItemPlan, Origen, Pesos } from '../model';
import { ReglaError, clonar, mesDe, nuevoId } from './base';
import { escenarioPrincipal, planDe } from './consultas';

/** Numero de cuotas (fraccionario) para pagar `saldo` con `cuota` a la tasa mensual. null = la cuota no alcanza ni el interes. */
function cuotasExactas(saldo: Pesos, cuota: Pesos, tasaEM: number): number | null {
  if (saldo <= 0) return 0;
  const r = tasaEM / 100;
  if (r === 0) return saldo / cuota;
  const x = 1 - (r * saldo) / cuota;
  if (x <= 0) return null;
  return -Math.log(x) / Math.log(1 + r);
}

export function cuotasRestantes(credito: Pick<Credito, 'saldo' | 'cuota' | 'tasaEM'>): number | null {
  const n = cuotasExactas(credito.saldo, credito.cuota, credito.tasaEM);
  return n === null ? null : Math.round(n);
}

export function porcentajePagado(credito: Pick<Credito, 'saldo' | 'totalOriginal'>): number {
  if (credito.totalOriginal <= 0) return 0;
  return Math.round(((credito.totalOriginal - credito.saldo) / credito.totalOriginal) * 100);
}

/** Simulador "¿Y si abonas extra?": cuotas e intereses ahorrados, aproximados (≈). */
export function simularAbono(credito: Pick<Credito, 'saldo' | 'cuota' | 'tasaEM'>, abono: Pesos): { cuotasMenos: number; interesesMenos: Pesos } | null {
  const antes = cuotasExactas(credito.saldo, credito.cuota, credito.tasaEM);
  const despues = cuotasExactas(Math.max(0, credito.saldo - abono), credito.cuota, credito.tasaEM);
  if (antes === null || despues === null || abono <= 0) return null;
  const interesAntes = antes * credito.cuota - credito.saldo;
  const interesDespues = despues * credito.cuota - Math.max(0, credito.saldo - abono);
  return {
    cuotasMenos: Math.round(antes - despues),
    // Se redondea a $100.000: es una aproximacion y asi se lee ("≈ $1.200.000").
    interesesMenos: Math.round((interesAntes - interesDespues) / 100_000) * 100_000,
  };
}

function creditoDe(s: EstadoHogar, id: Id): Credito {
  const c = s.creditos.find((x) => x.id === id);
  if (!c) throw new ReglaError('NO_EXISTE', 'No existe el crédito');
  return c;
}

export function actualizarSaldoCredito(estado: EstadoHogar, datos: { creditoId: Id; saldo: Pesos; fecha: Fecha }): EstadoHogar {
  if (datos.saldo < 0) throw new ReglaError('MONTO_INVALIDO', 'El saldo no puede ser negativo');
  const s = clonar(estado);
  const c = creditoDe(s, datos.creditoId);
  c.saldo = datos.saldo;
  c.saldoActualizadoEn = datos.fecha;
  return s;
}

/** Abono a capital fuera de la cuota. */
export function registrarAbono(estado: EstadoHogar, datos: { creditoId: Id; monto: Pesos; fecha: Fecha; usuarioId: Id; origen: Origen }): EstadoHogar {
  if (!(datos.monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El abono debe ser mayor que cero');
  const s = clonar(estado);
  const c = creditoDe(s, datos.creditoId);
  if (datos.monto > c.saldo) throw new ReglaError('ABONO_MAYOR', 'El abono es mayor que el saldo');
  c.saldo -= datos.monto;
  c.saldoActualizadoEn = datos.fecha;
  c.pagos.unshift({ fecha: datos.fecha, monto: datos.monto, tipo: 'ABONO' });
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: 'ABONO_CREDITO', ref: mesDe(datos.fecha), monto: datos.monto, fecha: datos.fecha, usuarioId: datos.usuarioId,
    creadoPor: datos.usuarioId, origen: datos.origen, nota: '', itemId: null, ingresoFijoId: null, bruto: null,
    aplicaDiezmo: false, diezmoDe: [], cuentaDestinoId: null, creditoId: c.id,
  });
  return s;
}

export interface DatosCredito {
  nombre: string;
  entidad: string;
  saldo: Pesos;
  totalOriginal: Pesos;
  cuota: Pesos;
  tasaEM: number;
  diaPago: number;
}

/** Item de la cuota de un credito, enlazado a el (spec steward-plan-mes, design D5 de backend-cuentas-creditos). */
function itemCuota(s: EstadoHogar, credito: Credito): ItemPlan {
  const categoria = s.categorias.find((c) => c.tipo === 'CREDITO') ?? s.categorias[0];
  if (!categoria) throw new ReglaError('NO_EXISTE', 'El hogar no tiene categorías');
  return {
    id: nuevoId(s, 'item'), categoriaId: categoria.id, nombre: `Cuota ${credito.nombre.toLowerCase()}`, monto: credito.cuota,
    diaVence: credito.diaPago, tipo: 'CREDITO', cuota: null, creditoId: credito.id,
  };
}

/** Agrega a `items` la cuota de cada credito con saldo que todavia no tenga item enlazado. */
export function cuotasDeCreditos(s: EstadoHogar, items: ItemPlan[]): ItemPlan[] {
  const enlazados = new Set(items.map((i) => i.creditoId).filter((id) => id !== null));
  return [...items, ...s.creditos.filter((c) => c.saldo > 0 && !enlazados.has(c.id)).map((c) => itemCuota(s, c))];
}

/** "+ Agregar credito": su cuota entra a la Opcion A del mes en curso si tiene plan y no esta cerrado. */
export function agregarCredito(estado: EstadoHogar, datos: DatosCredito & { fecha: Fecha }): EstadoHogar {
  const nombre = datos.nombre.trim();
  const entidad = datos.entidad.trim();
  if (!nombre || nombre.length > 40 || entidad.length > 40) throw new ReglaError('NOMBRE_REQUERIDO', 'El crédito necesita un nombre de hasta 40 caracteres');
  if (!(datos.saldo >= 0) || !(datos.cuota > 0) || !(datos.totalOriginal > 0) || datos.totalOriginal < datos.saldo) {
    throw new ReglaError('MONTO_INVALIDO', 'Revisa el saldo, el total original y la cuota');
  }
  if (!(datos.tasaEM >= 0 && datos.tasaEM <= 10)) throw new ReglaError('MONTO_INVALIDO', 'La tasa efectiva mensual va de 0 a 10 %');
  if (!Number.isInteger(datos.diaPago) || datos.diaPago < 1 || datos.diaPago > 31) throw new ReglaError('DIA_INVALIDO', 'El día de pago va de 1 a 31');
  const s = clonar(estado);
  const credito: Credito = {
    id: nuevoId(s, 'cred'), nombre, entidad, saldo: datos.saldo, saldoActualizadoEn: datos.fecha, cuota: datos.cuota,
    tasaEM: datos.tasaEM, diaPago: datos.diaPago, totalOriginal: datos.totalOriginal, pagos: [],
  };
  s.creditos.push(credito);
  const plan = planDe(s, mesDe(datos.fecha));
  const principal = plan && plan.estado !== 'CERRADO' ? escenarioPrincipal(plan) : null;
  if (principal) principal.items.push(itemCuota(s, credito));
  return s;
}
