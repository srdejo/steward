import type { Credito, EstadoHogar, Fecha, Id, ItemPlan, MesRef, MetodoCredito, Movimiento, Origen, Pesos } from '../model';
import { ReglaError, clonar, compararMes, fechaEnMes, mesDe, mismoMes, nuevoId, sumar, sumarMeses } from './base';
import { escenarioPrincipal, planDe } from './consultas';

// --- Calculos (design D3 de tarjetas-y-creditos) ---------------------------------------------------------------------

/** Tasa efectiva mensual equivalente a una efectiva anual, en porcentaje con dos decimales (12 % EA = 0,95 % EM). */
export function emDeEa(ea: number): number {
  return Math.round((Math.pow(1 + ea / 100, 1 / 12) - 1) * 10_000) / 100;
}

/** Cuota fija (sistema frances) de `valor` en `n` cuotas a la tasa mensual `em` (porcentaje). */
export function cuotaFija(valor: Pesos, n: number, em: number): Pesos {
  if (n <= 0) return 0;
  const r = em / 100;
  if (r === 0) return Math.round(valor / n);
  return Math.round((valor * r) / (1 - Math.pow(1 + r, -n)));
}

/** Una cuota de la tabla: su numero, lo que va a interes y a capital, y el saldo que queda. */
export interface FilaTabla {
  k: number;
  interes: Pesos;
  capital: Pesos;
  saldo: Pesos;
}

/** Amortiza `saldo` con `cuota` a la tasa `em`, desde la cuota `desde`, hasta `meses` filas, `hasta` (numero de cuota) o saldo cero. */
function amortizar(saldo: Pesos, cuota: Pesos, em: number, desde: number, meses: number, hasta: number | null): FilaTabla[] {
  const filas: FilaTabla[] = [];
  let s = saldo;
  for (let k = desde; filas.length < meses && s > 0 && (hasta === null || k <= hasta); k++) {
    const interes = Math.round((s * em) / 100);
    const ultima = hasta !== null && k === hasta;
    const capital = ultima ? s : Math.min(Math.max(0, cuota - interes), s);
    if (capital <= 0) break;
    s -= capital;
    filas.push({ k, interes, capital, saldo: s });
  }
  return filas;
}

/** La tabla completa del plan de pagos, desde el valor financiado. */
function tablaPlan(c: Pick<Credito, 'valorFinanciado' | 'numeroCuotas' | 'tasaEM' | 'cuota'>): FilaTabla[] {
  const n = c.numeroCuotas ?? 0;
  return amortizar(c.valorFinanciado ?? 0, c.cuota, c.tasaEM, 1, n, n);
}

/** Saldo del plan de pagos despues de `pagadas` cuotas. */
export function saldoPlan(c: Pick<Credito, 'valorFinanciado' | 'numeroCuotas' | 'tasaEM' | 'cuota'>, pagadas: number): Pesos {
  if (pagadas <= 0) return c.valorFinanciado ?? 0;
  return tablaPlan(c)[pagadas - 1]?.saldo ?? 0;
}

/**
 * Las proximas cuotas desde el saldo de hoy (design D3): con la tasa, amortizacion; con el plan de pagos, su tabla (o,
 * si el saldo se corrigio con el extracto y no coincide, amortizacion desde ese saldo); a mano, ninguna.
 */
export function tablaCredito(c: Credito, meses: number): FilaTabla[] {
  if (c.metodo === 'MANUAL') return [];
  if (c.metodo === 'PLAN') {
    const n = c.numeroCuotas ?? 0;
    if (Math.abs(saldoPlan(c, c.cuotasPagadas) - c.saldo) <= 1) return tablaPlan(c).slice(c.cuotasPagadas, c.cuotasPagadas + meses);
    return amortizar(c.saldo, c.cuota, c.tasaEM, c.cuotasPagadas + 1, meses, n);
  }
  return amortizar(c.saldo, c.cuota, c.tasaEM, c.cuotasPagadas + 1, meses, null);
}

/** Numero de cuotas (fraccionario) para pagar `saldo` con `cuota` a la tasa mensual. null = la cuota no alcanza ni el interes. */
function cuotasExactas(saldo: Pesos, cuota: Pesos, tasaEM: number): number | null {
  if (saldo <= 0) return 0;
  const r = tasaEM / 100;
  if (r === 0) return saldo / cuota;
  const x = 1 - (r * saldo) / cuota;
  if (x <= 0) return null;
  return -Math.log(x) / Math.log(1 + r);
}

