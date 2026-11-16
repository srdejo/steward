import type { BaseAnual, EstadoHogar, EventoAnual, Fecha, Id, ItemPlan, MesRef, OpcionAnual, Pesos, PlanAnual, PlanMes } from '../model';
import { formatCop, formatPorcentaje, nombreMesCapital } from '../format';
import { ReglaError, clonar, compararMes, mesDe, mismoMes, nuevoId, sumar } from './base';
import { anualDe, cierreDe, escenarioPrincipal, eventosDelMes, movimientosDe, nombreUsuario, opcionDe, planDe, reglaDe } from './consultas';
import { cuotasDeCreditos, pagaEnMes } from './credito';
import { calcularDiezmo, diezmosDelMes, ingresosNuevos } from './ingresos';
import { lineasDeTarjetas } from './tarjetas';

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

/** Una opcion del año en las pestañas (design D5 de anual-opciones-y-meses). */
export interface OpcionAnualVista {
  id: Id;
  letra: string;
  nota: string;
  autor: string;
  inicialAutor: string;
  creadoPor: Id;
  enUso: boolean;
  libreAnio: Pesos;
}

export interface ResumenAnual {
  anio: number;
  estado: 'BORRADOR' | 'CREADO';
  base: MesRef | null;
  /** La opcion que se ve. */
  opcion: { id: Id; letra: string };
  opciones: OpcionAnualVista[];
  /** Lo que dejaria libre cada mes la Opcion A, para "vs A" y "Las dos opciones, mes a mes". */
  libreA: Pesos[];
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

/** El resumen del año para una opcion (por defecto la en uso, o la A). */
export function resumenAnual(estado: EstadoHogar, anio: number, opcionId?: Id | null): ResumenAnual | null {
  const anual = anualDe(estado, anio);
  if (!anual) return null;
  const op = opcionDe(anual, opcionId);
  const libreDe = (o: OpcionAnual) => resumenDeOpcion(estado, anual, o).libre;
  const r = resumenDeOpcion(estado, anual, op);
  const a = anual.opciones[0]!;
  return {
    ...r,
    opcion: { id: op.id, letra: op.letra },
    opciones: anual.opciones.map((o) => {
      const autor = estado.usuarios.find((u) => u.id === o.creadoPor);
      return {
        id: o.id, letra: o.letra, nota: o.nota, autor: autor?.nombre ?? '', inicialAutor: autor?.inicial ?? '', creadoPor: o.creadoPor,
        enUso: anual.opcionEnUso === o.id, libreAnio: sumar(o.id === op.id ? r.libre : libreDe(o)),
      };
    }),
    libreA: a.id === op.id ? r.libre : libreDe(a),
  };
}

function resumenDeOpcion(estado: EstadoHogar, anual: PlanAnual, op: OpcionAnual): Omit<ResumenAnual, 'opcion' | 'opciones' | 'libreA'> {
  const anio = anual.anio;
  const delMes = MESES.map((m) => eventosDelMes(anual, m, op.id));
  const fila = (f: Omit<FilaAnualVista, 'cambia' | 'tenue' | 'calculado' | 'categoriaId' | 'usuarioId'> & Partial<FilaAnualVista>): FilaAnualVista =>
    ({ cambia: f.valores.map(() => false), tenue: false, calculado: false, categoriaId: null, usuarioId: null, ...f });

  const ingresos: FilaAnualVista[] = [];
  for (const f of estado.ingresosFijos.filter((x) => x.activo)) {
    ingresos.push(fila({ clave: `fijo-${f.id}`, nombre: f.nombre, detalle: '', valores: MESES.map(() => f.neto) }));
  }
  const extras = op.eventos.filter((e) => e.tipo === 'INGRESO');
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
  // Una fila por categoria del hogar; las que no tienen fila en la opcion valen lo del mes base (design D3 de
  // anual-opciones-y-meses), o $0. "Eventos del año" va en su propia fila.
  const conFila = new Set(op.filas.map((f) => f.categoriaId));
  // Solo con mes base: un año vacio (o desde cero) ve sus categorias en $0.
  const plantilla = op.base ? plantillaDe(estado, anio, op) : [];
  const filas = [
    ...op.filas,
    ...[...categorias.values()].filter((c) => !conFila.has(c.id) && c.nombre !== CATEGORIA_EVENTOS && c.tipo !== 'DIEZMO').sort((a, b) => a.orden - b.orden)
      .map((c) => ({ categoriaId: c.id, montos: MESES.map(() => sumar(plantilla.filter((i) => i.categoriaId === c.id).map((i) => i.monto))) })),
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
  const gastosEventos = op.eventos.filter((e) => e.tipo === 'GASTO' && esEventos(estado, e.categoriaId));
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
  const cambios: VistaCambio[] = [...op.eventos]
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
    anio, estado: anual.estado, base: op.base, ingresos, gastos,
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

/** La opcion pedida, o la en uso (o la A) sin id; un id que no es del año da OPCION_NO_ENCONTRADA. */
function opcionOError(anual: PlanAnual, opcionId?: Id | null): OpcionAnual {
  if (opcionId && !anual.opciones.some((o) => o.id === opcionId)) throw new ReglaError('OPCION_NO_ENCONTRADA', 'Esa opción no es de este año');
  return opcionDe(anual, opcionId);
}

/** La opcion que tiene un evento. */
function opcionDelEvento(anual: PlanAnual, eventoId: Id, opcionId?: Id | null): OpcionAnual {
  const op = opcionId ? opcionOError(anual, opcionId) : anual.opciones.find((o) => o.eventos.some((e) => e.id === eventoId));
  if (!op || !op.eventos.some((e) => e.id === eventoId)) throw new ReglaError('NO_EXISTE', 'Ese cambio ya no está');
  return op;
}

export function agregarEvento(estado: EstadoHogar, datos: { anio: number; evento: DatosEvento; opcionId?: Id | null }): EstadoHogar {
  const evento = validarEvento(estado, datos.evento);
  const s = clonar(estado);
  opcionOError(anualOError(s, datos.anio), datos.opcionId).eventos.push({ ...evento, id: nuevoId(s, 'ev') });
  return s;
}

/** Corregir un evento de "Lo que cambia", con los mismos datos que al agregarlo. */
export function editarEvento(estado: EstadoHogar, datos: { anio: number; eventoId: Id; evento: DatosEvento; opcionId?: Id | null }): EstadoHogar {
  const evento = validarEvento(estado, datos.evento);
  const s = clonar(estado);
  const op = opcionDelEvento(anualOError(s, datos.anio), datos.eventoId, datos.opcionId);
  op.eventos = op.eventos.map((e) => (e.id === datos.eventoId ? { ...evento, id: datos.eventoId } : e));
  return s;
}

export function quitarEvento(estado: EstadoHogar, datos: { anio: number; eventoId: Id; opcionId?: Id | null }): EstadoHogar {
  const s = clonar(estado);
  const op = opcionDelEvento(anualOError(s, datos.anio), datos.eventoId, datos.opcionId);
  op.eventos = op.eventos.filter((e) => e.id !== datos.eventoId);
  return s;
}

export function editarMontoAnual(estado: EstadoHogar, datos: { anio: number; categoriaId: Id; mes: number; monto: Pesos; opcionId?: Id | null }): EstadoHogar {
  if (datos.monto < 0 || datos.mes < 1 || datos.mes > 12) throw new ReglaError('MONTO_INVALIDO', 'Revisa el mes y el monto');
  const s = clonar(estado);
  const anual = opcionOError(anualOError(s, datos.anio), datos.opcionId);
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
export function crearAnual(estado: EstadoHogar, datos: { anio: number; hoy: Fecha; creadoPor?: Id }): EstadoHogar {
  if (datos.anio < mesDe(datos.hoy).anio) throw new ReglaError('MONTO_INVALIDO', 'El plan anual es del año en curso o uno futuro');
  if (anualDe(estado, datos.anio)) throw new ReglaError('YA_EXISTE', 'Ese año ya tiene plan anual');
  const s = clonar(estado);
  const creadoPor = datos.creadoPor ?? s.hogar.miembros[0]?.usuarioId ?? s.usuarios[0]!.id;
  s.anuales.push({ anio: datos.anio, estado: 'BORRADOR', opcionEnUso: null, opciones: [{ id: nuevoId(s, 'opa'), letra: 'A', creadoPor, nota: '', filas: [], eventos: [], base: null }] });
  return s;
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** "+ Duplicar Opción X": la siguiente letra libre, a nombre de quien duplica, con copia de celdas, eventos y base. */
export function duplicarOpcionAnual(estado: EstadoHogar, datos: { anio: number; opcionId: Id; creadoPor: Id }): { estado: EstadoHogar; opcionId: Id } {
  const s = clonar(estado);
  const anual = anualOError(s, datos.anio);
  const origen = opcionOError(anual, datos.opcionId);
  const letra = [...LETRAS].find((l) => !anual.opciones.some((o) => o.letra === l));
  if (!letra) throw new ReglaError('MUCHAS_OPCIONES', 'No caben más opciones en este año');
  const id = nuevoId(s, 'opa');
  anual.opciones.push({
    id, letra, creadoPor: datos.creadoPor, nota: '', base: origen.base ? { ...origen.base } : null,
    filas: origen.filas.map((f) => ({ categoriaId: f.categoriaId, montos: [...f.montos] })),
    eventos: origen.eventos.map((e) => ({ ...e, id: nuevoId(s, 'ev') })),
  });
  return { estado: s, opcionId: id };
}

/** "Quitar opción": no la ultima ni la que esta en uso. */
export function quitarOpcionAnual(estado: EstadoHogar, datos: { anio: number; opcionId: Id }): EstadoHogar {
  const s = clonar(estado);
  const anual = anualOError(s, datos.anio);
  opcionOError(anual, datos.opcionId);
  if (anual.opciones.length === 1 || anual.opcionEnUso === datos.opcionId) {
    throw new ReglaError('OPCION_EN_USO', anual.opciones.length === 1 ? 'El año necesita al menos una opción' : 'Esa opción está en uso; los meses salieron de ella');
  }
  anual.opciones = anual.opciones.filter((o) => o.id !== datos.opcionId);
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

/** Con `hoy`, el total del año descuenta mes a mes la cuota de los creditos que ya terminaron (anual-opciones-y-meses). */
export function vistaBase(estado: EstadoHogar, datos: { anio: number; base: BaseAnual; hoy?: Fecha }): VistaBase {
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
    diezmo, libreMes,
    libreAnio: datos.hoy
      ? sumar(MESES.map((mes) => libreMes + sumar(items.filter((i) => !siguePagando(estado, i, plan?.ref ?? null, { anio: datos.anio, mes }, datos.hoy!)).map((i) => i.monto))))
      : libreMes * 12,
  };
}

/**
 * "Replicar en los 12 meses": llena el plan anual con el mes base (lo crea si no existe). Reemplaza las celdas y los
 * aportes proyectados del año y conserva los eventos (design D1 de planear-anio-desde-un-mes).
 */
export function replicarMes(estado: EstadoHogar, datos: { anio: number; base: BaseAnual; hoy: Fecha; opcionId?: Id | null; creadoPor?: Id }): EstadoHogar {
  if (datos.anio < mesDe(datos.hoy).anio) throw new ReglaError('MONTO_INVALIDO', 'El plan anual es del año en curso o uno futuro');
  const s = anualDe(estado, datos.anio) ? clonar(estado) : crearAnual(estado, { anio: datos.anio, hoy: datos.hoy, creadoPor: datos.creadoPor });
  const op = opcionOError(anualDe(s, datos.anio)!, datos.opcionId);
  const vista = vistaBase(s, { anio: datos.anio, base: datos.base });
  // Ya no se bloquea con los meses creados: los meses no cambian hasta actualizarlos (design D4 de anual-opciones-y-meses).
  // Cada mes, el total de la categoria sin la cuota de los creditos que ya no pagan ese mes.
  const items = itemsBase(s, datos.base, datos.anio);
  op.filas = vista.filas.map((f) => ({
    categoriaId: f.categoriaId,
    montos: MESES.map((mes) => f.monto - sumar(items.filter((i) => i.categoriaId === f.categoriaId && !siguePagando(s, i, vista.ref, { anio: datos.anio, mes }, datos.hoy)).map((i) => i.monto))),
  }));
  op.base = vista.ref;
  s.proyecciones = s.proyecciones.filter((p) => p.ref.anio !== datos.anio);
  for (const a of vista.aportes) for (const mes of MESES) s.proyecciones.push({ usuarioId: a.usuarioId, ref: { anio: datos.anio, mes }, monto: a.monto });
  return s;
}

/** Los items de la base para replicar: la opcion en uso del mes base, o el ultimo plan antes del año sin variables. */
function itemsBase(estado: EstadoHogar, base: BaseAnual, anio: number): ItemPlan[] {
  const plan = base.tipo === 'MES' ? planDe(estado, base.ref) : base.tipo === 'FIJOS' ? ultimoPlanAntes(estado, anio) : null;
  return (plan ? escenarioPrincipal(plan)?.items ?? [] : []).filter((i) => i.tipo !== 'DIEZMO' && !(base.tipo === 'FIJOS' && i.tipo === 'VARIABLE'));
}

/** Meses de `desde` a `hasta`. */
function mesesEntre(desde: MesRef, hasta: MesRef): number {
  return (hasta.anio - desde.anio) * 12 + hasta.mes - desde.mes;
}

/**
 * Si un item de la plantilla sigue en `ref`: el de un credito, mientras el credito pague una cuota ese mes; el de una
 * compra a cuotas vieja ("cuota N de M"), mientras no pase de su total (design D3 de anual-opciones-y-meses).
 */
function siguePagando(estado: EstadoHogar, item: ItemPlan, base: MesRef | null, ref: MesRef, hoy: Fecha): boolean {
  if (item.creditoId) {
    const c = estado.creditos.find((x) => x.id === item.creditoId);
    if (c && !item.nombre.startsWith('Abono')) return pagaEnMes(c, ref, hoy);
  }
  if (item.cuota && base) return item.cuota.actual + mesesEntre(base, ref) <= item.cuota.total;
  return true;
}

/** La plantilla de una opcion: los items de su mes base (o del ultimo plan antes del año), sin los de diezmo. */
function plantillaDe(estado: EstadoHogar, anio: number, op: OpcionAnual): ItemPlan[] {
  const origen = op.base ? planDe(estado, op.base) : ultimoPlanAntes(estado, anio);
  // Los items de diezmo del plan base no se copian: cada mes gana los suyos (design D2 de diezmo-como-gasto).
  return (origen ? escenarioPrincipal(origen)?.items ?? [] : []).filter((i) => i.tipo !== 'DIEZMO');
}

/**
 * Un mes desde la columna de una opcion (design D3 de anual-opciones-y-meses): la plantilla del mes (creditos que siguen,
 * compras a cuotas avanzadas, lineas de tarjeta), ajustada a cada fila; las categorias sin fila tal cual; los eventos de
 * gasto; la cuota de los creditos sin item que pagan ese mes; sus lineas de ingreso y su diezmo.
 */
function itemsDelMes(s: EstadoHogar, anual: PlanAnual, op: OpcionAnual, ref: MesRef, hoy: Fecha, eventosCat: Id | null): { items: ItemPlan[]; ingresos: ReturnType<typeof ingresosNuevos> } {
  const base = op.base ?? ultimoPlanAntes(s, anual.anio)?.ref ?? null;
  const delMes = plantillaDe(s, anual.anio, op)
    .filter((i) => siguePagando(s, i, base, ref, hoy))
    .map((i) => ({ ...i, id: nuevoId(s, 'item'), cuota: i.cuota && base ? { ...i.cuota, actual: i.cuota.actual + mesesEntre(base, ref) } : i.cuota }));
  const plantilla = lineasDeTarjetas(s, delMes);
  const nuevoItem = (categoriaId: Id, nombre: string, monto: Pesos, tipo: ItemPlan['tipo']): ItemPlan => ({
    id: nuevoId(s, 'item'), categoriaId, nombre, monto, diaVence: null, tipo, cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false,
  });
  const items: ItemPlan[] = [];
  // En el orden de las categorias del hogar, como el backend.
  // "Eventos del año" no sale de la plantilla: sus gastos son los eventos de cada mes.
  for (const c of [...s.categorias].filter((x) => x.tipo !== 'DIEZMO' && x.nombre !== CATEGORIA_EVENTOS).sort((a, b) => a.orden - b.orden)) {
    const deCategoria = plantilla.filter((i) => i.categoriaId === c.id);
    const fila = op.filas.find((f) => f.categoriaId === c.id);
    if (!fila) {
      // Una categoria sin fila trae lo del mes base, si la opcion tiene uno (un año vacio no trae nada).
      if (op.base) items.push(...deCategoria);
      continue;
    }
    const monto = fila.montos[ref.mes - 1] ?? 0;
    const diferencia = monto - sumar(deCategoria.map((i) => i.monto));
    // Los items no son negativos: si la columna es menor que lo copiado, la categoria entra como un solo item por la
    // columna (design D4 de backend-plan-anual).
    if (diferencia < 0) {
      if (monto > 0) items.push(nuevoItem(c.id, c.nombre, monto, 'VARIABLE'));
      continue;
    }
    items.push(...deCategoria);
    if (diferencia > 0) items.push(nuevoItem(c.id, deCategoria.length ? 'Ajuste del plan anual' : c.nombre, diferencia, 'VARIABLE'));
  }
  for (const e of eventosDelMes(anual, ref.mes, op.id).filter((x) => x.tipo === 'GASTO')) {
    if (esEventos(s, e.categoriaId)) items.push(nuevoItem(eventosCat!, e.nombre, e.monto, 'FIJO'));
    else items.push(nuevoItem(e.categoriaId!, e.nombre, e.monto, s.categorias.find((c) => c.id === e.categoriaId)?.tipo === 'VARIABLE' ? 'VARIABLE' : 'FIJO'));
  }
  const conCuotas = cuotasDeCreditos(s, items, (c) => pagaEnMes(c, ref, hoy));
  const ingresos = ingresosNuevos(s, ref, op.id);
  return { items: [...conCuotas, ...diezmosDelMes(s, ref, conCuotas, ingresos)], ingresos };
}

/** Lo que muestra la hoja "Meses con la Opción X" de un mes (design D3 de anual-opciones-y-meses). */
export interface MesDesdeAnual {
  mes: number;
  accion: 'CREAR' | 'ACTUALIZABLE' | 'BLOQUEADO';
  /** ACTUALIZABLE: viene marcado (nacio del año o no tiene gastos). */
  marcado: boolean;
  /** "Sin plan", "Borrador · solo el salario y su diezmo", "Activo · tiene pagos". */
  ahora: string;
  /** BLOQUEADO: "Tiene pagos", "Cerrado". */
  motivo: string;
}

const TIPOS_REGISTRO = new Set(['PAGO', 'GASTO', 'INGRESO_FIJO']);

function conRegistros(estado: EstadoHogar, ref: MesRef): boolean {
  return Boolean(cierreDe(estado, ref)) || movimientosDe(estado, ref).some((m) => TIPOS_REGISTRO.has(m.tipo));
}

function estadoDe(plan: PlanMes): string {
  return plan.estado === 'BORRADOR' ? 'Borrador' : plan.estado === 'ACTIVO' ? 'Activo' : 'Cerrado';
}

/** Por mes: si se crea, se puede actualizar o no se toca, y lo que tiene hoy. */
export function mesesDesdeAnual(estado: EstadoHogar, anio: number, opcionId?: Id | null): MesDesdeAnual[] {
  const anual = anualOError(estado, anio);
  opcionOError(anual, opcionId);
  return MESES.map((mes): MesDesdeAnual => {
    const ref = { anio, mes };
    const plan = planDe(estado, ref);
    const cierre = cierreDe(estado, ref);
    if (!plan) {
      return cierre
        ? { mes, accion: 'BLOQUEADO', marcado: false, ahora: 'Cerrado sin plan', motivo: 'Cerrado' }
        : { mes, accion: 'CREAR', marcado: true, ahora: 'Sin plan', motivo: '' };
    }
    if (plan.estado === 'CERRADO' || cierre) return { mes, accion: 'BLOQUEADO', marcado: false, ahora: 'Cerrado', motivo: 'Cerrado' };
    if (conRegistros(estado, ref)) return { mes, accion: 'BLOQUEADO', marcado: false, ahora: `${estadoDe(plan)} · tiene pagos`, motivo: 'Tiene pagos' };
    const principal = escenarioPrincipal(plan);
    const gastos = (principal?.items ?? []).filter((i) => i.tipo !== 'DIEZMO').length;
    const delAnual = plan.escenarios.some((e) => e.nota === 'Del plan anual');
    const detalle = gastos ? `${gastos} ${gastos === 1 ? 'gasto' : 'gastos'}${delAnual ? ' del plan anual' : ''}` : 'solo ingresos y diezmo';
    return { mes, accion: 'ACTUALIZABLE', marcado: delAnual || gastos === 0, ahora: `${estadoDe(plan)} · ${detalle}`, motivo: '' };
  });
}

/**
 * "Meses con la Opción X" (design D3 de anual-opciones-y-meses): crea los meses sin plan y reemplaza el plan de los meses
 * de `actualizar` (sin registros) por la columna de la opcion. La opcion queda en uso y el año, Creado.
 */
export function crearOActualizarMeses(estado: EstadoHogar, datos: { anio: number; opcionId?: Id | null; actualizar: number[]; creadoPor: Id; hoy: Fecha }): EstadoHogar {
  const vista = mesesDesdeAnual(estado, datos.anio, datos.opcionId);
  for (const mes of datos.actualizar) {
    const v = vista[mes - 1];
    if (!v || v.accion === 'BLOQUEADO') throw new ReglaError('MES_CON_REGISTROS', `${nombreMesCapital(mes)} tiene registros o está cerrado; no se actualiza`);
  }
  const s = clonar(estado);
  const anual = anualOError(s, datos.anio);
  const op = opcionOError(anual, datos.opcionId);
  let eventosCat = s.categorias.find((c) => c.nombre === CATEGORIA_EVENTOS);
  if (!eventosCat && op.eventos.some((e) => e.tipo === 'GASTO' && esEventos(s, e.categoriaId))) {
    eventosCat = { id: nuevoId(s, 'cat'), nombre: CATEGORIA_EVENTOS, color: '#5F625C', orden: 90, tipo: 'OTRO', sistema: false };
    s.categorias.push(eventosCat);
  }
  for (const mes of MESES) {
    const ref = { anio: datos.anio, mes };
    const v = vista[mes - 1]!;
    const anterior = planDe(s, ref);
    if (v.accion === 'BLOQUEADO' || (v.accion === 'ACTUALIZABLE' && !datos.actualizar.includes(mes))) continue;
    // Actualizar: el plan del mes, con sus opciones, se reemplaza; conserva su estado (Activo queda con la nueva en uso).
    if (anterior) s.planes = s.planes.filter((p) => p.id !== anterior.id);
    const { items, ingresos } = itemsDelMes(s, anual, op, ref, datos.hoy, eventosCat?.id ?? null);
    const escId = nuevoId(s, 'esc');
    const activo = anterior?.estado === 'ACTIVO' || Boolean(anterior?.escenarioActivoId);
    s.planes.push({
      id: nuevoId(s, 'plan'), ref, estado: anterior?.estado === 'ACTIVO' ? 'ACTIVO' : 'BORRADOR', escenarioActivoId: activo ? escId : null,
      escenarios: [{ id: escId, letra: 'A', creadoPor: datos.creadoPor, nota: 'Del plan anual', archivado: false, ingresos, items }],
    });
  }
  anual.opcionEnUso = op.id;
  anual.estado = 'CREADO';
  return s;
}

/** "Crear los 12 meses" de antes: crea los meses sin plan con la opcion en uso, sin actualizar ninguno. */
export function crearMesesDesdeAnual(estado: EstadoHogar, datos: { anio: number; creadoPor: Id; hoy: Fecha; opcionId?: Id | null }): EstadoHogar {
  return crearOActualizarMeses(estado, { ...datos, actualizar: [] });
}

/** "{Mes} queda en": lo que dejaria libre cada mes con el evento agregado (o corregido, con `eventoId`). */
export function previsualizarEvento(estado: EstadoHogar, datos: { anio: number; eventoId: Id | null; evento: DatosEvento; opcionId?: Id | null }): Pesos[] {
  const s = datos.eventoId
    ? editarEvento(estado, { anio: datos.anio, eventoId: datos.eventoId, evento: datos.evento, opcionId: datos.opcionId })
    : agregarEvento(estado, { anio: datos.anio, evento: datos.evento, opcionId: datos.opcionId });
  return resumenAnual(s, datos.anio, datos.opcionId)!.libre;
}

/** Lo que "Borrar plan de {año}" dice que se borra. */
export function conteoBorradoAnual(estado: EstadoHogar, anio: number): { cambios: number; proyecciones: boolean } {
  const anual = anualOError(estado, anio);
  return { cambios: sumar(anual.opciones.map((o) => o.eventos.length)), proyecciones: estado.proyecciones.some((p) => p.ref.anio === anio) };
}

/** "Borrar plan de {año}": el anual con sus opciones (celdas, eventos y base) y los aportes proyectados del año. Los meses no cambian. */
export function borrarAnual(estado: EstadoHogar, datos: { anio: number }): EstadoHogar {
  anualOError(estado, datos.anio);
  const s = clonar(estado);
  s.anuales = s.anuales.filter((a) => a.anio !== datos.anio);
  s.proyecciones = s.proyecciones.filter((p) => p.ref.anio !== datos.anio);
  return s;
}
