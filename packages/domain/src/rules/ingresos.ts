import type { Escenario, EstadoHogar, Fecha, Id, IngresoFijo, IngresoPlan, ItemPlan, MesRef, Movimiento, Pesos } from '../model';
import { formatFechaCorta, nombreMes } from '../format';
import { ReglaError, clonar, compararMes, mesDe, nuevoId, sumar, sumarMeses } from './base';
import { anualDe, asegurarAbierto, cierreDe, esAporteImplicito, escenarioPrincipal, movimientosDe, nombreUsuario, planDe, reglaDe } from './consultas';

/** Linea de ingresos de un mes, tanto en Hoy como en Planear. */
export interface LineaIngreso {
  clave: string;
  tipo: 'FIJO' | 'APORTES' | 'PROYECCION' | 'EXTRA' | 'OTRO' | 'SOBRANTE';
  nombre: string;
  detalle: string;
  monto: Pesos;
  usuarioId: Id | null;
  /** FIJO: id del ingreso fijo y si ya se marco "Recibi". */
  ingresoFijoId: Id | null;
  /** Linea de la opcion (FIJO, EXTRA u OTRO de un mes con plan): la que se edita en Planear y se recibe en Hoy. */
  lineaId: Id | null;
  recibido: boolean;
  /** Proyectado (se ve tenue). */
  tenue: boolean;
}

function base(m: Omit<LineaIngreso, 'usuarioId' | 'ingresoFijoId' | 'lineaId' | 'recibido' | 'tenue'> & Partial<LineaIngreso>): LineaIngreso {
  return { usuarioId: null, ingresoFijoId: null, lineaId: null, recibido: false, tenue: false, ...m };
}

function aportesReales(estado: EstadoHogar, ref: MesRef): Map<Id, Movimiento[]> {
  const porUsuario = new Map<Id, Movimiento[]>();
  for (const m of movimientosDe(estado, ref)) {
    if (m.tipo === 'APORTE' || esAporteImplicito(m)) {
      porUsuario.set(m.usuarioId, [...(porUsuario.get(m.usuarioId) ?? []), m]);
    }
  }
  return porUsuario;
}

function detalleAportes(movs: Movimiento[]): string {
  const directos = movs.filter(esAporteImplicito).length;
  const aportes = movs.length - directos;
  const partes: string[] = [];
  if (aportes) partes.push(`${aportes} ${aportes === 1 ? 'aporte' : 'aportes'}`);
  if (directos) partes.push(`${directos} ${directos === 1 ? 'pago directo' : 'pagos directos'}`);
  return partes.join(' · ');
}

/** Si un ingreso recibido corresponde a una linea: por la linea, o por su ingreso fijo (lo recibido antes de las lineas). */
export function recibeLinea(m: Movimiento, linea: IngresoPlan): boolean {
  return m.tipo === 'INGRESO_FIJO' && (m.ingresoPlanId === linea.id || (linea.ingresoFijoId !== null && m.ingresoFijoId === linea.ingresoFijoId));
}

const DETALLE_LINEA: Record<IngresoPlan['tipo'], string> = { FIJO: 'Fijo', EXTRA: 'Ingreso del año', OTRO: 'Agregado al plan' };

