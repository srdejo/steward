import type { EstadoHogar, Fecha, Id, ItemPlan, PagoTarjeta, Pesos, Tarjeta } from '../model';
import { formatFechaCorta } from '../format';
import { ReglaError, clonar, diasEntre, fechaEnMes, mesDe, nuevoId, sumar, sumarMeses } from './base';
import { escenarioPrincipal, planDe } from './consultas';
import type { TonoVence } from './ejecucion';

// Tarjetas de credito (spec steward-tarjetas, design D1 y D2 de tarjetas-y-creditos). No llevan deuda ni compras.

/** Lo que se escribe al agregar o editar una tarjeta. */
export interface DatosTarjeta {
  nombre: string;
  diaCorte: number;
  diaPago: number;
  uso: string;
  pago: PagoTarjeta;
}

/** Un item de Creditos del mes en curso que puede pasar a ser la linea de una tarjeta nueva. */
export interface ItemEnlazable {
  id: Id;
  nombre: string;
  monto: Pesos;
}

/** "Tarjeta Nu · Mercado". */
export function nombreLinea(t: Pick<Tarjeta, 'nombre' | 'uso'>): string {
  return `Tarjeta ${t.nombre}${t.uso ? ` · ${t.uso}` : ''}`;
}

/** El monto de su linea: el pago fijo o, si se paga completa, el ultimo valor pagado (o el estimado al agregarla). */
export function montoTarjeta(t: Tarjeta): Pesos {
  return t.pago.tipo === 'FIJO' ? t.pago.monto : t.pago.estimado;
}

// --- Fechas (design D2) ----------------------------------------------------------------------------------------------

