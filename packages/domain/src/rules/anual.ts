import type { BaseAnual, EstadoHogar, EventoAnual, Fecha, Id, ItemPlan, MesRef, Pesos, PlanAnual } from '../model';
import { formatCop, formatPorcentaje, nombreMesCapital } from '../format';
import { ReglaError, clonar, compararMes, mesDe, mismoMes, nuevoId, sumar } from './base';
import { anualDe, cierreDe, escenarioPrincipal, eventosDelMes, nombreUsuario, planDe, reglaDe } from './consultas';
import { calcularDiezmo, diezmosDelMes, ingresosNuevos } from './ingresos';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
export const CATEGORIA_EVENTOS = 'Eventos del año';

export interface FilaAnualVista {
  clave: string;
  nombre: string;
  detalle: string;
  valores: Pesos[];
  /** Mes por mes: si es distinto del mes base (un evento lo toca o la celda cambio). */
  cambia: boolean[];
  /** Proyectado (aportes): se ve tenue. */
  tenue: boolean;
  /** Calculado (diezmo): no editable. */
  calculado: boolean;
  /** La categoria de la fila, cuando su celda se puede editar. */
  categoriaId: Id | null;
  /** La persona de una fila de aportes proyectados. */
  usuarioId: Id | null;
}

/** Un evento del año en la lista "Lo que cambia". */
export interface VistaCambio {
  evento: EventoAnual;
  /** "Eventos del año", "Variables" o "Ingreso de Daniel". */
  donde: string;
  /** El diezmo que saca un ingreso con regla; 0 si no tiene. */
  diezmo: Pesos;
  /** "Matrícula −$1.800.000", "Prima +$3.500.000". */
  texto: string;
}

/** Un mes, o varios seguidos sin cambios, en la lista de meses (vista angosta). */
export interface MesesAnualVista {
  desde: number;
  hasta: number;
  libre: Pesos;
  cambios: string[];
}

export interface ResumenAnual {
  anio: number;
  estado: 'BORRADOR' | 'CREADO';
  base: MesRef | null;
  ingresos: FilaAnualVista[];
  gastos: FilaAnualVista[];
  diezmo: FilaAnualVista;
  eventos: FilaAnualVista | null;
  libre: Pesos[];
  cambios: VistaCambio[];
  meses: MesesAnualVista[];
  kpis: {
    libreAnio: Pesos;
    mesApretado: { mes: number; libre: Pesos };
    diezmoAnio: Pesos;
    /** Lo que suben (o bajan) los cambios frente a repetir el mes base 12 veces. */
    porCambios: Pesos;
  };
}

/** El valor que mas se repite en la fila: la referencia para saber que celdas cambian (design D4). */
function moda(valores: readonly Pesos[]): Pesos {
  const cuenta = new Map<Pesos, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor = valores[0] ?? 0;
  for (const [v, n] of cuenta) if (n > (cuenta.get(mejor) ?? 0)) mejor = v;
  return mejor;
}

function esEventos(estado: EstadoHogar, categoriaId: Id | null): boolean {
  return !categoriaId || estado.categorias.find((c) => c.id === categoriaId)?.nombre === CATEGORIA_EVENTOS;
}

function diezmoDeEvento(estado: EstadoHogar, e: EventoAnual): Pesos {
  if (e.tipo !== 'INGRESO' || !e.usuarioId) return 0;
  const regla = reglaDe(estado, e.usuarioId);
  return regla ? calcularDiezmo(regla.porcentaje, e.monto, e.monto, 'BRUTO') : 0;
}

function textoEvento(e: EventoAnual): string {
  return `${e.nombre} ${e.tipo === 'GASTO' ? formatCop(-e.monto) : formatCop(e.monto, { signo: true })}`;
}