/** Las lineas de una opcion (design D8). En Hoy, cada una recibida o "por recibir"; lo recibido sin linea se muestra igual. */
function lineasDeOpcion(estado: EstadoHogar, ref: MesRef, esc: Escenario, ejecucion: boolean): LineaIngreso[] {
  const recibidos = movimientosDe(estado, ref).filter((m) => m.tipo === 'INGRESO_FIJO');
  const usados = new Set<Id>();
  const lineas = esc.ingresos.map((l) => {
    const recibido = ejecucion ? recibidos.find((m) => !usados.has(m.id) && recibeLinea(m, l)) : undefined;
    if (recibido) usados.add(recibido.id);
    const fijo = l.ingresoFijoId ? estado.ingresosFijos.find((f) => f.id === l.ingresoFijoId) : undefined;
    let detalle = DETALLE_LINEA[l.tipo];
    if (ejecucion) {
      if (recibido) detalle = `${l.tipo === 'FIJO' ? 'Fijo · recibido' : 'Recibido'} ${formatFechaCorta(recibido.fecha)}`;
      else detalle = fijo ? `Fijo · llega el día ${fijo.diaPago}` : 'Por recibir';
    }
    return base({
      clave: `linea-${l.id}`, tipo: l.tipo, nombre: l.nombre, detalle, monto: recibido ? recibido.monto : l.monto,
      usuarioId: l.usuarioId, ingresoFijoId: l.ingresoFijoId, lineaId: l.id, recibido: Boolean(recibido),
    });
  });
  if (ejecucion) {
    for (const m of recibidos.filter((x) => !usados.has(x.id))) {
      const fijo = estado.ingresosFijos.find((f) => f.id === m.ingresoFijoId);
      lineas.push(base({
        clave: `recibido-${m.id}`, tipo: fijo ? 'FIJO' : 'OTRO', nombre: fijo?.nombre ?? 'Ingreso', detalle: `Recibido ${formatFechaCorta(m.fecha)}`,
        monto: m.monto, usuarioId: m.usuarioId, ingresoFijoId: m.ingresoFijoId, recibido: true,
      }));
    }
  }
  return lineas;
}

/** Mes sin plan (o cerrado sin lineas): los fijos de Ajustes y los eventos del anual, como antes de las lineas. */
function fijosDeAjustes(estado: EstadoHogar, ref: MesRef, ejecucion: boolean): LineaIngreso[] {
  const movs = movimientosDe(estado, ref);
  const fijos = estado.ingresosFijos
    .filter((f) => f.activo)
    .map((f) => {
      const recibido = movs.find((m) => m.tipo === 'INGRESO_FIJO' && m.ingresoFijoId === f.id);
      // Al planear solo importa que es fijo; "recibido / llega" es de la ejecucion (Hoy).
      const detalle = !ejecucion ? 'Fijo' : recibido ? `Fijo · recibido ${formatFechaCorta(recibido.fecha)}` : `Fijo · llega el día ${f.diaPago}`;
      return base({ clave: `fijo-${f.id}`, tipo: 'FIJO', nombre: f.nombre, detalle, monto: recibido ? recibido.monto : f.neto, usuarioId: f.usuarioId, ingresoFijoId: f.id, recibido: Boolean(recibido) });
    });
  const extras = (anualDe(estado, ref.anio)?.eventos ?? [])
    .filter((e) => e.tipo === 'INGRESO' && e.mes === ref.mes)
    .map((e) => base({ clave: `extra-${e.id}`, tipo: 'EXTRA', nombre: e.nombre, detalle: 'Ingreso del año', monto: e.monto, usuarioId: e.usuarioId }));
  return [...fijos, ...extras];
}

function sobrante(estado: EstadoHogar, ref: MesRef): LineaIngreso[] {
  const anterior = sumarMeses(ref, -1);
  const cierre = cierreDe(estado, anterior);
  if (!cierre || cierre.aSiguiente <= 0) return [];
  return [base({ clave: 'sobrante', tipo: 'SOBRANTE', nombre: `Sobrante de ${nombreMes(anterior.mes)}`, detalle: 'Del cierre de mes', monto: cierre.aSiguiente })];
}

/**
 * Ingresos de un mes. `modo`:
 * - EJECUCION (Hoy): las lineas de la opcion en uso, recibidas o por recibir, y los aportes reales agrupados por persona.
 * - PLANEACION (Planear): las lineas de la opcion y, por persona, los aportes registrados o, si no hay, su proyeccion (tenue).
 * - PLAN (columna "plan" del cierre): las lineas y la proyeccion cuando existe, si no lo registrado.
 * `escenario` es la opcion que se ve; por defecto la principal del mes.
 */
