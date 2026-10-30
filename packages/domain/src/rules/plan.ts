import type { Escenario, EstadoHogar, EstadoMes, Fecha, Id, IngresoPlan, ItemPlan, MesRef, Pesos, PlanMes } from '../model';
import { formatCop, nombreMes, nombreMesCapital } from '../format';
import { libreAnualDelMes } from './anual';
import { ReglaError, clonar, compararMes, mesDe, nuevoId, sumar, sumarMeses } from './base';
import { cuotasDeCreditos } from './credito';
import { anualDe, categoria, cierreDe, escenario, escenarioPrincipal, nombreUsuario, opciones, planDe, planPorId } from './consultas';
import { diezmoDeLineaNueva, diezmoSugerido, diezmosDelMes, ingresosDelMes, ingresosNuevos, itemConPagos, recibeLinea, seguirLinea, totalIngresos, type LineaIngreso } from './ingresos';
import { devolverCapital } from './credito';

/** Un mes BORRADOR con opcion elegida pasa a ACTIVO cuando llega ("al iniciar el mes"). */
export function estadoEfectivo(plan: PlanMes, hoy: Fecha): EstadoMes {
  if (plan.estado === 'BORRADOR' && plan.escenarioActivoId && compararMes(plan.ref, mesDe(hoy)) <= 0) return 'ACTIVO';
  return plan.estado;
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function siguienteLetra(plan: PlanMes): string {
  const usadas = new Set(plan.escenarios.map((e) => e.letra));
  const libre = [...LETRAS].find((l) => !usadas.has(l));
  if (!libre) throw new ReglaError('MUCHAS_OPCIONES', 'No caben más opciones en este mes');
  return libre;
}

/** Copia los items con ids nuevos. Al crear un mes (`avanzarCuotas`) los de diezmo no se copian: se calculan de nuevo (design D2). */
function copiarItems(s: EstadoHogar, items: ItemPlan[], avanzarCuotas: boolean): ItemPlan[] {
  return items
    .filter((i) => !avanzarCuotas || i.tipo !== 'DIEZMO')
    .map((i) => ({ ...i, id: nuevoId(s, 'item'), cuota: i.cuota && avanzarCuotas ? { ...i.cuota, actual: i.cuota.actual + 1 } : i.cuota }))
    .filter((i) => !i.cuota || i.cuota.actual <= i.cuota.total);
}

function copiarIngresos(s: EstadoHogar, ingresos: IngresoPlan[]): IngresoPlan[] {
  return ingresos.map((l) => ({ ...l, id: nuevoId(s, 'ingp') }));
}

/** Copia una opcion: sus lineas y sus items, con el diezmo enlazado a la copia de su linea (design D1 de usabilidad-plan). */
function copiarOpcion(s: EstadoHogar, origen: Escenario): { ingresos: IngresoPlan[]; items: ItemPlan[] } {
  const ingresos = copiarIngresos(s, origen.ingresos);
  const nuevaDe = new Map(origen.ingresos.map((l, i) => [l.id, ingresos[i]!.id]));
  const items = copiarItems(s, origen.items, false).map((i) => (i.ingresoPlanId ? { ...i, ingresoPlanId: nuevaDe.get(i.ingresoPlanId) ?? null } : i));
  return { ingresos, items };
}

export type ModoNuevoMes = 'COPIAR' | 'FIJOS' | 'CERO';

/** Mes sin plan: crea el mes en BORRADOR con la Opcion A. */
export function crearMes(estado: EstadoHogar, datos: { ref: MesRef; modo: ModoNuevoMes; creadoPor: Id }): EstadoHogar {
  if (planDe(estado, datos.ref)) throw new ReglaError('YA_EXISTE', 'Ese mes ya tiene plan');
  const s = clonar(estado);
  const anterior = planDe(s, sumarMeses(datos.ref, -1));
  const principalAnterior = anterior ? escenarioPrincipal(anterior) : null;
  const base = principalAnterior?.items ?? [];
  let items: ItemPlan[] = [];
  if (datos.modo === 'COPIAR') items = copiarItems(s, base, true);
  if (datos.modo === 'FIJOS') items = copiarItems(s, base, true).map((i) => (i.tipo === 'VARIABLE' ? { ...i, monto: 0 } : i));
  // Los creditos con saldo traen su cuota en los tres modos; la de un credito ya pagado no se copia.
  const pagados = new Set(s.creditos.filter((c) => c.saldo <= 0).map((c) => c.id));
  items = cuotasDeCreditos(s, items.filter((i) => !i.creditoId || !pagados.has(i.creditoId)));
  // Las lineas de Ajustes y del anual se calculan de nuevo; las agregadas a mano se copian (design D8), con su diezmo si lo tenian.
  const copiadas = datos.modo === 'CERO' ? [] : (principalAnterior?.ingresos ?? []).filter((l) => l.tipo === 'OTRO');
  const nuevas = ingresosNuevos(s, datos.ref);
  const otras = copiarIngresos(s, copiadas);
  const ingresos = [...nuevas, ...otras];
  items = [...items, ...diezmosDelMes(s, datos.ref, items, nuevas)];
  copiadas.forEach((l, i) => {
    if (principalAnterior!.items.some((x) => x.tipo === 'DIEZMO' && x.ingresoPlanId === l.id)) items.push(diezmoDeLineaNueva(s, otras[i]!));
  });
  const id = nuevoId(s, 'plan');
  s.planes.push({
    id, ref: datos.ref, estado: 'BORRADOR', escenarioActivoId: null,
    escenarios: [{ id: nuevoId(s, 'esc'), letra: 'A', creadoPor: datos.creadoPor, nota: '', archivado: false, ingresos, items }],
  });
  return s;
}

/**
 * Varias opciones solo mientras el mes sigue en Borrador segun su estado efectivo: un mes futuro, o el mes en curso antes
 * de elegir opcion (design D1 de backend-opciones-mes). Asi los pagos de un mes Activo nunca quedan en una opcion archivada.
 */
function asegurarBorrador(plan: PlanMes, hoy: Fecha): void {
  if (plan.estado === 'CERRADO') throw new ReglaError('MES_CERRADO', 'El mes está cerrado');
  if (estadoEfectivo(plan, hoy) !== 'BORRADOR') {
    throw new ReglaError('MES_NO_BORRADOR', `${nombreMesCapital(plan.ref.mes)} ya está en curso; su plan no gana opciones`);
  }
}

/** Si alguno de los items de la opcion ya tiene pagos o gastos en su mes. */
function tienePagos(estado: EstadoHogar, plan: PlanMes, esc: Escenario): boolean {
  const ids = new Set(esc.items.map((i) => i.id));
  return estado.movimientos.some((m) => (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.itemId !== null && ids.has(m.itemId) && m.ref.anio === plan.ref.anio && m.ref.mes === plan.ref.mes);
}

export function duplicarEscenario(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; creadoPor: Id; hoy: Fecha; nota?: string }): EstadoHogar {
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  asegurarBorrador(plan, datos.hoy);
  const origen = escenario(plan, datos.escenarioId);
  plan.escenarios.push({ id: nuevoId(s, 'esc'), letra: siguienteLetra(plan), creadoPor: datos.creadoPor, nota: datos.nota ?? '', archivado: false, ...copiarOpcion(s, origen) });
  return s;
}

/**
 * "Usar esta": queda como el plan del mes; las demas se archivan, no se borran. En un mes Activo solo se puede volver a
 * elegir la que ya esta en uso, y en Borrador no se cambia a otra si la principal ya tiene pagos (design D1).
 */
export function usarEscenario(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; hoy: Fecha }): EstadoHogar {
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  if (plan.estado === 'CERRADO') throw new ReglaError('MES_CERRADO', 'El mes está cerrado');
  escenario(plan, datos.escenarioId);
  if (plan.escenarioActivoId === datos.escenarioId) return s;
  asegurarBorrador(plan, datos.hoy);
  const principal = escenarioPrincipal(plan);
  if (principal && principal.id !== datos.escenarioId && tienePagos(s, plan, principal)) {
    throw new ReglaError('MES_NO_BORRADOR', `${nombreMesCapital(plan.ref.mes)} ya tiene pagos en la Opción ${principal.letra}; no cambia de opción`);
  }
  plan.escenarioActivoId = datos.escenarioId;
  for (const e of plan.escenarios) e.archivado = e.id !== datos.escenarioId;
  return s;
}

