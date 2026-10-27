import type { EstadoHogar, Fecha, Id, MesRef, Movimiento, Pesos } from '../model';
import { formatFechaCorta, formatPorcentaje, nombreMes } from '../format';
import { ReglaError, clonar, nuevoId, sumar, sumarMeses } from './base';
import { anualDe, asegurarAbierto, cierreDe, esAporteImplicito, movimientosDe, nombreUsuario, reglaDe } from './consultas';

/** Linea de ingresos de un mes, tanto en Hoy como en Planear. */
export interface LineaIngreso {
  clave: string;
  tipo: 'FIJO' | 'APORTES' | 'PROYECCION' | 'EXTRA' | 'SOBRANTE';
  nombre: string;
  detalle: string;
  monto: Pesos;
  usuarioId: Id | null;
  /** FIJO: id del ingreso fijo y si ya se marco "Recibi". */
  ingresoFijoId: Id | null;
  recibido: boolean;
  /** Proyectado (se ve tenue). */
  tenue: boolean;
}

function base(m: Omit<LineaIngreso, 'usuarioId' | 'ingresoFijoId' | 'recibido' | 'tenue'> & Partial<LineaIngreso>): LineaIngreso {
  return { usuarioId: null, ingresoFijoId: null, recibido: false, tenue: false, ...m };
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

function fijos(estado: EstadoHogar, ref: MesRef, ejecucion: boolean): LineaIngreso[] {
  const movs = movimientosDe(estado, ref);
  return estado.ingresosFijos
    .filter((f) => f.activo)
    .map((f) => {
      const recibido = movs.find((m) => m.tipo === 'INGRESO_FIJO' && m.ingresoFijoId === f.id);
      // Al planear solo importa que es fijo; "recibido / llega" es de la ejecucion (Hoy).
      const detalle = !ejecucion ? 'Fijo' : recibido ? `Fijo · recibido ${formatFechaCorta(recibido.fecha)}` : `Fijo · llega el día ${f.diaPago}`;
      return base({
        clave: `fijo-${f.id}`,
        tipo: 'FIJO',
        nombre: f.nombre,
        detalle,
        monto: recibido ? recibido.monto : f.neto,
        usuarioId: f.usuarioId,
        ingresoFijoId: f.id,
        recibido: Boolean(recibido),
      });
    });
}

function extras(estado: EstadoHogar, ref: MesRef): LineaIngreso[] {
  return (anualDe(estado, ref.anio)?.eventos ?? [])
    .filter((e) => e.tipo === 'INGRESO' && e.mes === ref.mes)
    .map((e) => base({ clave: `extra-${e.id}`, tipo: 'EXTRA', nombre: e.nombre, detalle: 'Ingreso del año', monto: e.monto, usuarioId: e.usuarioId }));
}

function sobrante(estado: EstadoHogar, ref: MesRef): LineaIngreso[] {
  const anterior = sumarMeses(ref, -1);
  const cierre = cierreDe(estado, anterior);
  if (!cierre || cierre.aSiguiente <= 0) return [];
  return [base({ clave: 'sobrante', tipo: 'SOBRANTE', nombre: `Sobrante de ${nombreMes(anterior.mes)}`, detalle: 'Del cierre de mes', monto: cierre.aSiguiente })];
}

/**
 * Ingresos de un mes. `modo`:
 * - EJECUCION (Hoy): aportes reales agrupados por persona.
 * - PLANEACION (Planear): por persona, los aportes registrados o, si no hay, su proyeccion (tenue).
 * - PLAN (columna "plan" del cierre): la proyeccion cuando existe, si no lo registrado.
 */
export function ingresosDelMes(estado: EstadoHogar, ref: MesRef, modo: 'EJECUCION' | 'PLANEACION' | 'PLAN'): LineaIngreso[] {
  const lineas = [...fijos(estado, ref, modo === 'EJECUCION'), ...extras(estado, ref)];
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

// --- Diezmo -------------------------------------------------------------------

/** Diezmo que una regla saca de un monto (bruto o neto segun la regla). */
export function calcularDiezmo(porcentaje: number, bruto: Pesos, neto: Pesos, baseRegla: 'BRUTO' | 'NETO'): Pesos {
  return Math.round(((baseRegla === 'BRUTO' ? bruto : neto) * porcentaje) / 100);
}

/** Diezmo esperado del mes: fijos y extras de quien tiene regla, mas los aportes con diezmo. Se ve "Calculado" en el plan. */
export function diezmoPlaneado(estado: EstadoHogar, ref: MesRef): { monto: Pesos; detalle: string } {
  let monto = 0;
  const origenes: string[] = [];
  for (const f of estado.ingresosFijos.filter((x) => x.activo)) {
    const regla = reglaDe(estado, f.usuarioId);
    if (!regla) continue;
    monto += calcularDiezmo(regla.porcentaje, f.bruto, f.neto, regla.base);
    origenes.push(`${formatPorcentaje(regla.porcentaje)} de ${f.nombre}`);
  }
  for (const e of anualDe(estado, ref.anio)?.eventos ?? []) {
    if (e.tipo !== 'INGRESO' || e.mes !== ref.mes || !e.usuarioId) continue;
    const regla = reglaDe(estado, e.usuarioId);
    if (regla) monto += calcularDiezmo(regla.porcentaje, e.monto, e.monto, 'BRUTO');
  }
  for (const m of movimientosDe(estado, ref)) {
    if (m.tipo !== 'APORTE' || !m.aplicaDiezmo) continue;
    const regla = estado.reglas.find((r) => r.usuarioId === m.usuarioId);
    monto += Math.round((m.monto * (regla?.porcentaje ?? 10)) / 100);
  }
  return { monto, detalle: origenes.length ? `Calculado · ${origenes.join(' + ')}` : 'Calculado' };
}

export interface ObligacionDiezmo {
  /** Id del movimiento que la genera (ingreso recibido o aporte). */
  id: Id;
  monto: Pesos;
  detalle: string;
  usuarioId: Id;
  fecha: Fecha;
}

/** Obligaciones de diezmo pendientes del mes: se generan al recibir y se cierran con "Entregado". */
export function diezmosPendientes(estado: EstadoHogar, ref: MesRef): ObligacionDiezmo[] {
  const movs = movimientosDe(estado, ref);
  const entregadas = new Set(movs.filter((m) => m.tipo === 'DIEZMO_ENTREGADO').flatMap((m) => m.diezmoDe));
  const pendientes: ObligacionDiezmo[] = [];
  for (const m of movs) {
    if (!m.aplicaDiezmo || entregadas.has(m.id)) continue;
    const regla = estado.reglas.find((r) => r.usuarioId === m.usuarioId);
    if (!regla) continue;
    if (m.tipo === 'INGRESO_FIJO') {
      const fijo = estado.ingresosFijos.find((f) => f.id === m.ingresoFijoId);
      const monto = calcularDiezmo(regla.porcentaje, m.bruto ?? m.monto, m.monto, regla.base);
      pendientes.push({ id: m.id, monto, usuarioId: m.usuarioId, fecha: m.fecha, detalle: `${formatPorcentaje(regla.porcentaje)} de ${fijo?.nombre ?? 'ingreso'} · recibido ${formatFechaCorta(m.fecha)}` });
    } else if (m.tipo === 'APORTE') {
      pendientes.push({ id: m.id, monto: Math.round((m.monto * regla.porcentaje) / 100), usuarioId: m.usuarioId, fecha: m.fecha, detalle: `${formatPorcentaje(regla.porcentaje)} del aporte · ${formatFechaCorta(m.fecha)}` });
    }
  }
  return pendientes;
}

// --- Cambios --------------------------------------------------------------------

/** "Recibi": registra el ingreso fijo del mes y, si su dueño tiene regla, genera la obligacion de diezmo. */
export function marcarRecibido(estado: EstadoHogar, datos: { ingresoFijoId: Id; ref: MesRef; fecha: Fecha; creadoPor: Id; monto?: Pesos }): EstadoHogar {
  asegurarAbierto(estado, datos.ref);
  const s = clonar(estado);
  const fijo = s.ingresosFijos.find((f) => f.id === datos.ingresoFijoId);
  if (!fijo) throw new ReglaError('NO_EXISTE', 'No existe el ingreso fijo');
  if (s.movimientos.some((m) => m.tipo === 'INGRESO_FIJO' && m.ingresoFijoId === fijo.id && m.ref.anio === datos.ref.anio && m.ref.mes === datos.ref.mes)) {
    throw new ReglaError('YA_RECIBIDO', `${fijo.nombre} ya se marcó como recibido este mes`);
  }
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: 'INGRESO_FIJO', ref: datos.ref, monto: datos.monto ?? fijo.neto, fecha: datos.fecha,
    usuarioId: fijo.usuarioId, creadoPor: datos.creadoPor,
    origen: fijo.cuentaId ? { tipo: 'CUENTA', cuentaId: fijo.cuentaId } : { tipo: 'NINGUNO' },
    nota: '', itemId: null, ingresoFijoId: fijo.id, bruto: fijo.bruto, aplicaDiezmo: Boolean(reglaDe(s, fijo.usuarioId)),
    diezmoDe: [], cuentaDestinoId: null, creditoId: null,
  });
  return s;
}