export function ingresosDelMes(estado: EstadoHogar, ref: MesRef, modo: 'EJECUCION' | 'PLANEACION' | 'PLAN', escenario?: Escenario | null): LineaIngreso[] {
  const plan = planDe(estado, ref);
  const esc = escenario !== undefined ? escenario : plan ? escenarioPrincipal(plan) : null;
  // Un mes cerrado antes de las lineas (design D8) sigue leyendo sus ingresos como antes.
  const conLineas = esc && (esc.ingresos.length > 0 || plan?.estado !== 'CERRADO');
  const lineas = conLineas ? lineasDeOpcion(estado, ref, esc, modo === 'EJECUCION') : fijosDeAjustes(estado, ref, modo === 'EJECUCION');
  const reales = aportesReales(estado, ref);
  const usuarios = new Set<Id>([...reales.keys(), ...estado.proyecciones.filter((p) => p.ref.anio === ref.anio && p.ref.mes === ref.mes).map((p) => p.usuarioId)]);
  for (const usuarioId of usuarios) {
    const movs = reales.get(usuarioId) ?? [];
    const real = sumar(movs.map((m) => m.monto));
    const proyectado = estado.proyecciones.find((p) => p.usuarioId === usuarioId && p.ref.anio === ref.anio && p.ref.mes === ref.mes)?.monto ?? null;
    const nombre = nombreUsuario(estado, usuarioId);
    if (modo === 'EJECUCION') {
      if (movs.length) lineas.push(base({ clave: `aportes-${usuarioId}`, tipo: 'APORTES', nombre: `Aportes ${nombre}`, detalle: detalleAportes(movs), monto: real, usuarioId }));
    } else if (modo === 'PLAN' && proyectado !== null) {
      lineas.push(base({ clave: `proy-${usuarioId}`, tipo: 'PROYECCION', nombre: `Aportes ${nombre}`, detalle: 'Proyectado', monto: proyectado, usuarioId, tenue: true }));
    } else if (movs.length) {
      const ultimo = movs.reduce((a, b) => (a.fecha > b.fecha ? a : b));
      lineas.push(base({ clave: `aportes-${usuarioId}`, tipo: 'APORTES', nombre: `Aporte ${nombre}`, detalle: `Registrado el ${formatFechaCorta(ultimo.fecha)}`, monto: real, usuarioId }));
    } else if (proyectado !== null) {
      lineas.push(base({ clave: `proy-${usuarioId}`, tipo: 'PROYECCION', nombre: `Aportes ${nombre}`, detalle: 'Proyectado · se vuelve real al registrarlo', monto: proyectado, usuarioId, tenue: true }));
    }
  }
  lineas.push(...sobrante(estado, ref));
  return lineas;
}

export function totalIngresos(lineas: LineaIngreso[]): Pesos {
  return sumar(lineas.map((l) => l.monto));
}

/** Lineas con que nace una opcion (design D8): una por ingreso fijo activo (su neto) y una por evento de ingreso del anual del mes. */
export function ingresosNuevos(s: EstadoHogar, ref: MesRef): IngresoPlan[] {
  const fijos: IngresoPlan[] = s.ingresosFijos
    .filter((f) => f.activo)
    .map((f) => ({ id: nuevoId(s, 'ingp'), nombre: f.nombre, monto: f.neto, usuarioId: f.usuarioId, tipo: 'FIJO', ingresoFijoId: f.id, bruto: f.bruto }));
  const extras: IngresoPlan[] = (anualDe(s, ref.anio)?.eventos ?? [])
    .filter((e) => e.tipo === 'INGRESO' && e.mes === ref.mes)
    .map((e) => ({ id: nuevoId(s, 'ingp'), nombre: e.nombre, monto: e.monto, usuarioId: e.usuarioId, tipo: 'EXTRA', ingresoFijoId: null, bruto: e.monto }));
  return [...fijos, ...extras];
}

// --- Diezmo -------------------------------------------------------------------

/** Diezmo que una regla saca de un monto (bruto o neto segun la regla). */
export function calcularDiezmo(porcentaje: number, bruto: Pesos, neto: Pesos, baseRegla: 'BRUTO' | 'NETO'): Pesos {
  return Math.round(((baseRegla === 'BRUTO' ? bruto : neto) * porcentaje) / 100);
}

/** La categoria del sistema "Diezmo" (design D1 de diezmo-como-gasto). */
export function categoriaDiezmo(s: EstadoHogar): Id {
  const c = s.categorias.find((x) => x.tipo === 'DIEZMO');
  if (!c) throw new ReglaError('NO_EXISTE', 'El hogar no tiene la categoría Diezmo');
  return c.id;
}