export function resumenAnual(estado: EstadoHogar, anio: number): ResumenAnual | null {
  const anual = anualDe(estado, anio);
  if (!anual) return null;
  const delMes = MESES.map((m) => eventosDelMes(anual, m));
  const fila = (f: Omit<FilaAnualVista, 'cambia' | 'tenue' | 'calculado' | 'categoriaId' | 'usuarioId'> & Partial<FilaAnualVista>): FilaAnualVista =>
    ({ cambia: f.valores.map(() => false), tenue: false, calculado: false, categoriaId: null, usuarioId: null, ...f });

  const ingresos: FilaAnualVista[] = [];
  for (const f of estado.ingresosFijos.filter((x) => x.activo)) {
    ingresos.push(fila({ clave: `fijo-${f.id}`, nombre: f.nombre, detalle: '', valores: MESES.map(() => f.neto) }));
  }
  const extras = anual.eventos.filter((e) => e.tipo === 'INGRESO');
  for (const nombre of new Set(extras.map((e) => e.nombre))) {
    const valores = MESES.map((_, i) => sumar(delMes[i]!.filter((e) => e.tipo === 'INGRESO' && e.nombre === nombre).map((e) => e.monto)));
    ingresos.push(fila({ clave: `extra-${nombre}`, nombre, detalle: '', valores, cambia: valores.map((v) => v > 0) }));
  }
  // Una fila de aportes por miembro, aunque no tenga proyecciones, para poder llenarla (backend-plan-anual D1).
  const proyectados = estado.proyecciones.filter((p) => p.ref.anio === anio);
  for (const usuarioId of new Set([...estado.hogar.miembros.map((m) => m.usuarioId), ...proyectados.map((p) => p.usuarioId)])) {
    const valores = MESES.map((m) => proyectados.find((p) => p.usuarioId === usuarioId && p.ref.mes === m)?.monto ?? 0);
    const referencia = moda(valores);
    ingresos.push(fila({
      clave: `proy-${usuarioId}`, nombre: `Aportes ${nombreUsuario(estado, usuarioId)}`, detalle: 'Proyectado · se vuelve real al registrarlo',
      valores, cambia: valores.map((v) => v !== referencia), tenue: true, usuarioId,
    }));
  }

  const categorias = new Map(estado.categorias.map((c) => [c.id, c]));
  // Una fila por categoria del hogar (las nuevas en $0); "Eventos del año" va en su propia fila.
  const conFila = new Set(anual.filas.map((f) => f.categoriaId));
  const filas = [
    ...anual.filas,
    ...[...categorias.values()].filter((c) => !conFila.has(c.id) && c.nombre !== CATEGORIA_EVENTOS && c.tipo !== 'DIEZMO').sort((a, b) => a.orden - b.orden).map((c) => ({ categoriaId: c.id, montos: MESES.map(() => 0) })),
  ];
  // Los gastos con categoria se suman a su fila (design D3).
  const gastoEn = (categoriaId: Id, i: number) => delMes[i]!.filter((e) => e.tipo === 'GASTO' && e.categoriaId === categoriaId && !esEventos(estado, categoriaId));
  const gastos: FilaAnualVista[] = filas.map((f) => {
    const referencia = moda(f.montos);
    return fila({
      clave: f.categoriaId, nombre: categorias.get(f.categoriaId)?.nombre ?? '', detalle: '', categoriaId: f.categoriaId,
      valores: f.montos.map((v, i) => v + sumar(gastoEn(f.categoriaId, i).map((e) => e.monto))),
      cambia: f.montos.map((v, i) => v !== referencia || gastoEn(f.categoriaId, i).length > 0),
    });
  });

  let detalleDiezmo = '';
  let diezmoFijos = 0;
  for (const f of estado.ingresosFijos.filter((x) => x.activo)) {
    const regla = reglaDe(estado, f.usuarioId);
    if (!regla) continue;
    diezmoFijos += calcularDiezmo(regla.porcentaje, f.bruto, f.neto, regla.base);
    detalleDiezmo = `Calculado · ${formatPorcentaje(regla.porcentaje)} del ${regla.base === 'BRUTO' ? 'bruto' : 'neto'}`;
  }
  const diezmo = MESES.map((_, i) => diezmoFijos + sumar(delMes[i]!.map((e) => diezmoDeEvento(estado, e))));

  const sinCategoria = (i: number) => delMes[i]!.filter((e) => e.tipo === 'GASTO' && esEventos(estado, e.categoriaId));
  const gastosEventos = anual.eventos.filter((e) => e.tipo === 'GASTO' && esEventos(estado, e.categoriaId));
  const valoresEventos = MESES.map((_, i) => sumar(sinCategoria(i).map((e) => e.monto)));
  const eventos = gastosEventos.length
    ? fila({ clave: 'eventos', nombre: CATEGORIA_EVENTOS, detalle: [...new Set(gastosEventos.map((e) => e.nombre))].join(' · '), valores: valoresEventos, cambia: valoresEventos.map((v) => v > 0) })
    : null;

  const libre = MESES.map((_, i) => sumar(ingresos.map((f) => f.valores[i]!)) - sumar(gastos.map((f) => f.valores[i]!)) - diezmo[i]! - (eventos?.valores[i] ?? 0));
  const minimo = libre.reduce((min, v, i) => (v < libre[min]! ? i : min), 0);

  // El mes base repetido: fijos y la referencia de cada fila, sin eventos.
  const ingresoBase = sumar(estado.ingresosFijos.filter((x) => x.activo).map((f) => f.neto)) + sumar(ingresos.filter((f) => f.tenue).map((f) => moda(f.valores)));
  const libreBase = ingresoBase - sumar(filas.map((f) => moda(f.montos))) - diezmoFijos;

  const nombreCategoria = (id: Id | null) => (id && !esEventos(estado, id) ? categorias.get(id)?.nombre ?? CATEGORIA_EVENTOS : CATEGORIA_EVENTOS);
  const cambios: VistaCambio[] = [...anual.eventos]
    .sort((a, b) => a.mes - b.mes)
    .map((e) => ({
      evento: e,
      donde: e.tipo === 'INGRESO' ? (e.usuarioId ? `Ingreso de ${nombreUsuario(estado, e.usuarioId)}` : 'Ingreso') : nombreCategoria(e.categoriaId),
      diezmo: diezmoDeEvento(estado, e),
      texto: textoEvento(e),
    }));

  // Lo que cambia en cada mes, en texto; los meses seguidos sin cambios se agrupan (design D4).
  const filasEditables = [...gastos, ...ingresos.filter((f) => f.tenue)];
  const textos = MESES.map((_, i) => [
    ...delMes[i]!.map(textoEvento),
    ...filasEditables.filter((f) => f.cambia[i] && !(f.categoriaId && gastoEn(f.categoriaId, i).length)).map((f) => `${f.nombre} ${formatCop(f.valores[i]!)}`),
  ]);
  const meses: MesesAnualVista[] = [];
  MESES.forEach((m, i) => {
    const ultimo = meses.at(-1);
    if (ultimo && !textos[i]!.length && !ultimo.cambios.length && ultimo.libre === libre[i]) ultimo.hasta = m;
    else meses.push({ desde: m, hasta: m, libre: libre[i]!, cambios: textos[i]! });
  });

  return {
    anio, estado: anual.estado, base: anual.base, ingresos, gastos,
    diezmo: fila({ clave: 'diezmo', nombre: 'Diezmo', detalle: detalleDiezmo || 'Calculado', valores: diezmo, calculado: true }),
    eventos, libre, cambios, meses,
    kpis: { libreAnio: sumar(libre), mesApretado: { mes: minimo + 1, libre: libre[minimo]! }, diezmoAnio: sumar(diezmo), porCambios: sumar(libre) - libreBase * 12 },
  };
}