/** Un aporte: quien, cuanto, para que mes y (opcional) a que cuenta. Suma al libre del mes elegido. */
export function registrarAporte(estado: EstadoHogar, datos: { usuarioId: Id; monto: Pesos; ref: MesRef; cuentaId: Id | null; aplicaDiezmo: boolean; fecha: Fecha; creadoPor: Id }): EstadoHogar {
  if (!(datos.monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El aporte debe ser mayor que cero');
  asegurarAbierto(estado, datos.ref);
  const s = clonar(estado);
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: 'APORTE', ref: datos.ref, monto: datos.monto, fecha: datos.fecha, usuarioId: datos.usuarioId,
    creadoPor: datos.creadoPor, origen: datos.cuentaId ? { tipo: 'CUENTA', cuentaId: datos.cuentaId } : { tipo: 'NINGUNO' },
    nota: '', itemId: null, ingresoFijoId: null, bruto: null, aplicaDiezmo: datos.aplicaDiezmo, diezmoDe: [], cuentaDestinoId: null, creditoId: null,
  });
  return s;
}

/** "Entregado": cierra una o varias obligaciones de diezmo (agrupado = todas las del mes). */
export function entregarDiezmo(estado: EstadoHogar, datos: { obligaciones: Id[]; ref: MesRef; fecha: Fecha; usuarioId: Id; cuentaId: Id | null }): EstadoHogar {
  asegurarAbierto(estado, datos.ref);
  const pendientes = diezmosPendientes(estado, datos.ref).filter((o) => datos.obligaciones.includes(o.id));
  if (!pendientes.length) throw new ReglaError('SIN_DIEZMO', 'No hay diezmo pendiente');
  const s = clonar(estado);
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: 'DIEZMO_ENTREGADO', ref: datos.ref, monto: sumar(pendientes.map((p) => p.monto)), fecha: datos.fecha,
    usuarioId: datos.usuarioId, creadoPor: datos.usuarioId, origen: datos.cuentaId ? { tipo: 'CUENTA', cuentaId: datos.cuentaId } : { tipo: 'NINGUNO' },
    nota: '', itemId: null, ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: pendientes.map((p) => p.id), cuentaDestinoId: null, creditoId: null,
  });
  return s;
}