/**
 * Quitar una opcion que ya no sirve (design D5 de backend-opciones-mes): se borra con sus items. No se quita la ultima
 * vigente, la que esta en uso ni una con pagos o gastos.
 */
export function quitarEscenario(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; hoy: Fecha }): EstadoHogar {
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  asegurarBorrador(plan, datos.hoy);
  const esc = escenario(plan, datos.escenarioId);
  if (plan.escenarioActivoId === esc.id) throw new ReglaError('OPCION_EN_USO', 'Esa opción está en uso; primero usa otra');
  if (!opciones(plan).some((o) => o.id !== esc.id)) throw new ReglaError('ULTIMA_OPCION', 'El mes necesita al menos una opción');
  if (tienePagos(s, plan, esc)) throw new ReglaError('OPCION_CON_PAGOS', 'Esa opción ya tiene pagos este mes; no se puede quitar');
  plan.escenarios = plan.escenarios.filter((e) => e.id !== esc.id);
  return s;
}

function escenarioEditable(s: EstadoHogar, planId: Id, escenarioId: Id): Escenario {
  const plan = planPorId(s, planId);
  if (plan.estado === 'CERRADO') throw new ReglaError('MES_CERRADO', 'El mes está cerrado');
  return escenario(plan, escenarioId);
}