export function libreAnualDelMes(estado: EstadoHogar, ref: MesRef): Pesos {
  return resumenAnual(estado, ref.anio)?.libre[ref.mes - 1] ?? 0;
}

export function nombreMesApretado(r: ResumenAnual): string {
  return nombreMesCapital(r.kpis.mesApretado.mes);
}

/** "Septiembre a noviembre", "Enero". */
export function nombreMeses(m: MesesAnualVista): string {
  return m.desde === m.hasta ? nombreMesCapital(m.desde) : `${nombreMesCapital(m.desde)} a ${nombreMesCapital(m.hasta).toLowerCase()}`;
}

/** Lo que se escribe al agregar o corregir un evento; categoria y "en adelante" son opcionales. */
export type DatosEvento = Omit<EventoAnual, 'id' | 'categoriaId' | 'enAdelante'> & { categoriaId?: Id | null; enAdelante?: boolean };

function validarEvento(estado: EstadoHogar, evento: DatosEvento): Omit<EventoAnual, 'id'> {
  const nombre = evento.nombre.trim();
  if (!nombre || nombre.length > 60) throw new ReglaError('NOMBRE_REQUERIDO', 'El evento necesita un nombre');
  if (!(evento.monto > 0) || evento.mes < 1 || evento.mes > 12) throw new ReglaError('MONTO_INVALIDO', 'Revisa el mes y el monto');
  const categoriaId = evento.categoriaId ?? null;
  if (categoriaId) {
    if (evento.tipo !== 'GASTO') throw new ReglaError('DATOS_INVALIDOS', 'Un ingreso no lleva categoría');
    const cat = estado.categorias.find((c) => c.id === categoriaId);
    if (!cat) throw new ReglaError('NO_EXISTE', 'No existe esa categoría');
    if (cat.tipo === 'DIEZMO') throw new ReglaError('DATOS_INVALIDOS', 'El diezmo del año se calcula con las reglas');
  }
  if (evento.usuarioId && !estado.hogar.miembros.some((m) => m.usuarioId === evento.usuarioId)) throw new ReglaError('NO_EXISTE', 'Esa persona no es del hogar');
  return { nombre, mes: evento.mes, monto: evento.monto, tipo: evento.tipo, usuarioId: evento.tipo === 'INGRESO' ? evento.usuarioId ?? null : null, categoriaId, enAdelante: evento.enAdelante ?? false };
}