export function cuotasRestantes(credito: Pick<Credito, 'saldo' | 'cuota' | 'tasaEM'> & Partial<Pick<Credito, 'metodo' | 'numeroCuotas' | 'cuotasPagadas'>>): number | null {
  if (credito.metodo === 'PLAN' && credito.numeroCuotas) return Math.max(0, credito.numeroCuotas - (credito.cuotasPagadas ?? 0));
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

// --- Vistas ----------------------------------------------------------------------------------------------------------

/** Si la cuota del mes de `hoy` ya se pago. */
function cuotaPagadaEn(c: Credito, ref: MesRef): boolean {
  return c.pagos.some((p) => p.tipo === 'CUOTA' && mismoMes(mesDe(p.fecha), ref));
}

/** A mano: el dia de pago del mes ya paso y el saldo no se actualizo desde entonces. */
export function debeActualizar(c: Credito, hoy: Fecha): boolean {
  if (c.metodo !== 'MANUAL') return false;
  const pago = fechaEnMes(mesDe(hoy), c.diaPago);
  return pago <= hoy && c.saldoActualizadoEn < pago;
}

/** Una cuota proyectada con su mes. */
export interface CuotaProyectada extends FilaTabla {
  ref: MesRef;
}

/** La primera cuota del credito si todavia no llega el mes de `hoy`; si no, null (design D2 de credito-primera-cuota). */
export function primeraCuotaPendiente(c: Pick<Credito, 'primeraCuota'>, hoy: Fecha): MesRef | null {
  const p = c.primeraCuota ?? null;
  return p && compararMes(p, mesDe(hoy)) > 0 ? p : null;
}

/**
 * Las cuotas que vienen, cada una en su mes: la del mes en curso si todavia no se paga, o la de la primera cuota si es
 * posterior (design D2 de credito-primera-cuota).
 */
export function cuotasProyectadas(c: Credito, hoy: Fecha, meses: number): CuotaProyectada[] {
  const M = mesDe(hoy);
  let primera = cuotaPagadaEn(c, M) ? sumarMeses(M, 1) : M;
  const pendiente = primeraCuotaPendiente(c, hoy);
  if (pendiente && compararMes(pendiente, primera) > 0) primera = pendiente;
  return tablaCredito(c, meses).map((f, i) => ({ ...f, ref: sumarMeses(primera, i) }));
}

/** Saldo al final de cada mes, desde el mes en curso (design D4). A mano, constante. */
export function saldosFinDeMes(c: Credito, hoy: Fecha, meses: number): Pesos[] {
  if (c.metodo === 'MANUAL') return Array.from({ length: meses }, () => c.saldo);
  const M = mesDe(hoy);
  const cuotas = cuotasProyectadas(c, hoy, meses + 1);
  return Array.from({ length: meses }, (_, j) => {
    const fin = sumarMeses(M, j);
    const hasta = cuotas.filter((q) => compararMes(q.ref, fin) <= 0);
    return hasta.length ? hasta.at(-1)!.saldo : c.saldo;
  });
}

export interface VistaCredito {
  credito: Credito;
  cuotasRestantes: number | null;
  porcentajePagado: number;
  /** "Cuota 23 de 60": la proxima y el total, si se conocen. */
  progreso: { actual: number; total: number } | null;
  /** La proxima cuota con lo que va a interes y a capital; null a mano o pagado. */
  proxima: CuotaProyectada | null;
  /** Las 6 proximas cuotas. */
  proximas: CuotaProyectada[];
  /** Las 12 proximas, para la tabla de escritorio (CreditoWeb). */
  proximasAnio: CuotaProyectada[];
  /** Mes de la ultima cuota (≈); null a mano o si no alcanza a pagarse. */
  termina: MesRef | null;
  /** A mano: toca escribir el saldo del extracto. */
  actualizar: boolean;
  /** Intereses de enero a diciembre del año siguiente. */
  interesesAnioSiguiente: Pesos;
  /** Saldo al final del mes en curso y de los 5 siguientes. */
  proyeccion: Pesos[];
  /** Los pagos, del mas reciente al mas viejo, con la cuenta de donde salieron si se sabe (CreditoWeb). */
  pagos: PagoConCuenta[];
}

export interface PagoConCuenta {
  fecha: Fecha;
  monto: Pesos;
  tipo: 'CUOTA' | 'ABONO';
  /** Nombre de la cuenta, "Su cuenta" si fue externo, o null si no se sabe. */
  desde: string | null;
}

/** La cuenta de cada pago: la del movimiento del mismo dia y monto, del credito o de un item enlazado a el. */
function pagosConCuenta(c: Credito, estado?: EstadoHogar): PagoConCuenta[] {
  const items = new Set(estado ? estado.planes.flatMap((p) => p.escenarios.flatMap((e) => e.items)).filter((i) => i.creditoId === c.id).map((i) => i.id) : []);
  const movs = estado ? estado.movimientos.filter((m) => m.creditoId === c.id || (m.itemId !== null && items.has(m.itemId))) : [];
  const usados = new Set<string>();
  return [...c.pagos]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((p) => {
      const m = movs.find((x) => !usados.has(x.id) && x.fecha === p.fecha && x.monto === p.monto);
      if (m) usados.add(m.id);
      let desde: string | null = null;
      if (m?.origen.tipo === 'CUENTA') {
        const id = m.origen.cuentaId;
        desde = estado?.cuentas.find((x) => x.id === id)?.nombre ?? null;
      } else if (m?.origen.tipo === 'EXTERNA') desde = 'Su cuenta';
      return { fecha: p.fecha, monto: p.monto, tipo: p.tipo, desde };
    });
}

/** Hasta donde se proyecta para saber cuando termina un credito (50 años). */
const MAX_CUOTAS = 600;

/** `estado`: para saber de que cuenta salio cada pago; sin el, `desde` es null. */
export function vistaCredito(c: Credito, hoy: Fecha, estado?: EstadoHogar): VistaCredito {
  const M = mesDe(hoy);
  const todas = c.metodo === 'MANUAL' ? [] : cuotasProyectadas(c, hoy, MAX_CUOTAS);
  const restantes = cuotasRestantes(c);
  const total = c.metodo === 'PLAN' ? c.numeroCuotas : restantes !== null && c.cuotasPagadas > 0 ? c.cuotasPagadas + restantes : null;
  const ultima = todas.at(-1);
  return {
    credito: c,
    cuotasRestantes: restantes,
    porcentajePagado: porcentajePagado(c),
    progreso: total && c.saldo > 0 ? { actual: Math.min(total, c.cuotasPagadas + 1), total } : null,
    proxima: todas[0] ?? null,
    proximas: todas.slice(0, 6),
    proximasAnio: todas.slice(0, 12),
    termina: ultima && ultima.saldo === 0 ? ultima.ref : null,
    actualizar: debeActualizar(c, hoy),
    interesesAnioSiguiente: sumar(todas.filter((q) => q.ref.anio === M.anio + 1).map((q) => q.interes)),
    proyeccion: saldosFinDeMes(c, hoy, 6),
    pagos: pagosConCuenta(c, estado),
  };
}

/** La pestaña Creditos (spec "Proyeccion de creditos"). */
export interface ResumenCreditos {
  creditos: VistaCredito[];
  /** Suma de los saldos. */
  deben: Pesos;
  /** Suma de las cuotas de los creditos con saldo. */
  pagan: Pesos;
  /** Suma proyectada a diciembre del año en curso, y cuanto baja desde hoy. */
  deberanAlCerrar: Pesos;
  bajaAlCerrar: Pesos;
  interesesAnioSiguiente: Pesos;
  /** Los 6 meses de la proyeccion, desde el mes en curso, y el total de cada uno. */
  meses: MesRef[];
  totales: Pesos[];
}

export function resumenCreditos(estado: EstadoHogar, hoy: Fecha): ResumenCreditos {
  const M = mesDe(hoy);
  const creditos = estado.creditos.map((c) => vistaCredito(c, hoy, estado));
  const deben = sumar(estado.creditos.map((c) => c.saldo));
  const aDiciembre = 12 - M.mes + 1;
  const deberanAlCerrar = sumar(estado.creditos.map((c) => saldosFinDeMes(c, hoy, aDiciembre).at(-1) ?? c.saldo));
  return {
    creditos,
    deben,
    pagan: sumar(estado.creditos.filter((c) => c.saldo > 0).map((c) => c.cuota)),
    deberanAlCerrar,
    bajaAlCerrar: deben - deberanAlCerrar,
    interesesAnioSiguiente: sumar(creditos.map((v) => v.interesesAnioSiguiente)),
    meses: Array.from({ length: 6 }, (_, j) => sumarMeses(M, j)),
    totales: Array.from({ length: 6 }, (_, j) => sumar(creditos.map((v) => v.proyeccion[j] ?? 0))),
  };
}

// --- Escrituras ------------------------------------------------------------------------------------------------------

function creditoDe(s: EstadoHogar, id: Id): Credito {
  const c = s.creditos.find((x) => x.id === id);
  if (!c) throw new ReglaError('NO_EXISTE', 'No existe el crédito');
  return c;
}

/** "Corregir con extracto": el saldo que dice el banco, con la fecha de hoy; la proyeccion sigue desde ahi. */
export function actualizarSaldoCredito(estado: EstadoHogar, datos: { creditoId: Id; saldo: Pesos; fecha: Fecha }): EstadoHogar {
  if (datos.saldo < 0) throw new ReglaError('MONTO_INVALIDO', 'El saldo no puede ser negativo');
  const s = clonar(estado);
  const c = creditoDe(s, datos.creditoId);
  c.saldo = datos.saldo;
  c.saldoActualizadoEn = datos.fecha;
  return s;
}

/**
 * Paga la cuota de un credito segun su metodo (design D3) y devuelve cuanto bajo el saldo (`capital`). Muta el borrador.
 * Con la tasa: cuota − interes del mes. Con el plan de pagos: el saldo de la tabla para la cuota k. A mano: nada.
 */
export function aplicarCuota(c: Credito, monto: Pesos, fecha: Fecha): Pesos {
  const antes = c.saldo;
  if (c.metodo === 'PLAN') {
    const fila = tablaCredito(c, 1)[0];
    c.saldo = fila ? fila.saldo : Math.max(0, c.saldo - monto);
    c.cuotasPagadas += 1;
  } else if (c.metodo === 'TASA') {
    const interes = Math.round((c.saldo * c.tasaEM) / 100);
    c.saldo = Math.max(0, c.saldo - Math.max(0, monto - interes));
    c.cuotasPagadas += 1;
  }
  c.pagos.unshift({ fecha, monto, tipo: 'CUOTA' });
  return antes - c.saldo;
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
    aplicaDiezmo: false, diezmoDe: [], ingresoPlanId: null, cuentaDestinoId: null, creditoId: c.id, capital: datos.monto,
  });
  return s;
}

