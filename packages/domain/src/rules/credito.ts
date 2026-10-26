import type { Credito, EstadoHogar, Fecha, Id, Origen, Pesos } from '../model';
import { ReglaError, clonar, mesDe, nuevoId } from './base';

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