function anualOError(s: EstadoHogar, anio: number): PlanAnual {
  const anual = anualDe(s, anio);
  if (!anual) throw new ReglaError('NO_EXISTE', 'No hay plan anual para ese año');
  return anual;
}

export function agregarEvento(estado: EstadoHogar, datos: { anio: number; evento: DatosEvento }): EstadoHogar {
  const evento = validarEvento(estado, datos.evento);
  const s = clonar(estado);
  anualOError(s, datos.anio).eventos.push({ ...evento, id: nuevoId(s, 'ev') });
  return s;
}

/** Corregir un evento de "Lo que cambia", con los mismos datos que al agregarlo. */
export function editarEvento(estado: EstadoHogar, datos: { anio: number; eventoId: Id; evento: DatosEvento }): EstadoHogar {
  const evento = validarEvento(estado, datos.evento);
  const s = clonar(estado);
  const anual = anualOError(s, datos.anio);
  const i = anual.eventos.findIndex((e) => e.id === datos.eventoId);
  if (i < 0) throw new ReglaError('NO_EXISTE', 'Ese cambio ya no está');
  anual.eventos[i] = { ...evento, id: datos.eventoId };
  return s;
}

export function quitarEvento(estado: EstadoHogar, datos: { anio: number; eventoId: Id }): EstadoHogar {
  const s = clonar(estado);
  const anual = anualOError(s, datos.anio);
  if (!anual.eventos.some((e) => e.id === datos.eventoId)) throw new ReglaError('NO_EXISTE', 'Ese cambio ya no está');
  anual.eventos = anual.eventos.filter((e) => e.id !== datos.eventoId);
  return s;
}

export function editarMontoAnual(estado: EstadoHogar, datos: { anio: number; categoriaId: Id; mes: number; monto: Pesos }): EstadoHogar {
  if (datos.monto < 0 || datos.mes < 1 || datos.mes > 12) throw new ReglaError('MONTO_INVALIDO', 'Revisa el mes y el monto');
  const s = clonar(estado);
  const anual = anualOError(s, datos.anio);
  const cat = s.categorias.find((c) => c.id === datos.categoriaId);
  if (!cat) throw new ReglaError('NO_EXISTE', 'No existe esa categoría');
  if (cat.tipo === 'DIEZMO') throw new ReglaError('DATOS_INVALIDOS', 'El diezmo del año se calcula con las reglas');
  // Una categoria creada despues del anual gana su fila al editarla.
  let f = anual.filas.find((x) => x.categoriaId === datos.categoriaId);
  if (!f) {
    f = { categoriaId: datos.categoriaId, montos: MESES.map(() => 0) };
    anual.filas.push(f);
  }
  f.montos[datos.mes - 1] = datos.monto;
  return s;
}

