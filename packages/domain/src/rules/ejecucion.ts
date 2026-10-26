import type { EstadoHogar, Fecha, Id, ItemPlan, MesRef, Movimiento, Origen, Pesos } from '../model';
import { formatCop, formatFechaCorta } from '../format';
import { ReglaError, clonar, diasEntre, fechaEnMes, nuevoId, sumar } from './base';
import { asegurarAbierto, categoria, escenarioPrincipal, movimientosDe, nombreUsuario, planDe } from './consultas';
import { diezmoPlaneado, diezmosPendientes, ingresosDelMes, totalIngresos, type LineaIngreso, type ObligacionDiezmo } from './ingresos';

/** Como va un item del plan en el mes. */
export interface ItemEjecucion {
  item: ItemPlan;
  categoriaNombre: string;
  plan: Pesos;
  real: Pesos;
  pagos: Movimiento[];
  /** Fijo/cuota/credito con pago, o variable que ya alcanzo su presupuesto. */
  pagado: boolean;
  /** Variable: lo que falta para su presupuesto. Fijo pendiente: el plan. */
  pendiente: Pesos;
  /** Texto bajo el nombre ("Vence en 4 días", "Variable · llevas $180.000 de $320.000", "plan $50.000 · −$12.000"). */
  detalle: string;
  /** Diferencia real − plan cuando aplica (fijos pagados). */
  diferencia: Pesos | null;
  /** Inicial de quien pago (ultimo pago). */
  pagadoPor: Id | null;
}

export interface ResumenMes {
  ref: MesRef;
  ingresos: LineaIngreso[];
  totalIngresos: Pesos;
  plan: Pesos;
  pagado: Pesos;
  vsPlan: Pesos;
  libre: Pesos;
  porPagar: ItemEjecucion[];
  yaPagado: ItemEjecucion[];
  noPlaneados: Movimiento[];
  diezmo: { planeado: Pesos; detalle: string; pendientes: ObligacionDiezmo[] };
  ajustes: Pesos;
  /** El mes no tiene una opcion que ejecutar. */
  sinPlan: boolean;
}

function detalleVencimiento(item: ItemPlan, ref: MesRef, hoy: Fecha): string {
  if (item.cuota) return `Vence día ${item.diaVence ?? '—'} · cuota ${item.cuota.actual} de ${item.cuota.total}`;
  if (item.diaVence === null) return categoriaVacia(item);
  const dias = diasEntre(hoy, fechaEnMes(ref, item.diaVence));
  if (dias < 0) return `Venció el día ${item.diaVence}`;
  if (dias === 0) return 'Vence hoy';
  if (dias <= 7) return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return `Vence día ${item.diaVence}`;
}

function categoriaVacia(item: ItemPlan): string {
  return item.tipo === 'CREDITO' ? 'Cuota del crédito' : 'Del plan';
}

