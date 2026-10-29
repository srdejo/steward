import type { Escenario, EstadoHogar, EstadoMes, Fecha, Id, ItemPlan, MesRef, Pesos, PlanMes } from '../model';
import { formatCop, nombreMes } from '../format';
import { libreAnualDelMes } from './anual';
import { ReglaError, clonar, compararMes, mesDe, nuevoId, sumar, sumarMeses } from './base';
import { cuotasDeCreditos } from './credito';
import { anualDe, categoria, cierreDe, escenario, escenarioPrincipal, nombreUsuario, opciones, planDe, planPorId } from './consultas';
import { diezmoPlaneado, ingresosDelMes, totalIngresos, type LineaIngreso } from './ingresos';

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

function copiarItems(s: EstadoHogar, items: ItemPlan[], avanzarCuotas: boolean): ItemPlan[] {
  return items
    .map((i) => ({ ...i, id: nuevoId(s, 'item'), cuota: i.cuota && avanzarCuotas ? { ...i.cuota, actual: i.cuota.actual + 1 } : i.cuota }))
    .filter((i) => !i.cuota || i.cuota.actual <= i.cuota.total);
}

export type ModoNuevoMes = 'COPIAR' | 'FIJOS' | 'CERO';

/** Mes sin plan: crea el mes en BORRADOR con la Opcion A. */
export function crearMes(estado: EstadoHogar, datos: { ref: MesRef; modo: ModoNuevoMes; creadoPor: Id }): EstadoHogar {
  if (planDe(estado, datos.ref)) throw new ReglaError('YA_EXISTE', 'Ese mes ya tiene plan');
  const s = clonar(estado);
  const anterior = planDe(s, sumarMeses(datos.ref, -1));
  const base = anterior ? escenarioPrincipal(anterior)?.items ?? [] : [];
  let items: ItemPlan[] = [];
  if (datos.modo === 'COPIAR') items = copiarItems(s, base, true);
  if (datos.modo === 'FIJOS') items = copiarItems(s, base, true).map((i) => (i.tipo === 'VARIABLE' ? { ...i, monto: 0 } : i));
  // Los creditos con saldo traen su cuota en los tres modos; la de un credito ya pagado no se copia.
  const pagados = new Set(s.creditos.filter((c) => c.saldo <= 0).map((c) => c.id));
  items = cuotasDeCreditos(s, items.filter((i) => !i.creditoId || !pagados.has(i.creditoId)));
  const id = nuevoId(s, 'plan');
  s.planes.push({
    id, ref: datos.ref, estado: 'BORRADOR', escenarioActivoId: null,
    escenarios: [{ id: nuevoId(s, 'esc'), letra: 'A', creadoPor: datos.creadoPor, nota: '', archivado: false, items }],
  });
  return s;
}

export function duplicarEscenario(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; creadoPor: Id; nota?: string }): EstadoHogar {
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  if (plan.estado === 'CERRADO') throw new ReglaError('MES_CERRADO', 'El mes está cerrado');
  const origen = escenario(plan, datos.escenarioId);
  plan.escenarios.push({ id: nuevoId(s, 'esc'), letra: siguienteLetra(plan), creadoPor: datos.creadoPor, nota: datos.nota ?? '', archivado: false, items: copiarItems(s, origen.items, false) });
  return s;
}

/** "Usar esta": queda como el plan del mes; las demas se archivan, no se borran. */
export function usarEscenario(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id }): EstadoHogar {
  const s = clonar(estado);
  const plan = planPorId(s, datos.planId);
  if (plan.estado === 'CERRADO') throw new ReglaError('MES_CERRADO', 'El mes está cerrado');
  escenario(plan, datos.escenarioId);
  plan.escenarioActivoId = datos.escenarioId;
  for (const e of plan.escenarios) e.archivado = e.id !== datos.escenarioId;
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
  if (existente) Object.assign(existente, datos.item);
  else esc.items.push({ ...datos.item, id: nuevoId(s, 'item') } as ItemPlan);
  return s;
}

export function quitarItem(estado: EstadoHogar, datos: { planId: Id; escenarioId: Id; itemId: Id }): EstadoHogar {
  const s = clonar(estado);
  const esc = escenarioEditable(s, datos.planId, datos.escenarioId);
  esc.items = esc.items.filter((i) => i.id !== datos.itemId);
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
  diezmo: { monto: Pesos; detalle: string };
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
  const ingresos = ingresosDelMes(estado, ref, 'PLANEACION');
  const diezmo = diezmoPlaneado(estado, ref);
  const totalGastos = sumar(esc.items.map((i) => i.monto)) + diezmo.monto;
  const total = totalIngresos(ingresos);
  const autor = estado.usuarios.find((u) => u.id === esc.creadoPor);
  return { escenario: esc, autor: autor?.nombre ?? '', inicialAutor: autor?.inicial ?? '', ingresos, totalIngresos: total, grupos: gruposDe(estado, esc.items), diezmo, totalGastos, libre: total - totalGastos };
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
  const diezmos = vistas.map((v) => v.diezmo.monto);
  if (diezmos.some((d) => d > 0)) {
    iguales.push('diezmo');
    igualesTotal = igualesTotal.map((t, i) => (t ?? 0) + (diezmos[i] ?? 0));
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
export function probarAbonoComoOpcion(estado: EstadoHogar, datos: { creditoId: Id; ref: MesRef; abono: Pesos; creadoPor: Id }): { estado: EstadoHogar; planId: Id; escenarioId: Id } {
  if (!(datos.abono > 0)) throw new ReglaError('MONTO_INVALIDO', 'Escribe el abono');
  const credito = estado.creditos.find((c) => c.id === datos.creditoId);
  if (!credito) throw new ReglaError('NO_EXISTE', 'No existe el crédito');
  let s = planDe(estado, datos.ref) ? estado : crearMes(estado, { ref: datos.ref, modo: 'COPIAR', creadoPor: datos.creadoPor });
  const plan = planDe(s, datos.ref)!;
  if (plan.estado !== 'BORRADOR') throw new ReglaError('MES_NO_BORRADOR', 'Ese mes ya no está en borrador');
  const base = escenarioPrincipal(plan)!;
  s = duplicarEscenario(s, { planId: plan.id, escenarioId: base.id, creadoPor: datos.creadoPor, nota: 'abono a crédito' });
  const nueva = planDe(s, datos.ref)!.escenarios.at(-1)!;
  const categoriaCreditos = s.categorias.find((c) => c.tipo === 'CREDITO') ?? s.categorias[0]!;
  s = guardarItem(s, {
    planId: plan.id, escenarioId: nueva.id,
    item: { categoriaId: categoriaCreditos.id, nombre: `Abono extra ${credito.nombre.toLowerCase()}`, monto: datos.abono, diaVence: credito.diaPago, tipo: 'CREDITO', cuota: null, creditoId: credito.id },
  });
  return { estado: s, planId: plan.id, escenarioId: nueva.id };
}

export function nombreAutor(estado: EstadoHogar, esc: Escenario): string {
  return nombreUsuario(estado, esc.creadoPor);
}