/** "Crear plan anual {año}": vacio, para el año en curso o uno futuro (backend-plan-anual D1). */
export function crearAnual(estado: EstadoHogar, datos: { anio: number; hoy: Fecha }): EstadoHogar {
  if (datos.anio < mesDe(datos.hoy).anio) throw new ReglaError('MONTO_INVALIDO', 'El plan anual es del año en curso o uno futuro');
  if (anualDe(estado, datos.anio)) throw new ReglaError('YA_EXISTE', 'Ese año ya tiene plan anual');
  const s = clonar(estado);
  s.anuales.push({ anio: datos.anio, estado: 'BORRADOR', filas: [], eventos: [], base: null });
  return s;
}

/** El aporte que una persona espera hacer en un mes; en 0 se quita (backend-plan-anual D1). */
export function editarProyeccion(estado: EstadoHogar, datos: { usuarioId: Id; ref: MesRef; monto: Pesos }): EstadoHogar {
  if (datos.monto < 0 || datos.ref.mes < 1 || datos.ref.mes > 12) throw new ReglaError('MONTO_INVALIDO', 'Revisa el mes y el monto');
  if (!anualDe(estado, datos.ref.anio)) throw new ReglaError('NO_EXISTE', 'No hay plan anual para ese año');
  if (!estado.hogar.miembros.some((m) => m.usuarioId === datos.usuarioId)) throw new ReglaError('NO_EXISTE', 'Esa persona no es del hogar');
  const s = clonar(estado);
  const mismo = (p: { usuarioId: Id; ref: MesRef }) => p.usuarioId === datos.usuarioId && p.ref.anio === datos.ref.anio && p.ref.mes === datos.ref.mes;
  s.proyecciones = s.proyecciones.filter((p) => !mismo(p));
  if (datos.monto > 0) s.proyecciones.push({ usuarioId: datos.usuarioId, ref: { anio: datos.ref.anio, mes: datos.ref.mes }, monto: datos.monto });
  return s;
}

/** Lo que un mes base pone en cada mes del año (design D2 de planear-anio-desde-un-mes). */
export interface VistaBase {
  /** El mes de donde salen los items; null desde cero. */
  ref: MesRef | null;
  filas: { categoriaId: Id; nombre: string; items: number; monto: Pesos }[];
  aportes: { usuarioId: Id; nombre: string; monto: Pesos }[];
  ingresos: { nombre: string; monto: Pesos }[];
  diezmo: Pesos;
  libreMes: Pesos;
  libreAnio: Pesos;
}

/** El ultimo plan del hogar antes de enero del año. */
function ultimoPlanAntes(estado: EstadoHogar, anio: number) {
  return estado.planes.filter((p) => compararMes(p.ref, { anio, mes: 1 }) < 0).sort((a, b) => compararMes(b.ref, a.ref))[0] ?? null;
}

export function vistaBase(estado: EstadoHogar, datos: { anio: number; base: BaseAnual }): VistaBase {
  const { base } = datos;
  const plan = base.tipo === 'MES' ? planDe(estado, base.ref) : base.tipo === 'FIJOS' ? ultimoPlanAntes(estado, datos.anio) : null;
  if (base.tipo === 'MES' && !plan) throw new ReglaError('NO_EXISTE', 'Ese mes no tiene plan');
  const items = (plan ? escenarioPrincipal(plan)?.items ?? [] : []).filter((i) => i.tipo !== 'DIEZMO' && !(base.tipo === 'FIJOS' && i.tipo === 'VARIABLE'));
  const filas = [...estado.categorias]
    .filter((c) => c.tipo !== 'DIEZMO' && c.nombre !== CATEGORIA_EVENTOS)
    .sort((a, b) => a.orden - b.orden)
    .map((c) => {
      const deCategoria = items.filter((i) => i.categoriaId === c.id);
      return { categoriaId: c.id, nombre: c.nombre, items: deCategoria.length, monto: sumar(deCategoria.map((i) => i.monto)) };
    });
  // Lo que cada miembro aporto en el mes base, o su proyeccion de ese mes si no registro aportes.
  const aportes: VistaBase['aportes'] = [];
  if (base.tipo === 'MES') {
    for (const m of estado.hogar.miembros) {
      const registrado = sumar(estado.movimientos.filter((x) => x.tipo === 'APORTE' && x.usuarioId === m.usuarioId && mismoMes(x.ref, base.ref)).map((x) => x.monto));
      const proyectado = estado.proyecciones.find((p) => p.usuarioId === m.usuarioId && mismoMes(p.ref, base.ref))?.monto ?? 0;
      const monto = registrado || proyectado;
      if (monto > 0) aportes.push({ usuarioId: m.usuarioId, nombre: `Aportes ${nombreUsuario(estado, m.usuarioId)}`, monto });
    }
  }
  const fijos = estado.ingresosFijos.filter((f) => f.activo);
  let diezmo = 0;
  for (const f of fijos) {
    const regla = reglaDe(estado, f.usuarioId);
    if (regla) diezmo += calcularDiezmo(regla.porcentaje, f.bruto, f.neto, regla.base);
  }
  const libreMes = sumar(fijos.map((f) => f.neto)) + sumar(aportes.map((a) => a.monto)) - sumar(filas.map((f) => f.monto)) - diezmo;
  return {
    ref: plan?.ref ?? null, filas, aportes, ingresos: fijos.map((f) => ({ nombre: f.nombre, monto: f.neto })),
    diezmo, libreMes, libreAnio: libreMes * 12,
  };
}