export function ejecucionItem(estado: EstadoHogar, item: ItemPlan, ref: MesRef, hoy: Fecha): ItemEjecucion {
  const pagos = movimientosDe(estado, ref).filter((m) => (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.itemId === item.id);
  const real = sumar(pagos.map((p) => p.monto));
  const ultimo = pagos.at(-1) ?? null;
  const categoriaNombre = categoria(estado, item.categoriaId).nombre;
  if (item.tipo === 'VARIABLE') {
    const pagado = item.monto > 0 && real >= item.monto;
    return {
      item, categoriaNombre, plan: item.monto, real, pagos, pagado, pendiente: Math.max(0, item.monto - real),
      detalle: pagado ? `Variable · ${real > item.monto ? `${formatCop(real - item.monto)} sobre el plan` : 'completo'}` : `Variable · llevas ${formatCop(real)} de ${formatCop(item.monto)}`,
      diferencia: pagado ? real - item.monto : null, pagadoPor: ultimo?.usuarioId ?? null,
    };
  }
  const pagado = pagos.length > 0;
  let detalle = detalleVencimiento(item, ref, hoy);
  if (pagado) {
    const dif = real - item.monto;
    const desde = ultimo && ultimo.origen.tipo === 'CUENTA' ? estado.cuentas.find((c) => c.id === (ultimo.origen as { cuentaId: Id }).cuentaId)?.nombre : ultimo?.origen.tipo === 'EXTERNA' ? 'su cuenta' : null;
    detalle = dif === 0 ? `igual al plan${desde ? ` · ${desde}` : ''}` : `plan ${formatCop(item.monto)} · ${formatCop(dif, { signo: true })}`;
  }
  return { item, categoriaNombre, plan: item.monto, real, pagos, pagado, pendiente: pagado ? 0 : item.monto, detalle, diferencia: pagado ? real - item.monto : null, pagadoPor: ultimo?.usuarioId ?? null };
}

/** Todo lo que muestra Hoy para un mes. Reglas en design D3 del cambio presupuesto-hogar-ui. */
export function resumenMes(estado: EstadoHogar, ref: MesRef, hoy: Fecha): ResumenMes {
  const plan = planDe(estado, ref);
  const opcion = plan ? escenarioPrincipal(plan) : null;
  const items = (opcion?.items ?? []).map((i) => ejecucionItem(estado, i, ref, hoy));
  const movs = movimientosDe(estado, ref);
  const noPlaneados = movs.filter((m) => m.tipo === 'GASTO' && m.itemId === null);
  const diezmo = diezmoPlaneado(estado, ref);
  const entregado = sumar(movs.filter((m) => m.tipo === 'DIEZMO_ENTREGADO').map((m) => m.monto));
  const ajustes = sumar(movs.filter((m) => m.tipo === 'AJUSTE_CUADRE').map((m) => m.monto));
  const ingresos = ingresosDelMes(estado, ref, 'EJECUCION');

  const planTotal = sumar(items.map((i) => i.plan)) + diezmo.monto;
  const noPlaneado = sumar(noPlaneados.map((m) => m.monto));
  const pagado = sumar(items.map((i) => i.real)) + noPlaneado + entregado;
  const vsPlan =
    sumar(items.filter((i) => i.item.tipo !== 'VARIABLE' && i.pagado).map((i) => i.real - i.plan)) +
    sumar(items.filter((i) => i.item.tipo === 'VARIABLE').map((i) => Math.max(0, i.real - i.plan))) +
    noPlaneado;
  const comprometido = sumar(items.map((i) => Math.max(i.plan, i.real))) + noPlaneado + Math.max(diezmo.monto, entregado);
  const total = totalIngresos(ingresos);

  const porVencer = (i: ItemEjecucion) => i.item.diaVence ?? 99;
  return {
    ref,
    ingresos,
    totalIngresos: total,
    plan: planTotal,
    pagado,
    vsPlan,
    libre: total - comprometido - ajustes,
    porPagar: items.filter((i) => !i.pagado).sort((a, b) => porVencer(a) - porVencer(b)),
    yaPagado: items.filter((i) => i.pagado).sort((a, b) => (b.pagos.at(-1)?.seq ?? 0) - (a.pagos.at(-1)?.seq ?? 0)),
    noPlaneados,
    diezmo: { planeado: diezmo.monto, detalle: diezmo.detalle, pendientes: diezmosPendientes(estado, ref) },
    ajustes,
    sinPlan: !opcion,
  };
}

function itemDelMes(estado: EstadoHogar, ref: MesRef, itemId: Id): ItemPlan {
  asegurarAbierto(estado, ref);
  const plan = planDe(estado, ref);
  const item = plan && escenarioPrincipal(plan)?.items.find((i) => i.id === itemId);
  if (!item) throw new ReglaError('NO_EXISTE', 'Ese gasto no está en el plan del mes');
  return item;
}

/** "Marcar pagado". Un fijo ya pagado no se paga dos veces: avisa quien y cuando. */
export function marcarPago(estado: EstadoHogar, datos: { itemId: Id; ref: MesRef; monto: Pesos; usuarioId: Id; origen: Origen; fecha: Fecha; creadoPor: Id }): EstadoHogar {
  const item = itemDelMes(estado, datos.ref, datos.itemId);
  if (!(datos.monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El valor pagado debe ser mayor que cero');
  if (item.tipo !== 'VARIABLE') {
    const previo = movimientosDe(estado, datos.ref).find((m) => m.tipo === 'PAGO' && m.itemId === item.id);
    if (previo) {
      const nombre = nombreUsuario(estado, previo.usuarioId);
      throw new ReglaError('YA_PAGADO', `Ya lo pagó ${nombre} el ${formatFechaCorta(previo.fecha)}`, { usuarioId: previo.usuarioId, fecha: previo.fecha, nombre });
    }
  }
  const s = clonar(estado);
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: item.tipo === 'VARIABLE' ? 'GASTO' : 'PAGO', ref: datos.ref, monto: datos.monto, fecha: datos.fecha,
    usuarioId: datos.usuarioId, creadoPor: datos.creadoPor, origen: datos.origen, nota: '', itemId: item.id,
    ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: [], cuentaDestinoId: null, creditoId: item.creditoId,
  });
  // La cuota de un credito baja su saldo en la parte de capital.
  if (item.creditoId) {
    const credito = s.creditos.find((c) => c.id === item.creditoId);
    if (credito) {
      const interes = Math.round((credito.saldo * credito.tasaEM) / 100);
      credito.saldo = Math.max(0, credito.saldo - Math.max(0, datos.monto - interes));
      credito.pagos.unshift({ fecha: datos.fecha, monto: datos.monto, tipo: 'CUOTA' });
    }
  }
  return s;
}

/** "Registrar gasto": contra un item del plan (los variables acumulan) o "No estaba planeado" (itemId null). */
export function registrarGasto(estado: EstadoHogar, datos: { monto: Pesos; itemId: Id | null; nota: string; usuarioId: Id; origen: Origen; ref: MesRef; fecha: Fecha; creadoPor: Id }): EstadoHogar {
  if (!(datos.monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El gasto debe ser mayor que cero');
  asegurarAbierto(estado, datos.ref);
  if (datos.itemId) itemDelMes(estado, datos.ref, datos.itemId);
  const s = clonar(estado);
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: 'GASTO', ref: datos.ref, monto: datos.monto, fecha: datos.fecha, usuarioId: datos.usuarioId,
    creadoPor: datos.creadoPor, origen: datos.origen, nota: datos.nota.trim(), itemId: datos.itemId,
    ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: [], cuentaDestinoId: null, creditoId: null,
  });
  return s;
}

/** Vista previa de un gasto variable antes de guardarlo ("Mercado: llevas $244.000 de $320.000 con este gasto"). */
export function previsualizarGasto(estado: EstadoHogar, ref: MesRef, itemId: Id, monto: Pesos, hoy: Fecha): { llevado: Pesos; presupuesto: Pesos } {
  const e = ejecucionItem(estado, itemDelMes(estado, ref, itemId), ref, hoy);
  return { llevado: e.real + monto, presupuesto: e.plan };
}