export function guardarItem(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; item: Omit<ItemPlan, 'id'> & { id?: Id } }): EstadoHogar {
  if (datos.item.monto < 0) throw new ReglaError('MONTO_INVALIDO', 'El monto no puede ser negativo');
  if (!datos.item.nombre.trim()) throw new ReglaError('NOMBRE_REQUERIDO', 'El gasto necesita un nombre');
  const s = clonar(estado);
  categoria(s, datos.item.categoriaId);
  const esc = escenarioEditable(s, datos.planId, datos.escenarioId);
  const existente = datos.item.id ? esc.items.find((i) => i.id === datos.item.id) : undefined;
  if (existente) {
    // Los enlaces del diezmo no cambian al editar; cambiar su monto lo deja "ajustado a mano" (design D1 de usabilidad-plan).
    const { ingresoFijoId, aporteId, ingresoPlanId } = existente;
    const linea = ingresoPlanId ? esc.ingresos.find((l) => l.id === ingresoPlanId) : undefined;
    const ajustado = linea && datos.item.monto !== existente.monto ? datos.item.monto !== diezmoSugerido(s, linea) : existente.ajustadoAMano;
    Object.assign(existente, datos.item, { ingresoFijoId, aporteId, ingresoPlanId, ajustadoAMano: ajustado });
  } else {
    esc.items.push({ ...datos.item, ingresoPlanId: null, ajustadoAMano: false, id: nuevoId(s, 'item') } as ItemPlan);
  }
  return s;
}

/** "Volver a calcular": el diezmo vuelve al monto que sugiere su linea y deja de estar ajustado a mano. */
export function recalcularDiezmo(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; itemId: Id }): EstadoHogar {
  const s = clonar(estado);
  const esc = escenarioEditable(s, datos.planId, datos.escenarioId);
  const item = esc.items.find((i) => i.id === datos.itemId);
  const linea = item?.ingresoPlanId ? esc.ingresos.find((l) => l.id === item.ingresoPlanId) : undefined;
  if (!item || !linea) throw new ReglaError('NO_EXISTE', 'Ese diezmo no viene de un ingreso del plan');
  item.monto = diezmoSugerido(s, linea);
  item.ajustadoAMano = false;
  return s;
}