/**
 * "Replicar en los 12 meses": llena el plan anual con el mes base (lo crea si no existe). Reemplaza las celdas y los
 * aportes proyectados del año y conserva los eventos (design D1 de planear-anio-desde-un-mes).
 */
export function replicarMes(estado: EstadoHogar, datos: { anio: number; base: BaseAnual; hoy: Fecha }): EstadoHogar {
  let s = anualDe(estado, datos.anio) ? clonar(estado) : crearAnual(estado, { anio: datos.anio, hoy: datos.hoy });
  if (datos.anio < mesDe(datos.hoy).anio) throw new ReglaError('MONTO_INVALIDO', 'El plan anual es del año en curso o uno futuro');
  const anual = anualDe(s, datos.anio)!;
  if (anual.estado === 'CREADO') throw new ReglaError('DATOS_INVALIDOS', 'Los meses de ese año ya se crearon');
  const vista = vistaBase(s, { anio: datos.anio, base: datos.base });
  anual.filas = vista.filas.map((f) => ({ categoriaId: f.categoriaId, montos: MESES.map(() => f.monto) }));
  anual.base = vista.ref;
  s.proyecciones = s.proyecciones.filter((p) => p.ref.anio !== datos.anio);
  for (const a of vista.aportes) for (const mes of MESES) s.proyecciones.push({ usuarioId: a.usuarioId, ref: { anio: datos.anio, mes }, monto: a.monto });
  return s;
}

/**
 * "Crear los 12 meses": cada mes sin plan nace en BORRADOR con su columna como Opcion A.
 * Los items salen del mes base (o, sin base, del ultimo plan antes del año) y se ajustan al monto
 * de la columna; los eventos de gasto entran en su categoria o en "Eventos del año". Editar un mes despues no toca el anual.
 */
