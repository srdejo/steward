import type { EstadoHogar, Fecha, Id, ItemPlan, MesRef, Movimiento, Origen, Pesos } from '../model';
import { formatCop, formatFechaCorta } from '../format';
import { ReglaError, clonar, diasEntre, fechaEnMes, nuevoId, sumar } from './base';
import { asegurarAbierto, categoria, escenarioPrincipal, movimientosDe, nombreUsuario, planDe } from './consultas';
import { devolverCapital } from './credito';
import { ingresosDelMes, itemConPagos, seguirAporte, totalIngresos, type LineaIngreso } from './ingresos';

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
  /** Gastos sin item del plan; incluye las entregas de diezmo registradas antes del diezmo como gasto (design D3). */
  noPlaneados: Movimiento[];
  ajustes: Pesos;
  /** El mes no tiene una opcion que ejecutar. */
  sinPlan: boolean;
}

/** Gasto sin item: "No estaba planeado", o una entrega de diezmo de antes del diezmo como gasto (design D3). */
export function esGastoSinItem(m: Movimiento): boolean {
  return (m.tipo === 'GASTO' && m.itemId === null) || m.tipo === 'DIEZMO_ENTREGADO';
}

/** El diezmo no es una factura: dice de donde viene, sin "Venció" (spec steward-hoy, "Diezmo sin vencimiento"). */
function detalleDiezmo(estado: EstadoHogar, item: ItemPlan, ref: MesRef): string {
  const dia = item.diaVence ? ` · día ${item.diaVence}` : '';
  const linea = item.ingresoPlanId ? planDe(estado, ref)?.escenarios.flatMap((e) => e.ingresos).find((l) => l.id === item.ingresoPlanId) : undefined;
  if (linea) return `Del ${linea.nombre}${dia}`;
  const aporte = item.aporteId ? estado.movimientos.find((m) => m.id === item.aporteId) : undefined;
  if (aporte) return `Del aporte del ${formatFechaCorta(aporte.fecha)}`;
  const fijo = item.ingresoFijoId ? estado.ingresosFijos.find((f) => f.id === item.ingresoFijoId) : undefined;
  return fijo ? `Del ${fijo.nombre}${dia}` : 'Diezmo';
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
  let detalle = item.tipo === 'DIEZMO' ? detalleDiezmo(estado, item, ref) : detalleVencimiento(item, ref, hoy);
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
  const noPlaneados = movs.filter(esGastoSinItem);
  const ajustes = sumar(movs.filter((m) => m.tipo === 'AJUSTE_CUADRE').map((m) => m.monto));
  const ingresos = ingresosDelMes(estado, ref, 'EJECUCION', opcion);

  const planTotal = sumar(items.map((i) => i.plan));
  const noPlaneado = sumar(noPlaneados.map((m) => m.monto));
  const pagado = sumar(items.map((i) => i.real)) + noPlaneado;
  const vsPlan =
    sumar(items.filter((i) => i.item.tipo !== 'VARIABLE' && i.pagado).map((i) => i.real - i.plan)) +
    sumar(items.filter((i) => i.item.tipo === 'VARIABLE').map((i) => Math.max(0, i.real - i.plan))) +
    noPlaneado;
  const comprometido = sumar(items.map((i) => Math.max(i.plan, i.real))) + noPlaneado;
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
    ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: [], ingresoPlanId: null, cuentaDestinoId: null, creditoId: item.creditoId, capital: null,
  });
  // La cuota de un credito baja su saldo en la parte de capital.
  if (item.creditoId) {
    const credito = s.creditos.find((c) => c.id === item.creditoId);
    if (credito) {
      const interes = Math.round((credito.saldo * credito.tasaEM) / 100);
      const antes = credito.saldo;
      credito.saldo = Math.max(0, credito.saldo - Math.max(0, datos.monto - interes));
      credito.pagos.unshift({ fecha: datos.fecha, monto: datos.monto, tipo: 'CUOTA' });
      // Lo que bajo el saldo, para devolverlo si se borra el pago (design D3 de usabilidad-plan).
      s.movimientos.at(-1)!.capital = antes - credito.saldo;
    }
  }
  return s;
}

// --- Corregir y borrar registros (design D3 de usabilidad-plan) ------------------------------------------------------

const CORREGIBLES = new Set<Movimiento['tipo']>(['PAGO', 'GASTO', 'INGRESO_FIJO', 'APORTE']);

function registroDe(s: EstadoHogar, id: Id): Movimiento {
  const m = s.movimientos.find((x) => x.id === id);
  if (!m) throw new ReglaError('NO_EXISTE', 'Ese registro no existe');
  if (!CORREGIBLES.has(m.tipo)) throw new ReglaError('DATOS_INVALIDOS', 'Ese movimiento no se corrige desde aquí');
  asegurarAbierto(s, m.ref);
  return m;
}

/** Corregir un pago, gasto, ingreso recibido o aporte: el monto, la cuenta o la nota. Una cuota de credito no cambia su monto. */
export function corregirRegistro(estado: EstadoHogar, datos: { movimientoId: Id; monto?: Pesos; origen?: Origen; nota?: string }): EstadoHogar {
  const s = clonar(estado);
  const m = registroDe(s, datos.movimientoId);
  if (datos.monto !== undefined && datos.monto !== m.monto) {
    if (!(datos.monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El monto debe ser mayor que cero');
    if (m.tipo === 'PAGO' && m.creditoId) throw new ReglaError('DATOS_INVALIDOS', 'Para cambiar el monto de una cuota, borra el pago y márcalo otra vez');
    m.monto = datos.monto;
  }
  if (datos.origen) m.origen = datos.origen;
  if (datos.nota !== undefined && m.tipo === 'GASTO') m.nota = datos.nota.trim();
  if (m.tipo === 'APORTE') seguirAporte(s, m);
  return s;
}

/**
 * Borrar un pago, gasto, ingreso recibido o aporte. Su item vuelve a por pagar (o su linea a por recibir); una cuota devuelve su
 * capital al credito; un aporte se lleva su item de diezmo si no tiene pagos, o lo deja sin enlace.
 */
export function borrarRegistro(estado: EstadoHogar, datos: { movimientoId: Id }): EstadoHogar {
  const s = clonar(estado);
  const m = registroDe(s, datos.movimientoId);
  devolverCapital(s, m);
  s.movimientos = s.movimientos.filter((x) => x.id !== m.id);
  if (m.tipo === 'APORTE') {
    for (const plan of s.planes) {
      for (const esc of plan.escenarios) {
        for (const i of esc.items.filter((x) => x.aporteId === m.id)) {
          if (itemConPagos(s, plan.ref, i.id)) i.aporteId = null;
          else esc.items = esc.items.filter((x) => x.id !== i.id);
        }
      }
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
    ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: [], ingresoPlanId: null, cuentaDestinoId: null, creditoId: null, capital: null,
  });
  return s;
}

/** Vista previa de un gasto variable antes de guardarlo ("Mercado: llevas $244.000 de $320.000 con este gasto"). */
export function previsualizarGasto(estado: EstadoHogar, ref: MesRef, itemId: Id, monto: Pesos, hoy: Fecha): { llevado: Pesos; presupuesto: Pesos } {
  const e = ejecucionItem(estado, itemDelMes(estado, ref, itemId), ref, hoy);
  return { llevado: e.real + monto, presupuesto: e.plan };
}