/**
 * Al borrar un pago de cuota o un abono, el credito recupera lo que le habia bajado (`capital`, design D3 de usabilidad-plan).
 * Una cuota borrada tambien descuenta la cuota pagada (tarjetas-y-creditos). Uno de antes, sin `capital`, no toca el saldo.
 * Muta el borrador.
 */
export function devolverCapital(s: EstadoHogar, m: Movimiento): void {
  if (!m.creditoId || m.capital === null) return;
  const c = s.creditos.find((x) => x.id === m.creditoId);
  if (!c) return;
  c.saldo += m.capital;
  const tipo = m.tipo === 'ABONO_CREDITO' ? 'ABONO' : 'CUOTA';
  if (tipo === 'CUOTA' && c.metodo !== 'MANUAL' && c.cuotasPagadas > 0) c.cuotasPagadas -= 1;
  const i = c.pagos.findIndex((p) => p.fecha === m.fecha && p.monto === m.monto && p.tipo === tipo);
  if (i >= 0) c.pagos.splice(i, 1);
}

/** Datos de "¿Como baja el saldo?" (spec "Como baja el saldo de un credito"). */
export interface DatosMetodo {
  metodo: MetodoCredito;
  /** TASA y MANUAL. */
  saldo: Pesos;
  /** TASA y MANUAL; en PLAN se calcula. */
  cuota: Pesos;
  /** EM en porcentaje (TASA y PLAN). */
  tasaEM: number;
  /** PLAN. */
  numeroCuotas?: number | null;
  cuotasPagadas?: number;
  valorFinanciado?: Pesos | null;
  /**
   * El mes de la primera cuota: del en curso a 12 meses despues; el en curso la quita. Sin el campo, al cambiar el metodo
   * se conserva la que habia (design D4 y D5 de credito-primera-cuota).
   */
  primeraCuota?: MesRef | null;
}