export function crearMesesDesdeAnual(estado: EstadoHogar, datos: { anio: number; creadoPor: Id }): EstadoHogar {
  const s = clonar(estado);
  const anual = anualOError(s, datos.anio);
  const origen = anual.base ? planDe(s, anual.base) : ultimoPlanAntes(s, datos.anio);
  // Los items de diezmo del plan base no se copian: cada mes gana los suyos (design D2 de diezmo-como-gasto).
  const plantilla = (origen ? escenarioPrincipal(origen)?.items ?? [] : []).filter((i) => i.tipo !== 'DIEZMO');
  let eventosCat = s.categorias.find((c) => c.nombre === CATEGORIA_EVENTOS);
  if (!eventosCat && anual.eventos.some((e) => e.tipo === 'GASTO' && esEventos(s, e.categoriaId))) {
    eventosCat = { id: nuevoId(s, 'cat'), nombre: CATEGORIA_EVENTOS, color: '#5F625C', orden: 90, tipo: 'OTRO', sistema: false };
    s.categorias.push(eventosCat);
  }
  const nuevoItem = (categoriaId: Id, nombre: string, monto: Pesos, tipo: ItemPlan['tipo']): ItemPlan => ({
    id: nuevoId(s, 'item'), categoriaId, nombre, monto, diaVence: null, tipo, cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false,
  });
  for (const mes of MESES) {
    const ref = { anio: datos.anio, mes };
    // Un mes con plan no cambia, y uno cerrado sin plan no gana plan.
    if (planDe(s, ref) || cierreDe(s, ref)) continue;
    const items: ItemPlan[] = [];
    // En el orden de las categorias del hogar, como el backend.
    const orden = (id: Id) => s.categorias.find((c) => c.id === id)?.orden ?? 0;
    for (const fila of [...anual.filas].sort((a, b) => orden(a.categoriaId) - orden(b.categoriaId))) {
      const monto = fila.montos[mes - 1] ?? 0;
      const base = plantilla.filter((i) => i.categoriaId === fila.categoriaId).map((i) => ({ ...i, id: nuevoId(s, 'item') }));
      const diferencia = monto - sumar(base.map((i) => i.monto));
      const nombreCategoria = s.categorias.find((c) => c.id === fila.categoriaId)?.nombre ?? 'Gasto';
      // Los items no son negativos: si la columna es menor que lo copiado, la categoria entra como un solo item por la
      // columna (design D4 de backend-plan-anual).
      if (diferencia < 0) {
        if (monto > 0) items.push(nuevoItem(fila.categoriaId, nombreCategoria, monto, 'VARIABLE'));
        continue;
      }
      items.push(...base);
      if (diferencia > 0) items.push(nuevoItem(fila.categoriaId, base.length ? 'Ajuste del plan anual' : nombreCategoria, diferencia, 'VARIABLE'));
    }
    for (const e of eventosDelMes(anual, mes).filter((x) => x.tipo === 'GASTO')) {
      if (esEventos(s, e.categoriaId)) items.push(nuevoItem(eventosCat!.id, e.nombre, e.monto, 'FIJO'));
      else items.push(nuevoItem(e.categoriaId!, e.nombre, e.monto, s.categorias.find((c) => c.id === e.categoriaId)?.tipo === 'VARIABLE' ? 'VARIABLE' : 'FIJO'));
    }
    const ingresos = ingresosNuevos(s, ref);
    items.push(...diezmosDelMes(s, ref, items, ingresos));
    s.planes.push({ id: nuevoId(s, 'plan'), ref, estado: 'BORRADOR', escenarioActivoId: null, escenarios: [{ id: nuevoId(s, 'esc'), letra: 'A', creadoPor: datos.creadoPor, nota: 'Del plan anual', archivado: false, ingresos, items }] });
  }
  anual.estado = 'CREADO';
  return s;
}

/** "{Mes} queda en": lo que dejaria libre cada mes con el evento agregado (o corregido, con `eventoId`). */
export function previsualizarEvento(estado: EstadoHogar, datos: { anio: number; eventoId: Id | null; evento: DatosEvento }): Pesos[] {
  const s = datos.eventoId
    ? editarEvento(estado, { anio: datos.anio, eventoId: datos.eventoId, evento: datos.evento })
    : agregarEvento(estado, { anio: datos.anio, evento: datos.evento });
  return resumenAnual(s, datos.anio)!.libre;
}

/** Lo que "Borrar plan de {año}" dice que se borra. */
export function conteoBorradoAnual(estado: EstadoHogar, anio: number): { cambios: number; proyecciones: boolean } {
  const anual = anualOError(estado, anio);
  return { cambios: anual.eventos.length, proyecciones: estado.proyecciones.some((p) => p.ref.anio === anio) };
}

/** "Borrar plan de {año}": el anual con sus celdas, eventos y base, y los aportes proyectados del año. Los meses no cambian. */
export function borrarAnual(estado: EstadoHogar, datos: { anio: number }): EstadoHogar {
  anualOError(estado, datos.anio);
  const s = clonar(estado);
  s.anuales = s.anuales.filter((a) => a.anio !== datos.anio);
  s.proyecciones = s.proyecciones.filter((p) => p.ref.anio !== datos.anio);
  return s;
}