function itemDiezmo(s: EstadoHogar, datos: { nombre: string; monto: Pesos; diaVence: number | null; ingresoFijoId?: Id; aporteId?: Id; ingresoPlanId?: Id }): ItemPlan {
  return {
    id: nuevoId(s, 'item'), categoriaId: categoriaDiezmo(s), nombre: datos.nombre, monto: datos.monto, diaVence: datos.diaVence, tipo: 'DIEZMO',
    cuota: null, creditoId: null, ingresoFijoId: datos.ingresoFijoId ?? null, aporteId: datos.aporteId ?? null,
    ingresoPlanId: datos.ingresoPlanId ?? null, ajustadoAMano: false,
  };
}

/** Porcentaje del diezmo de un aporte: el de la regla de quien aporto, activa o no (10 % si no tiene). */
function porcentajeAporte(s: EstadoHogar, usuarioId: Id): number {
  return s.reglas.find((r) => r.usuarioId === usuarioId)?.porcentaje ?? 10;
}

/** Item de diezmo de un aporte: el porcentaje de la regla de quien aporto (10 % si no tiene). */
function itemDiezmoAporte(s: EstadoHogar, aporte: Movimiento): ItemPlan {
  return itemDiezmo(s, { nombre: `Diezmo · aporte ${formatFechaCorta(aporte.fecha)}`, monto: Math.round((aporte.monto * porcentajeAporte(s, aporte.usuarioId)) / 100), diaVence: null, aporteId: aporte.id });
}

/**
 * El diezmo que sugiere una linea de ingreso (design D1 de usabilidad-plan): la regla activa de su persona sobre el bruto o el
 * monto de la linea segun la base; sin regla, el 10 % del monto, como en los aportes.
 */
export function diezmoSugerido(s: EstadoHogar, linea: IngresoPlan): Pesos {
  const regla = linea.usuarioId ? reglaDe(s, linea.usuarioId) : null;
  if (!regla) return Math.round((linea.monto * 10) / 100);
  return calcularDiezmo(regla.porcentaje, linea.bruto, linea.monto, regla.base);
}

/** Item de diezmo de una linea de ingreso, enlazado a ella. */
function itemDiezmoDeLinea(s: EstadoHogar, linea: IngresoPlan, diaVence: number | null): ItemPlan {
  return itemDiezmo(s, { nombre: `Diezmo · ${linea.nombre}`, monto: diezmoSugerido(s, linea), diaVence, ingresoFijoId: linea.ingresoFijoId ?? undefined, ingresoPlanId: linea.id });
}