/** "+ Ingreso" o editar una linea de ingreso de una opcion (design D8): no toca Ajustes, ni otros meses, ni otras opciones. */
export function guardarIngresoPlan(
  estado: EstadoHogar,
  datos: { planId: Id; escenarioId: Id; ingreso: Omit<IngresoPlan, 'id'> & { id?: Id }; aplicarDiezmo?: boolean },
): EstadoHogar {
  const nombre = datos.ingreso.nombre.trim();
  if (!nombre || nombre.length > 60) throw new ReglaError('NOMBRE_REQUERIDO', 'El ingreso necesita un nombre de hasta 60 caracteres');
  if (!(datos.ingreso.monto >= 0) || !(datos.ingreso.bruto >= 0)) throw new ReglaError('MONTO_INVALIDO', 'El monto no puede ser negativo');
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  const esc = escenarioEditable(s, datos.planId, datos.escenarioId);
  const existente = datos.ingreso.id ? esc.ingresos.find((l) => l.id === datos.ingreso.id) : undefined;
  if (existente) {
    // Conserva su tipo y su ingreso fijo; su diezmo la sigue (design D1 de usabilidad-plan).
    const anterior = existente.nombre;
    Object.assign(existente, datos.ingreso, { nombre, tipo: existente.tipo, ingresoFijoId: existente.ingresoFijoId });
    seguirLinea(s, plan.ref, esc, existente, anterior);
  } else {
    const linea: IngresoPlan = { ...datos.ingreso, nombre, id: nuevoId(s, 'ingp') };
    esc.ingresos.push(linea);
    if (datos.aplicarDiezmo) esc.items.push(diezmoDeLineaNueva(s, linea));
  }
  return s;
}

/** Quitar una linea de ingreso; una ya recibida en su mes no se quita. */
export function quitarIngresoPlan(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; ingresoId: Id }): EstadoHogar {
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  const esc = escenarioEditable(s, datos.planId, datos.escenarioId);
  const linea = esc.ingresos.find((l) => l.id === datos.ingresoId);
  if (!linea) return s;
  if (s.movimientos.some((m) => m.ref.anio === plan.ref.anio && m.ref.mes === plan.ref.mes && recibeLinea(m, linea))) {
    throw new ReglaError('INGRESO_RECIBIDO', `${linea.nombre} ya se recibió este mes; no se puede quitar`);
  }
  esc.ingresos = esc.ingresos.filter((l) => l.id !== datos.ingresoId);
  // Su diezmo se va con ella si no tiene pagos; si los tiene, queda sin enlace (design D1 de usabilidad-plan).
  for (const i of esc.items.filter((x) => x.ingresoPlanId === linea.id)) {
    if (itemConPagos(s, plan.ref, i.id)) i.ingresoPlanId = null;
    else esc.items = esc.items.filter((x) => x.id !== i.id);
  }
  return s;
}

export function quitarItem(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; itemId: Id }): EstadoHogar {
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  const esc = escenarioEditable(s, datos.planId, datos.escenarioId);
  if (itemConPagos(s, plan.ref, datos.itemId)) throw new ReglaError('ITEM_CON_PAGOS', 'Este gasto ya tiene pagos este mes; no se puede quitar');
  esc.items = esc.items.filter((i) => i.id !== datos.itemId);
  return s;
}

/** Lo que se borra con el plan de un mes, para la confirmacion (design D4 de usabilidad-plan). */
export interface ConteoBorrado {
  pagos: number;
  gastos: number;
  ingresos: number;
  cerrado: boolean;
}

const TIPOS_DEL_PLAN = new Set(['PAGO', 'GASTO', 'INGRESO_FIJO']);

export function conteoBorrado(estado: EstadoHogar, ref: MesRef): ConteoBorrado {
  const movs = estado.movimientos.filter((m) => m.ref.anio === ref.anio && m.ref.mes === ref.mes);
  return {
    pagos: movs.filter((m) => m.tipo === 'PAGO').length,
    gastos: movs.filter((m) => m.tipo === 'GASTO').length,
    ingresos: movs.filter((m) => m.tipo === 'INGRESO_FIJO').length,
    cerrado: Boolean(cierreDe(estado, ref)),
  };
}