/** Hasta cuantos meses despues del en curso puede ser la primera cuota. */
export const MAX_MESES_PRIMERA_CUOTA = 12;

/** Valida la primera cuota contra el mes de `fecha` y devuelve lo que se guarda: null para el mes en curso (design D4). */
function primeraCuotaValida(p: MesRef | null | undefined, fecha: Fecha): MesRef | null {
  if (!p) return null;
  const M = mesDe(fecha);
  if (!(Number.isInteger(p.anio) && Number.isInteger(p.mes) && p.mes >= 1 && p.mes <= 12)
    || compararMes(p, M) < 0 || compararMes(p, sumarMeses(M, MAX_MESES_PRIMERA_CUOTA)) > 0) {
    throw new ReglaError('DATOS_INVALIDOS', 'La primera cuota va del mes en curso a 12 meses después');
  }
  return compararMes(p, M) === 0 ? null : { anio: p.anio, mes: p.mes };
}

export interface DatosCredito extends Omit<DatosMetodo, 'metodo'> {
  /** Sin el campo, con la tasa (como antes de tarjetas-y-creditos). */
  metodo?: MetodoCredito;
  nombre: string;
  entidad: string;
  totalOriginal: Pesos;
  diaPago: number;
}

/** Valida los datos del metodo y devuelve los campos del credito (en PLAN, la cuota y el saldo salen de la tabla). */
function camposMetodo(d: DatosMetodo): Pick<Credito, 'metodo' | 'saldo' | 'cuota' | 'tasaEM' | 'numeroCuotas' | 'cuotasPagadas' | 'valorFinanciado'> {
  if (!(d.tasaEM >= 0 && d.tasaEM <= 10)) throw new ReglaError('MONTO_INVALIDO', 'La tasa efectiva mensual va de 0 a 10 %');
  if (d.metodo === 'PLAN') {
    const n = d.numeroCuotas ?? 0;
    const pagadas = d.cuotasPagadas ?? 0;
    const valor = d.valorFinanciado ?? 0;
    if (!(valor > 0) || !Number.isInteger(n) || n < 1 || n > 600 || !Number.isInteger(pagadas) || pagadas < 0 || pagadas >= n) {
      throw new ReglaError('MONTO_INVALIDO', 'Revisa el valor, el número de cuotas y las cuotas pagadas');
    }
    const base = { valorFinanciado: valor, numeroCuotas: n, tasaEM: d.tasaEM, cuota: cuotaFija(valor, n, d.tasaEM) };
    return { metodo: 'PLAN', ...base, saldo: saldoPlan(base, pagadas), cuotasPagadas: pagadas };
  }
  if (!(d.saldo >= 0) || !(d.cuota > 0)) throw new ReglaError('MONTO_INVALIDO', 'Revisa el saldo y la cuota');
  return {
    metodo: d.metodo, saldo: d.saldo, cuota: d.cuota, tasaEM: d.metodo === 'MANUAL' ? 0 : d.tasaEM,
    numeroCuotas: null, cuotasPagadas: d.cuotasPagadas ?? 0, valorFinanciado: null,
  };
}