/** Si un item ya tiene pagos o gastos en el mes de su plan. */
export function itemConPagos(s: EstadoHogar, ref: MesRef, itemId: Id): boolean {
  return movimientosDe(s, ref).some((m) => (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.itemId === itemId);
}

/**
 * El diezmo sigue a su linea (design D1): si no esta ajustado a mano ni tiene pagos, toma el monto sugerido, y su nombre si
 * seguia el de la linea. `nombreAnterior` es el de la linea antes del cambio. Muta el borrador.
 */
export function seguirLinea(s: EstadoHogar, ref: MesRef, esc: Escenario, linea: IngresoPlan, nombreAnterior: string): void {
  const item = esc.items.find((i) => i.tipo === 'DIEZMO' && i.ingresoPlanId === linea.id);
  if (!item || itemConPagos(s, ref, item.id)) return;
  if (item.nombre === `Diezmo · ${nombreAnterior}`) item.nombre = `Diezmo · ${linea.nombre}`;
  if (!item.ajustadoAMano) item.monto = diezmoSugerido(s, linea);
}

/**
 * Items de diezmo con que nace un mes (design D2 de diezmo-como-gasto, D1 de usabilidad-plan): uno por linea de un ingreso
 * fijo activo con regla y uno por linea de un evento de ingreso con un miembro con regla, enlazados a su linea, y uno por
 * aporte del mes con "Aplicar diezmo" que todavia no tenga item en `items`.
 */
export function diezmosDelMes(s: EstadoHogar, ref: MesRef, items: ItemPlan[], lineas: IngresoPlan[]): ItemPlan[] {
  const nuevos: ItemPlan[] = [];
  for (const linea of lineas) {
    if (linea.tipo === 'OTRO' || !linea.usuarioId || !reglaDe(s, linea.usuarioId)) continue;
    const fijo = linea.ingresoFijoId ? s.ingresosFijos.find((f) => f.id === linea.ingresoFijoId) : undefined;
    nuevos.push(itemDiezmoDeLinea(s, linea, fijo?.diaPago ?? null));
  }
  const conItem = new Set(items.map((i) => i.aporteId).filter((id) => id !== null));
  for (const m of movimientosDe(s, ref)) {
    if (m.tipo === 'APORTE' && m.aplicaDiezmo && !conItem.has(m.id)) nuevos.push(itemDiezmoAporte(s, m));
  }
  return nuevos;
}

/** Diezmo de una linea agregada a mano con "Aplicar diezmo" (design D1). */
export function diezmoDeLineaNueva(s: EstadoHogar, linea: IngresoPlan): ItemPlan {
  return itemDiezmoDeLinea(s, linea, null);
}

/**
 * Un ingreso fijo nuevo entra a la opcion principal del mes en curso si tiene plan y no esta cerrado, con su item de diezmo
 * si su dueño tiene regla activa (como la cuota de un credito nuevo, design D8 de diezmo-como-gasto). Muta el borrador.
 */
export function ingresoFijoAlMes(s: EstadoHogar, f: IngresoFijo, fecha: Fecha): void {
  const plan = planDe(s, mesDe(fecha));
  const principal = plan && plan.estado !== 'CERRADO' ? escenarioPrincipal(plan) : null;
  if (!principal) return;
  const linea: IngresoPlan = { id: nuevoId(s, 'ingp'), nombre: f.nombre, monto: f.neto, usuarioId: f.usuarioId, tipo: 'FIJO', ingresoFijoId: f.id, bruto: f.bruto };
  principal.ingresos.push(linea);
  if (reglaDe(s, f.usuarioId)) principal.items.push(itemDiezmoDeLinea(s, linea, f.diaPago));
}

/**
 * Un ingreso fijo editado (design D2 de usabilidad-plan): en los planes no cerrados desde `desde`, las lineas enlazadas que
 * todavia tenian el valor anterior y no se recibieron toman el nuevo, y su diezmo las sigue. Muta el borrador.
 */
export function ingresoFijoEditado(s: EstadoHogar, anterior: IngresoFijo, nuevo: IngresoFijo, desde: MesRef): void {
  for (const plan of s.planes) {
    if (plan.estado === 'CERRADO' || compararMes(plan.ref, desde) < 0) continue;
    const recibidos = movimientosDe(s, plan.ref).filter((m) => m.tipo === 'INGRESO_FIJO');
    for (const esc of plan.escenarios) {
      for (const linea of esc.ingresos) {
        if (linea.ingresoFijoId !== anterior.id || linea.monto !== anterior.neto || linea.bruto !== anterior.bruto) continue;
        if (recibidos.some((m) => recibeLinea(m, linea))) continue;
        const nombreAnterior = linea.nombre;
        linea.monto = nuevo.neto;
        linea.bruto = nuevo.bruto;
        if (linea.nombre === anterior.nombre) linea.nombre = nuevo.nombre;
        seguirLinea(s, plan.ref, esc, linea, nombreAnterior);
      }
    }
  }
}

/** Recalcula el diezmo de un aporte corregido, si no esta ajustado a mano ni tiene pagos. Muta el borrador. */
export function seguirAporte(s: EstadoHogar, aporte: Movimiento): void {
  for (const plan of s.planes) {
    for (const esc of plan.escenarios) {
      const item = esc.items.find((i) => i.aporteId === aporte.id);
      if (item && !item.ajustadoAMano && !itemConPagos(s, plan.ref, item.id)) item.monto = Math.round((aporte.monto * porcentajeAporte(s, aporte.usuarioId)) / 100);
    }
  }
}

// --- Cambios --------------------------------------------------------------------

/**
 * "Recibi" (design D8): una linea de la opcion principal del mes (`lineaId`) o, en un mes sin plan, un ingreso fijo. El monto es el que
 * llego (por defecto el de la linea o el neto). No genera obligacion de diezmo: el diezmo ya es un item del plan.
 */
export function marcarRecibido(estado: EstadoHogar, datos: { ref: MesRef; lineaId?: Id; ingresoFijoId?: Id; fecha: Fecha; creadoPor: Id; monto?: Pesos }): EstadoHogar {
  asegurarAbierto(estado, datos.ref);
  const s = clonar(estado);
  const movs = movimientosDe(s, datos.ref);
  let linea: IngresoPlan | null = null;
  if (datos.lineaId) {
    const plan = planDe(s, datos.ref);
    linea = (plan && escenarioPrincipal(plan)?.ingresos.find((l) => l.id === datos.lineaId)) || null;
    if (!linea) throw new ReglaError('NO_EXISTE', 'Ese ingreso no está en el plan del mes');
    if (movs.some((m) => recibeLinea(m, linea!))) throw new ReglaError('YA_RECIBIDO', `${linea.nombre} ya se marcó como recibido este mes`);
  }
  const fijoId = linea ? linea.ingresoFijoId : datos.ingresoFijoId ?? null;
  const fijo = fijoId ? s.ingresosFijos.find((f) => f.id === fijoId) : undefined;
  if (!linea && !fijo) throw new ReglaError('NO_EXISTE', 'No existe el ingreso fijo');
  if (!linea && movs.some((m) => m.tipo === 'INGRESO_FIJO' && m.ingresoFijoId === fijo!.id)) {
    throw new ReglaError('YA_RECIBIDO', `${fijo!.nombre} ya se marcó como recibido este mes`);
  }
  const monto = datos.monto ?? linea?.monto ?? fijo!.neto;
  if (!(monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El monto recibido debe ser mayor que cero');
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: 'INGRESO_FIJO', ref: datos.ref, monto, fecha: datos.fecha,
    usuarioId: linea?.usuarioId ?? fijo?.usuarioId ?? datos.creadoPor, creadoPor: datos.creadoPor,
    origen: fijo?.cuentaId ? { tipo: 'CUENTA', cuentaId: fijo.cuentaId } : { tipo: 'NINGUNO' },
    nota: '', itemId: null, ingresoFijoId: fijo?.id ?? null, bruto: fijo?.bruto ?? null, aplicaDiezmo: false,
    diezmoDe: [], ingresoPlanId: linea?.id ?? null, cuentaDestinoId: null, creditoId: null, capital: null,
  });
  return s;
}

/**
 * Un aporte: quien, cuanto, para que mes y (opcional) a que cuenta. Suma al libre del mes elegido. Con "Aplicar diezmo" gana su
 * item de diezmo en la opcion principal del mes si tiene plan abierto; si no, lo recoge `crearMes` (design D2).
 */
export function registrarAporte(estado: EstadoHogar, datos: { usuarioId: Id; monto: Pesos; ref: MesRef; cuentaId: Id | null; aplicaDiezmo: boolean; fecha: Fecha; creadoPor: Id }): EstadoHogar {
  if (!(datos.monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El aporte debe ser mayor que cero');
  asegurarAbierto(estado, datos.ref);
  const s = clonar(estado);
  const id = nuevoId(s, 'mov');
  const aporte: Movimiento = {
    id, seq: s.secuencia, tipo: 'APORTE', ref: datos.ref, monto: datos.monto, fecha: datos.fecha, usuarioId: datos.usuarioId,
    creadoPor: datos.creadoPor, origen: datos.cuentaId ? { tipo: 'CUENTA', cuentaId: datos.cuentaId } : { tipo: 'NINGUNO' },
    nota: '', itemId: null, ingresoFijoId: null, bruto: null, aplicaDiezmo: datos.aplicaDiezmo, diezmoDe: [], ingresoPlanId: null, cuentaDestinoId: null, creditoId: null, capital: null,
  };
  s.movimientos.push(aporte);
  const plan = planDe(s, datos.ref);
  const principal = datos.aplicaDiezmo && plan && plan.estado !== 'CERRADO' ? escenarioPrincipal(plan) : null;
  if (principal) principal.items.push(itemDiezmoAporte(s, aporte));
  return s;
}