function diaSiguiente(fecha: Fecha): Fecha {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** La primera fecha con ese dia (el ultimo del mes si no existe) desde `hoy`, incluido. */
export function proximaFecha(dia: number, hoy: Fecha): Fecha {
  const M = mesDe(hoy);
  const este = fechaEnMes(M, dia);
  return este >= hoy ? este : fechaEnMes(sumarMeses(M, 1), dia);
}

/** El pago de un corte: el primer dia de pago despues del corte (el mismo mes o el siguiente). */
export function pagoDeCorte(t: Pick<Tarjeta, 'diaPago'>, corte: Fecha): Fecha {
  const M = mesDe(corte);
  const mismo = fechaEnMes(M, t.diaPago);
  return mismo > corte ? mismo : fechaEnMes(sumarMeses(M, 1), t.diaPago);
}

/** ≤ 3 dias alerta, ≤ 7 aviso (los mismos umbrales de Hoy). */
function tonoDias(dias: number): TonoVence {
  return dias <= 3 ? 'alerta' : dias <= 7 ? 'aviso' : 'normal';
}

function enDias(dias: number): string {
  return dias === 0 ? 'Hoy' : `En ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** "Lo que compres hasta el 13 nov se paga el 28 nov. Desde el 14 nov, el 28 dic." o el aviso del pago fijo. */
export function ayudaTarjeta(t: Tarjeta, hoy: Fecha): string {
  if (t.pago.tipo === 'FIJO') return 'No se paga completa: el saldo que queda genera intereses.';
  const corte = proximaFecha(t.diaCorte, hoy);
  const siguiente = fechaEnMes(sumarMeses(mesDe(corte), 1), t.diaCorte);
  return `Lo que compres hasta el ${formatFechaCorta(corte)} se paga el ${formatFechaCorta(pagoDeCorte(t, corte))}. ` +
    `Desde el ${formatFechaCorta(diaSiguiente(corte))}, el ${formatFechaCorta(pagoDeCorte(t, siguiente))}.`;
}

/** Un corte o un pago de las proximas semanas. */
export interface FechaTarjeta {
  fecha: Fecha;
  tipo: 'PAGO' | 'CORTE';
  tarjetaId: Id;
  /** "Paga Nu" o "Corte Nu" (el calendario de escritorio). */
  etiqueta: string;
  /** "Pagar Nu · Mercado" o "Corte Nu" (la lista movil). */
  que: string;
  /** "En 2 días" en un pago; "Mejor día para una compra grande: 14 nov" en un corte. */
  cuando: string;
  /** Solo en los pagos. */
  valor: Pesos | null;
  tono: TonoVence;
}

export interface VistaTarjeta {
  tarjeta: Tarjeta;
  linea: string;
  monto: Pesos;
  proximoPago: { fecha: Fecha; dias: number; tono: TonoVence };
  proximoCorte: { fecha: Fecha; dias: number };
  ayuda: string;
  /** Pago fijo: el saldo que queda genera intereses. */
  aviso: boolean;
}

/** La pestaña Tarjetas (spec "Proximas fechas de las tarjetas"). */
export interface VistaTarjetas {
  tarjetas: VistaTarjeta[];
  /** Cortes y pagos desde hoy, durante `DIAS_FECHAS` dias, ordenados. */
  fechas: FechaTarjeta[];
  /** Suma del proximo pago de cada tarjeta. */
  porPagarCiclo: Pesos;
  /** La tarjeta que se paga mas pronto, si es en 3 dias o menos ("Pago en 2 días" en la pestaña). */
  pagoPronto: { nombre: string; dias: number } | null;
}

/** Cinco semanas. */
export const DIAS_FECHAS = 35;

export function vistaTarjeta(t: Tarjeta, hoy: Fecha): VistaTarjeta {
  const pago = proximaFecha(t.diaPago, hoy);
  const corte = proximaFecha(t.diaCorte, hoy);
  const dias = diasEntre(hoy, pago);
  return {
    tarjeta: t, linea: nombreLinea(t), monto: montoTarjeta(t),
    proximoPago: { fecha: pago, dias, tono: tonoDias(dias) },
    proximoCorte: { fecha: corte, dias: diasEntre(hoy, corte) },
    ayuda: ayudaTarjeta(t, hoy),
    aviso: t.pago.tipo === 'FIJO',
  };
}

export function fechasTarjetas(tarjetas: Tarjeta[], hoy: Fecha, dias = DIAS_FECHAS): FechaTarjeta[] {
  const M = mesDe(hoy);
  const fechas: FechaTarjeta[] = [];
  for (const t of tarjetas) {
    for (let i = 0; i <= Math.ceil(dias / 28); i++) {
      const ref = sumarMeses(M, i);
      const pago = fechaEnMes(ref, t.diaPago);
      const corte = fechaEnMes(ref, t.diaCorte);
      const dPago = diasEntre(hoy, pago);
      const dCorte = diasEntre(hoy, corte);
      if (dPago >= 0 && dPago < dias) {
        fechas.push({
          fecha: pago, tipo: 'PAGO', tarjetaId: t.id, etiqueta: `Paga ${t.nombre}`, que: `Pagar ${nombreLinea(t).replace('Tarjeta ', '')}`,
          cuando: `${enDias(dPago)}${t.pago.tipo === 'COMPLETA' ? ' · valor del extracto' : ''}`, valor: montoTarjeta(t), tono: tonoDias(dPago),
        });
      }
      if (dCorte >= 0 && dCorte < dias) {
        fechas.push({
          fecha: corte, tipo: 'CORTE', tarjetaId: t.id, etiqueta: `Corte ${t.nombre}`, que: `Corte ${t.nombre}`,
          cuando: `Mejor día para una compra grande: ${formatFechaCorta(diaSiguiente(corte))}`, valor: null, tono: 'normal',
        });
      }
    }
  }
  return fechas.sort((a, b) => (a.fecha === b.fecha ? (a.tipo === 'PAGO' ? -1 : 1) : a.fecha < b.fecha ? -1 : 1));
}

export function vistaTarjetas(estado: EstadoHogar, hoy: Fecha): VistaTarjetas {
  const tarjetas = estado.tarjetas.map((t) => vistaTarjeta(t, hoy));
  const pronta = [...tarjetas].sort((a, b) => a.proximoPago.dias - b.proximoPago.dias)[0];
  return {
    tarjetas,
    fechas: fechasTarjetas(estado.tarjetas, hoy),
    porPagarCiclo: sumar(tarjetas.map((v) => v.monto)),
    pagoPronto: pronta && pronta.proximoPago.dias <= 3 ? { nombre: pronta.tarjeta.nombre, dias: pronta.proximoPago.dias } : null,
  };
}

// --- La tarjeta en el plan (design D1) -------------------------------------------------------------------------------

/** La categoria de las lineas de tarjeta: Tarjetas (o Creditos, en datos que no la tienen). */
function categoriaTarjetas(s: EstadoHogar): Id {
  const c = s.categorias.find((x) => x.tipo === 'TARJETA') ?? s.categorias.find((x) => x.tipo === 'CREDITO') ?? s.categorias[0];
  if (!c) throw new ReglaError('NO_EXISTE', 'El hogar no tiene categorías');
  return c.id;
}

function itemTarjeta(s: EstadoHogar, t: Tarjeta): ItemPlan {
  return {
    id: nuevoId(s, 'item'), categoriaId: categoriaTarjetas(s), nombre: nombreLinea(t), monto: montoTarjeta(t), diaVence: t.diaPago,
    tipo: 'FIJO', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false, tarjetaId: t.id,
  };
}

/**
 * Al nacer un mes: las lineas de tarjeta copiadas toman el monto de su tarjeta, las de una tarjeta quitada quedan sin
 * enlace, y cada tarjeta sin linea gana la suya.
 */
export function lineasDeTarjetas(s: EstadoHogar, items: ItemPlan[]): ItemPlan[] {
  const porId = new Map(s.tarjetas.map((t) => [t.id, t]));
  const con = items.map((i): ItemPlan => {
    if (!i.tarjetaId) return i;
    const t = porId.get(i.tarjetaId);
    return t ? { ...i, categoriaId: categoriaTarjetas(s), monto: montoTarjeta(t), diaVence: t.diaPago } : { ...i, tarjetaId: null };
  });
  const enlazadas = new Set(con.map((i) => i.tarjetaId).filter((id) => id));
  return [...con, ...s.tarjetas.filter((t) => !enlazadas.has(t.id)).map((t) => itemTarjeta(s, t))];
}

function validar(d: DatosTarjeta): DatosTarjeta {
  const nombre = d.nombre.trim();
  const uso = d.uso.trim();
  if (!nombre || nombre.length > 40 || uso.length > 40) throw new ReglaError('NOMBRE_REQUERIDO', 'La tarjeta necesita un nombre de hasta 40 caracteres');
  const dia = (x: number) => Number.isInteger(x) && x >= 1 && x <= 31;
  if (!dia(d.diaCorte) || !dia(d.diaPago)) throw new ReglaError('DIA_INVALIDO', 'Los días de corte y de pago van de 1 a 31');
  const monto = d.pago.tipo === 'FIJO' ? d.pago.monto : d.pago.estimado;
  if (d.pago.tipo === 'FIJO' ? !(monto > 0) : !(monto >= 0)) throw new ReglaError('MONTO_INVALIDO', 'El pago fijo debe ser mayor que cero');
  return { nombre, uso, diaCorte: d.diaCorte, diaPago: d.diaPago, pago: { ...d.pago } };
}

/** Items de Creditos del mes en curso, sin tarjeta ni credito: los que pueden ser la linea de una tarjeta nueva. */
export function itemsEnlazables(estado: EstadoHogar, hoy: Fecha): ItemEnlazable[] {
  const plan = planDe(estado, mesDe(hoy));
  const principal = plan && plan.estado !== 'CERRADO' ? escenarioPrincipal(plan) : null;
  // Los gastos sueltos de Tarjetas o de Creditos (alli quedaron las tarjetas de antes de la categoria Tarjetas).
  const deudas = new Set(estado.categorias.filter((c) => c.tipo === 'TARJETA' || c.tipo === 'CREDITO').map((c) => c.id));
  return (principal?.items ?? [])
    .filter((i) => deudas.has(i.categoriaId) && !i.tarjetaId && !i.creditoId)
    .map((i) => ({ id: i.id, nombre: i.nombre, monto: i.monto }));
}

/**
 * "+ Tarjeta": su linea entra a la opcion en uso del mes en curso si su dia de pago no ha pasado, o se enlaza el item
 * elegido (`itemId`). Los meses que nazcan despues la traen siempre.
 */
export function agregarTarjeta(estado: EstadoHogar, datos: DatosTarjeta & { itemId?: Id | null; fecha: Fecha }): EstadoHogar {
  const d = validar(datos);
  const s = clonar(estado);
  const tarjeta: Tarjeta = { id: nuevoId(s, 'tar'), ...d };
  s.tarjetas.push(tarjeta);
  const plan = planDe(s, mesDe(datos.fecha));
  const principal = plan && plan.estado !== 'CERRADO' ? escenarioPrincipal(plan) : null;
  if (datos.itemId) {
    if (!itemsEnlazables(estado, datos.fecha).some((i) => i.id === datos.itemId)) throw new ReglaError('NO_EXISTE', 'Ese ítem no se puede enlazar');
    const item = principal!.items.find((i) => i.id === datos.itemId)!;
    item.tarjetaId = tarjeta.id;
    item.diaVence = tarjeta.diaPago;
    item.categoriaId = categoriaTarjetas(s);
  } else if (principal && fechaEnMes(mesDe(datos.fecha), tarjeta.diaPago) >= datos.fecha) {
    // Si su dia de pago de este mes ya paso, ese pago ya se hizo (o era de otro registro): la linea empieza el mes siguiente.
    principal.items.push(itemTarjeta(s, tarjeta));
  }
  return s;
}

/** Cambia los datos; las lineas de los meses en Borrador siguen el nombre, el dia y el monto nuevos. */
export function editarTarjeta(estado: EstadoHogar, datos: DatosTarjeta & { id: Id }): EstadoHogar {
  const d = validar(datos);
  const s = clonar(estado);
  const t = s.tarjetas.find((x) => x.id === datos.id);
  if (!t) throw new ReglaError('NO_EXISTE', 'No existe la tarjeta');
  Object.assign(t, d);
  for (const plan of s.planes.filter((p) => p.estado === 'BORRADOR')) {
    for (const e of plan.escenarios) {
      for (const i of e.items.filter((x) => x.tarjetaId === t.id)) Object.assign(i, { nombre: nombreLinea(t), monto: montoTarjeta(t), diaVence: t.diaPago });
    }
  }
  return s;
}

/** Quitar: los items quedan sin enlace y los pagos registrados no cambian. */
export function quitarTarjeta(estado: EstadoHogar, id: Id): EstadoHogar {
  const s = clonar(estado);
  if (!s.tarjetas.some((t) => t.id === id)) throw new ReglaError('NO_EXISTE', 'No existe la tarjeta');
  s.tarjetas = s.tarjetas.filter((t) => t.id !== id);
  for (const plan of s.planes) for (const e of plan.escenarios) for (const i of e.items) if (i.tarjetaId === id) i.tarjetaId = null;
  return s;
}