/** "Cambiar" en el detalle: otro metodo, o los datos del mismo. El item del plan sigue la cuota nueva en los meses en Borrador. */
export function cambiarMetodoCredito(estado: EstadoHogar, datos: DatosMetodo & { creditoId: Id; fecha: Fecha }): EstadoHogar {
  const s = clonar(estado);
  const c = creditoDe(s, datos.creditoId);
  const antes = c.saldo;
  Object.assign(c, camposMetodo(datos));
  if (datos.primeraCuota !== undefined) c.primeraCuota = primeraCuotaValida(datos.primeraCuota, datos.fecha);
  if (c.saldo !== antes) c.saldoActualizadoEn = datos.fecha;
  if (c.metodo === 'PLAN') c.totalOriginal = Math.max(c.valorFinanciado ?? 0, c.saldo);
  for (const plan of s.planes.filter((p) => p.estado === 'BORRADOR')) {
    for (const e of plan.escenarios) for (const i of e.items) if (i.creditoId === c.id && i.nombre.startsWith('Cuota ')) i.monto = c.cuota;
  }
  return s;
}

/** Item de la cuota de un credito, enlazado a el (spec steward-plan-mes, design D5 de backend-cuentas-creditos). */
function itemCuota(s: EstadoHogar, credito: Credito): ItemPlan {
  const categoria = s.categorias.find((c) => c.tipo === 'CREDITO') ?? s.categorias[0];
  if (!categoria) throw new ReglaError('NO_EXISTE', 'El hogar no tiene categorías');
  return {
    id: nuevoId(s, 'item'), categoriaId: categoria.id, nombre: `Cuota ${credito.nombre.toLowerCase()}`, monto: credito.cuota,
    diaVence: credito.diaPago, tipo: 'CREDITO', cuota: null, creditoId: credito.id, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false,
  };
}