/**
 * "Borrar plan de {mes}" (design D4): el plan, sus pagos, gastos e ingresos recibidos, y su cierre. Los aportes, ajustes,
 * transferencias y abonos se conservan; una cuota borrada devuelve su capital al credito.
 */
export function borrarPlan(estado: EstadoHogar, ref: MesRef): EstadoHogar {
  if (!planDe(estado, ref) && !cierreDe(estado, ref)) throw new ReglaError('NO_EXISTE', 'Ese mes no tiene plan');
  const s = clonar(estado);
  const delMes = (x: { ref: MesRef }) => x.ref.anio === ref.anio && x.ref.mes === ref.mes;
  for (const m of s.movimientos.filter((x) => delMes(x) && TIPOS_DEL_PLAN.has(x.tipo))) devolverCapital(s, m);
  s.movimientos = s.movimientos.filter((m) => !(delMes(m) && TIPOS_DEL_PLAN.has(m.tipo)));
  s.planes = s.planes.filter((p) => !delMes(p));
  s.cierres = s.cierres.filter((c) => !delMes(c));
  return s;
}

// --- Vistas ------------------------------------------------------------------------

export interface GrupoCategoria {
  categoriaId: Id;
  nombre: string;
  color: string;
  total: Pesos;
  items: ItemPlan[];
}

export interface VistaOpcion {
  escenario: Escenario;
  autor: string;
  /** Inicial del autor si no es el usuario actual (la pestaña "Opción B · E"). */
  inicialAutor: string;
  ingresos: LineaIngreso[];
  totalIngresos: Pesos;
  grupos: GrupoCategoria[];
  totalGastos: Pesos;
  libre: Pesos;
}

export function gruposDe(estado: EstadoHogar, items: ItemPlan[]): GrupoCategoria[] {
  return [...estado.categorias]
    .sort((a, b) => a.orden - b.orden)
    .map((c) => {
      const propios = items.filter((i) => i.categoriaId === c.id);
      return { categoriaId: c.id, nombre: c.nombre, color: c.color, total: sumar(propios.map((i) => i.monto)), items: propios };
    })
    .filter((g) => g.items.length > 0);
}

export function vistaOpcion(estado: EstadoHogar, ref: MesRef, esc: Escenario): VistaOpcion {
  const ingresos = ingresosDelMes(estado, ref, 'PLANEACION', esc);
  const totalGastos = sumar(esc.items.map((i) => i.monto));
  const total = totalIngresos(ingresos);
  const autor = estado.usuarios.find((u) => u.id === esc.creadoPor);
  return { escenario: esc, autor: autor?.nombre ?? '', inicialAutor: autor?.inicial ?? '', ingresos, totalIngresos: total, grupos: gruposDe(estado, esc.items), totalGastos, libre: total - totalGastos };
}

export function vistasOpciones(estado: EstadoHogar, ref: MesRef): VistaOpcion[] {
  const plan = planDe(estado, ref);
  return plan ? opciones(plan).map((e) => vistaOpcion(estado, ref, e)) : [];
}

export interface FilaComparacion {
  clave: string;
  nombre: string;
  /** "B suma Regalos de Navidad", "Solo en B". */
  nota: string;
  valores: (Pesos | null)[];
  cambia: boolean;
}