/** Agrega a `items` la cuota de cada credito con saldo que todavia no tenga item enlazado (y que pase `filtro`, si se da). */
export function cuotasDeCreditos(s: EstadoHogar, items: ItemPlan[], filtro: (c: Credito) => boolean = () => true): ItemPlan[] {
  const enlazados = new Set(items.map((i) => i.creditoId).filter((id) => id !== null));
  return [...items, ...s.creditos.filter((c) => c.saldo > 0 && !enlazados.has(c.id) && filtro(c)).map((c) => itemCuota(s, c))];
}

/**
 * Si el credito paga una cuota en `ref` segun su tabla (design D3 de anual-opciones-y-meses). A mano, mientras tenga saldo;
 * un mes anterior al de `hoy` cuenta como pagado.
 */
export function pagaEnMes(c: Credito, ref: MesRef, hoy: Fecha): boolean {
  if (c.saldo <= 0) return false;
  const pendiente = primeraCuotaPendiente(c, hoy);
  if (pendiente && compararMes(ref, pendiente) < 0) return false;
  if (c.metodo === 'MANUAL') return true;
  const M = mesDe(hoy);
  const meses = (ref.anio - M.anio) * 12 + ref.mes - M.mes + 1;
  if (meses <= 0) return true;
  return cuotasProyectadas(c, hoy, meses).some((q) => mismoMes(q.ref, ref));
}

/** "+ Credito": su cuota entra a la opcion en uso del mes en curso si tiene plan y no esta cerrado. */
export function agregarCredito(estado: EstadoHogar, datos: DatosCredito & { fecha: Fecha }): EstadoHogar {
  const nombre = datos.nombre.trim();
  const entidad = datos.entidad.trim();
  if (!nombre || nombre.length > 40 || entidad.length > 40) throw new ReglaError('NOMBRE_REQUERIDO', 'El crédito necesita un nombre de hasta 40 caracteres');
  if (!Number.isInteger(datos.diaPago) || datos.diaPago < 1 || datos.diaPago > 31) throw new ReglaError('DIA_INVALIDO', 'El día de pago va de 1 a 31');
  const campos = camposMetodo({ ...datos, metodo: datos.metodo ?? 'TASA' });
  const primeraCuota = primeraCuotaValida(datos.primeraCuota, datos.fecha);
  const totalOriginal = campos.metodo === 'PLAN' ? campos.valorFinanciado! : datos.totalOriginal;
  if (!(totalOriginal > 0) || totalOriginal < campos.saldo) throw new ReglaError('MONTO_INVALIDO', 'Revisa el saldo, el total original y la cuota');
  const s = clonar(estado);
  const credito: Credito = {
    id: nuevoId(s, 'cred'), nombre, entidad, saldoActualizadoEn: datos.fecha, diaPago: datos.diaPago, totalOriginal, pagos: [], ...campos,
    primeraCuota,
  };
  s.creditos.push(credito);
  const plan = planDe(s, mesDe(datos.fecha));
  // Si la primera cuota es de un mes posterior, el mes en curso no la trae (design D3 de credito-primera-cuota).
  const principal = plan && plan.estado !== 'CERRADO' && !primeraCuota ? escenarioPrincipal(plan) : null;
  if (principal) principal.items.push(itemCuota(s, credito));
  return s;
}

/**
 * "Eliminar crédito" (design D1 de credito-escritorio-y-eliminar): sus pagos y abonos quedan sin credito; en los meses
 * abiertos desde el de `fecha`, sus items sin pagos ni gastos se quitan; los demas items quedan sin enlace.
 */
export function eliminarCredito(estado: EstadoHogar, datos: { creditoId: Id; fecha: Fecha }): EstadoHogar {
  const s = clonar(estado);
  creditoDe(s, datos.creditoId);
  const M = mesDe(datos.fecha);
  const conRegistros = new Set(s.movimientos.filter((m) => (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.itemId !== null).map((m) => m.itemId));
  for (const m of s.movimientos) if (m.creditoId === datos.creditoId) m.creditoId = null;
  for (const plan of s.planes) {
    const abierto = plan.estado !== 'CERRADO' && compararMes(plan.ref, M) >= 0;
    for (const e of plan.escenarios) {
      e.items = e.items.filter((i) => !(abierto && i.creditoId === datos.creditoId && !conRegistros.has(i.id)));
      for (const i of e.items) if (i.creditoId === datos.creditoId) i.creditoId = null;
    }
  }
  s.creditos = s.creditos.filter((c) => c.id !== datos.creditoId);
  return s;
}