/** Comparar: lado a lado, solo resalta lo que cambia; lo igual se agrupa en "Sin cambios". */
export function compararOpciones(estado: EstadoHogar, ref: MesRef): { letras: string[]; vistas: VistaOpcion[]; ingresos: FilaComparacion; filas: FilaComparacion[]; sinCambios: FilaComparacion | null; libre: Pesos[] } {
  const vistas = vistasOpciones(estado, ref);
  const letras = vistas.map((v) => v.escenario.letra);
  const ingresos: FilaComparacion = { clave: 'ingresos', nombre: 'Ingresos', nota: '', valores: vistas.map((v) => v.totalIngresos), cambia: new Set(vistas.map((v) => v.totalIngresos)).size > 1 };
  const filas: FilaComparacion[] = [];
  const iguales: string[] = [];
  let igualesTotal: (Pesos | null)[] = vistas.map(() => 0);
  const categorias = [...estado.categorias].sort((a, b) => a.orden - b.orden);
  for (const c of categorias) {
    const valores = vistas.map((v) => v.grupos.find((g) => g.categoriaId === c.id)?.total ?? null);
    if (valores.every((v) => v === null)) continue;
    const distintos = new Set(valores.map((v) => v ?? 0)).size > 1;
    if (!distintos) {
      iguales.push(c.nombre);
      igualesTotal = igualesTotal.map((t, i) => (t ?? 0) + (valores[i] ?? 0));
      continue;
    }
    filas.push({ clave: c.id, nombre: c.nombre, nota: notaDiferencia(vistas, c.id), valores, cambia: true });
  }
  const sinCambios = iguales.length ? { clave: 'sin-cambios', nombre: 'Sin cambios', nota: iguales.join(', '), valores: igualesTotal, cambia: false } : null;
  return { letras, vistas, ingresos, filas, sinCambios, libre: vistas.map((v) => v.libre) };
}

function notaDiferencia(vistas: VistaOpcion[], categoriaId: Id): string {
  const conjuntos = vistas.map((v) => v.grupos.find((g) => g.categoriaId === categoriaId)?.items ?? []);
  const presentes = vistas.filter((_, i) => conjuntos[i]!.length > 0);
  if (presentes.length === 1) return `Solo en ${presentes[0]!.escenario.letra}`;
  const base = conjuntos[0]!;
  for (let i = 1; i < vistas.length; i++) {
    const extra = conjuntos[i]!.filter((it) => !base.some((b) => b.nombre === it.nombre && b.monto === it.monto));
    if (extra.length) {
      const letra = vistas[i]!.escenario.letra;
      const it = extra[0]!;
      const previo = base.find((b) => b.nombre === it.nombre);
      const nombre = it.nombre.charAt(0).toLowerCase() + it.nombre.slice(1);
      return previo ? `${letra} cambia ${nombre} a ${formatCop(it.monto)}` : `${letra} suma ${nombre}`;
    }
  }
  return '';
}

export interface ResumenMesPlan {
  ref: MesRef;
  plan: PlanMes | null;
  estado: EstadoMes | 'SIN_PLAN';
  /** "Borrador · 3 opciones", "Activo · Opción A", "Cerrado · sobró $1.840.000", "Sin plan", "Saldrá del plan anual". */
  detalle: string;
  /** Libre de la opcion (o rango "min – max" si hay varias), sobrante si cerro, o el del plan anual. */
  libre: Pesos[];
}

/** Planear inicio: proximos meses y este mes y anteriores. */
export function planInicio(estado: EstadoHogar, hoy: Fecha, meses = 3, anteriores = 2): { proximos: ResumenMesPlan[]; recientes: ResumenMesPlan[] } {
  const actual = mesDe(hoy);
  const resumen = (ref: MesRef): ResumenMesPlan => {
    const plan = planDe(estado, ref);
    if (!plan) {
      const anual = anualDe(estado, ref.anio);
      if (anual && anual.estado === 'BORRADOR' && anual.filas.length) {
        return { ref, plan: null, estado: 'SIN_PLAN', detalle: 'Saldrá del plan anual', libre: [libreAnualDelMes(estado, ref)] };
      }
      return { ref, plan: null, estado: 'SIN_PLAN', detalle: 'Sin plan', libre: [] };
    }
    const est = estadoEfectivo(plan, hoy);
    if (est === 'CERRADO') {
      const cierre = cierreDe(estado, ref);
      return { ref, plan, estado: est, detalle: `Cerrado · sobró ${formatCop(cierre?.sobrante ?? 0)}`, libre: [cierre?.sobrante ?? 0] };
    }
    const vistas = vistasOpciones(estado, ref);
    if (est === 'ACTIVO') {
      const elegida = escenarioPrincipal(plan);
      return { ref, plan, estado: est, detalle: `Activo · Opción ${elegida?.letra ?? 'A'}`, libre: vistas.filter((v) => v.escenario.id === elegida?.id).map((v) => v.libre) };
    }
    const libres = vistas.map((v) => v.libre);
    return { ref, plan, estado: est, detalle: `Borrador · ${vistas.length} ${vistas.length === 1 ? 'opción' : 'opciones'}`, libre: libres.length > 1 ? [Math.min(...libres), Math.max(...libres)] : libres };
  };
  return {
    proximos: Array.from({ length: meses }, (_, i) => resumen(sumarMeses(actual, i + 1))),
    recientes: Array.from({ length: anteriores + 1 }, (_, i) => resumen(sumarMeses(actual, -i))),
  };
}

/** Lo que un mes sin plan "ya trae": ingresos extra del año, su diezmo y el sobrante del mes anterior. */
export function loQueTraeElMes(estado: EstadoHogar, ref: MesRef): { nombre: string; detalle: string; monto: Pesos | null }[] {
  const lineas: { nombre: string; detalle: string; monto: Pesos | null }[] = [];
  for (const e of anualDe(estado, ref.anio)?.eventos ?? []) {
    if (e.tipo !== 'INGRESO' || e.mes !== ref.mes) continue;
    lineas.push({ nombre: e.nombre, detalle: '', monto: e.monto });
    const regla = e.usuarioId ? estado.reglas.find((r) => r.usuarioId === e.usuarioId && r.activa) : null;
    if (regla) lineas.push({ nombre: `Diezmo de la ${e.nombre.toLowerCase()}`, detalle: '', monto: -Math.round((e.monto * regla.porcentaje) / 100) });
  }
  const anterior = sumarMeses(ref, -1);
  const cierre = cierreDe(estado, anterior);
  const mesAnterior = nombreMes(anterior.mes);
  if (cierre) {
    if (cierre.aSiguiente > 0) lineas.push({ nombre: `Sobrante de ${mesAnterior}`, detalle: 'del cierre', monto: cierre.aSiguiente });
  } else {
    lineas.push({ nombre: `Sobrante de ${mesAnterior}`, detalle: `al cerrar ${mesAnterior}`, monto: null });
  }
  return lineas;
}

/**
 * "Probarlo como opción de {mes}" (detalle de credito): una opcion nueva del mes, copia de la principal,
 * con el abono extra en Creditos. Si el mes no tiene plan, se crea copiando el anterior.
 */
export function probarAbonoComoOpcion(estado: EstadoHogar, datos: { creditoId: Id; ref: MesRef; abono: Pesos; creadoPor: Id; hoy: Fecha }): { estado: EstadoHogar; planId: Id; escenarioId: Id } {
  if (!(datos.abono > 0)) throw new ReglaError('MONTO_INVALIDO', 'Escribe el abono');
  const credito = estado.creditos.find((c) => c.id === datos.creditoId);
  if (!credito) throw new ReglaError('NO_EXISTE', 'No existe el crédito');
  let s = planDe(estado, datos.ref) ? estado : crearMes(estado, { ref: datos.ref, modo: 'COPIAR', creadoPor: datos.creadoPor });
  const plan = planDe(s, datos.ref)!;
  const base = escenarioPrincipal(plan)!;
  s = duplicarEscenario(s, { planId: plan.id, escenarioId: base.id, creadoPor: datos.creadoPor, hoy: datos.hoy, nota: 'abono a crédito' });
  const nueva = planDe(s, datos.ref)!.escenarios.at(-1)!;
  const categoriaCreditos = s.categorias.find((c) => c.tipo === 'CREDITO') ?? s.categorias[0]!;
  s = guardarItem(s, {
    planId: plan.id, escenarioId: nueva.id,
    item: { categoriaId: categoriaCreditos.id, nombre: `Abono extra ${credito.nombre.toLowerCase()}`, monto: datos.abono, diaVence: credito.diaPago, tipo: 'CREDITO', cuota: null, creditoId: credito.id, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false },
  });
  return { estado: s, planId: plan.id, escenarioId: nueva.id };
}

export function nombreAutor(estado: EstadoHogar, esc: Escenario): string {
  return nombreUsuario(estado, esc.creadoPor);
}
