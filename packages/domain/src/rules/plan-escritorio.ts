import type { Escenario, EstadoHogar, Fecha, Id, ItemPlan, MesRef, Pesos, TipoItem } from '../model';
import { formatCop, nombreMes } from '../format';
import { compararMes, diaDe, fechaEnMes, mesDe, mismoMes, sumar, sumarMeses } from './base';
import { escenarioPrincipal, movimientosDe, planDe } from './consultas';
import { cuentasDelHogar } from './cuentas';
import { cuotasProyectadas, cuotasRestantes } from './credito';
import { detalleDiezmo, detalleVencimiento } from './ejecucion';
import { recibeLinea, type LineaIngreso } from './ingresos';
import { estadoEfectivo, vistaOpcion, vistasOpciones, type VistaOpcion } from './plan';

// Plan de un mes en escritorio (spec steward-planear, design D2 y D3 de plan-mes-escritorio).

/** Clave para emparejar un gasto entre meses u opciones: categoria y nombre, sin mayusculas ni espacios de mas. */
function claveGasto(categoriaId: Id, nombre: string): string {
  return `${categoriaId}|${nombre.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/** Claves de los items de una opcion; los repetidos dentro de la opcion llevan `#2`, `#3` (design D3). */
function clavesDe(items: ItemPlan[]): Map<Id, string> {
  const vistas = new Map<string, number>();
  const claves = new Map<Id, string>();
  for (const i of items) {
    const base = claveGasto(i.categoriaId, i.nombre);
    const n = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, n);
    claves.set(i.id, n === 1 ? base : `${base}#${n}`);
  }
  return claves;
}

/** Clave de una linea de ingreso: los aportes por persona (reales o proyectados) son la misma fila. */
function claveIngreso(l: LineaIngreso): string {
  if (l.tipo === 'APORTES' || l.tipo === 'PROYECCION') return `aportes|${l.usuarioId}`;
  if (l.tipo === 'SOBRANTE') return 'sobrante';
  return `ingreso|${l.nombre.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/** Dia de una linea de ingreso: el de pago de su ingreso fijo; las demas no tienen. */
function diaIngreso(estado: EstadoHogar, l: LineaIngreso): number | null {
  const fijo = l.ingresoFijoId ? estado.ingresosFijos.find((f) => f.id === l.ingresoFijoId) : undefined;
  return fijo?.diaPago ?? null;
}

function diasDelMes(ref: MesRef): number {
  return new Date(Date.UTC(ref.anio, ref.mes, 0)).getUTCDate();
}

// --- Una opcion ------------------------------------------------------------------------------------------------------

export type EtiquetaFila = 'SOLO_MES' | 'PROYECTADO' | 'ULTIMO';

export interface FilaMes {
  clave: string;
  nombre: string;
  categoriaId: Id | null;
  /** "Corte 13 · valor del extracto", "Día 20 · cuota 6 de 12", "Durante el mes". */
  detalle: string;
  dia: number | null;
  /** null: se espera pero aun no se sabe (el sobrante de un mes sin cerrar). */
  monto: Pesos | null;
  /** Frente a la misma fila del mes anterior (lo que no estaba cuenta completo); null si el mes anterior no tiene plan. */
  diferencia: Pesos | null;
  etiqueta: EtiquetaFila | null;
  item: ItemPlan | null;
  linea: LineaIngreso | null;
  ingreso: boolean;
}

export interface GrupoMes {
  titulo: string;
  color: string;
  categoriaId: Id | null;
  total: Pesos;
  /** Frente al mismo grupo del mes anterior; null si el mes anterior no tiene plan. */
  diferencia: Pesos | null;
  filas: FilaMes[];
  ingresos: boolean;
}

export interface MovimientoDia {
  nombre: string;
  monto: Pesos;
  ingreso: boolean;
  color: string;
}

export interface VistaMesEscritorio {
  ref: MesRef;
  /** "Borrador · empieza en 16 días", "Activo", "Cerrado". */
  estadoTexto: string;
  anterior: MesRef;
  /** El mes anterior tiene plan: hay diferencias y etiquetas "Solo {mes}". */
  conAnterior: boolean;
  opcion: VistaOpcion;
  grupos: GrupoMes[];
  entra: Pesos;
  sale: Pesos;
  libre: Pesos;
  /** "Incluye Prima ($3.500.000)". */
  notaEntra: string;
  /** Las dos filas que mas cambian: "Navidad +$680.000 · Transporte +$50.000". */
  notaSale: string;
  diezmo: { total: Pesos; detalle: string };
  porDia: Record<number, MovimientoDia[]>;
  /** Saldo proyectado al final de cada dia (indice 0 = dia 1); null en los dias que ya pasaron o en un mes pasado. */
  saldoDiario: (Pesos | null)[];
  /** Saldo del hogar estimado con el que arranca la proyeccion. */
  inicio: Pesos;
  minimo: { dia: number; saldo: Pesos } | null;
  /** Gastos sin dia: no entran al saldo diario. */
  sinFecha: Pesos;
  /** Ingresos sin dia (extras, aportes proyectados): tampoco entran. */
  ingresosSinFecha: Pesos;
  seLibera: { nombre: string; monto: Pesos; desde: MesRef }[];
}

/** Cuota de un credito en `ref`: su numero, el total y si es la ultima. */
function cuotaDelMes(estado: EstadoHogar, item: ItemPlan, ref: MesRef, hoy: Fecha): { k: number; n: number | null; ultima: boolean } | null {
  if (item.cuota) return { k: item.cuota.actual, n: item.cuota.total, ultima: item.cuota.actual >= item.cuota.total };
  if (item.tipo !== 'CREDITO' || !item.creditoId || item.nombre.startsWith('Abono')) return null;
  const c = estado.creditos.find((x) => x.id === item.creditoId);
  if (!c || c.metodo === 'MANUAL') return null;
  const meses = Math.max(1, (ref.anio - mesDe(hoy).anio) * 12 + ref.mes - mesDe(hoy).mes + 1);
  const q = cuotasProyectadas(c, hoy, meses).find((x) => mismoMes(x.ref, ref));
  if (!q) return null;
  const restantes = cuotasRestantes(c);
  const n = c.metodo === 'PLAN' && c.numeroCuotas ? c.numeroCuotas : restantes !== null ? c.cuotasPagadas + restantes : null;
  return { k: q.k, n, ultima: q.saldo <= 0 };
}

function detalleItem(estado: EstadoHogar, item: ItemPlan, ref: MesRef, hoy: Fecha): string {
  if (item.tipo === 'DIEZMO') return detalleDiezmo(estado, item, ref);
  if (item.tipo === 'VARIABLE' && item.diaVence === null) return 'Durante el mes';
  const cuota = cuotaDelMes(estado, item, ref, hoy);
  if (cuota) return `Día ${item.diaVence ?? '—'} · cuota ${cuota.k}${cuota.n ? ` de ${cuota.n}` : ''}`;
  return detalleVencimiento(estado, item, ref, hoy);
}

/** Si un item ya tiene pagos o gastos en su mes. */
function itemPagado(estado: EstadoHogar, ref: MesRef, itemId: Id): Pesos {
  return sumar(movimientosDe(estado, ref).filter((m) => (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.itemId === itemId).map((m) => m.monto));
}

/**
 * El plan de un mes con una opcion, para escritorio (design D2): grupos con la diferencia frente al mes anterior,
 * indicadores, el calendario de pagos, el saldo proyectado dia a dia y lo que se libera. `escenarioId`: la opcion que se ve
 * (por defecto la principal). null si el mes no tiene plan.
 */
export function vistaMesEscritorio(estado: EstadoHogar, ref: MesRef, hoy: Fecha, escenarioId?: Id): VistaMesEscritorio | null {
  const plan = planDe(estado, ref);
  if (!plan) return null;
  const esc = (escenarioId ? plan.escenarios.find((e) => e.id === escenarioId) : null) ?? escenarioPrincipal(plan);
  if (!esc) return null;
  const opcion = vistaOpcion(estado, ref, esc);
  const anterior = sumarMeses(ref, -1);
  const planAnterior = planDe(estado, anterior);
  const escAnterior = planAnterior ? escenarioPrincipal(planAnterior) : null;
  const previa = escAnterior ? vistaOpcion(estado, anterior, escAnterior) : null;
  const conAnterior = previa !== null;
  const mes = nombreMes(ref.mes);

  // Ingresos
  const montosPrevios = new Map<string, Pesos>();
  for (const l of previa?.ingresos ?? []) montosPrevios.set(claveIngreso(l), (montosPrevios.get(claveIngreso(l)) ?? 0) + l.monto);
  const filasIngreso: FilaMes[] = opcion.ingresos.map((l) => {
    const previo = montosPrevios.get(claveIngreso(l));
    const etiqueta: EtiquetaFila | null = l.tenue ? 'PROYECTADO' : conAnterior && previo === undefined ? 'SOLO_MES' : null;
    return {
      clave: claveIngreso(l), nombre: l.nombre, categoriaId: null, detalle: l.detalle, dia: diaIngreso(estado, l), monto: l.monto,
      diferencia: conAnterior ? l.monto - (previo ?? 0) : null, etiqueta, item: null, linea: l, ingreso: true,
    };
  });
  // El sobrante de un mes anterior sin cerrar se espera, pero aun no tiene monto (como en "ya trae").
  if (planAnterior && planAnterior.estado !== 'CERRADO' && !opcion.ingresos.some((l) => l.tipo === 'SOBRANTE')) {
    const mesAnterior = nombreMes(anterior.mes);
    filasIngreso.push({
      clave: 'sobrante', nombre: `Sobrante de ${mesAnterior}`, categoriaId: null, detalle: `Al cerrar ${mesAnterior}`, dia: null, monto: null,
      diferencia: null, etiqueta: null, item: null, linea: null, ingreso: true,
    });
  }
  const grupoIngresos: GrupoMes = {
    titulo: 'Ingresos', color: '#2E6B45', categoriaId: null, total: opcion.totalIngresos,
    diferencia: previa ? opcion.totalIngresos - previa.totalIngresos : null, filas: filasIngreso, ingresos: true,
  };

  // Gastos, por categoria; el Diezmo al final, como en el artboard
  const clavesPrevias = escAnterior ? clavesDe(escAnterior.items) : new Map<Id, string>();
  const previos = new Map<string, Pesos>();
  for (const i of escAnterior?.items ?? []) previos.set(clavesPrevias.get(i.id)!, i.monto);
  const claves = clavesDe(esc.items);
  const seLibera: VistaMesEscritorio['seLibera'] = [];
  const categorias = [...estado.categorias].sort((a, b) => (a.tipo === 'DIEZMO' ? 1 : 0) - (b.tipo === 'DIEZMO' ? 1 : 0) || a.orden - b.orden);
  const gruposGasto: GrupoMes[] = categorias.flatMap((c) => {
    const items = esc.items.filter((i) => i.categoriaId === c.id);
    if (!items.length) return [];
    const filas = items.map((i): FilaMes => {
      const clave = claves.get(i.id)!;
      const previo = previos.get(clave);
      const cuota = cuotaDelMes(estado, i, ref, hoy);
      if (cuota?.ultima) {
        const credito = i.creditoId ? estado.creditos.find((x) => x.id === i.creditoId) : undefined;
        seLibera.push({ nombre: credito?.nombre ?? i.nombre, monto: i.monto, desde: sumarMeses(ref, 1) });
      }
      const etiqueta: EtiquetaFila | null = cuota?.ultima ? 'ULTIMO' : conAnterior && previo === undefined ? 'SOLO_MES' : null;
      return {
        clave, nombre: i.nombre, categoriaId: c.id, detalle: detalleItem(estado, i, ref, hoy), dia: i.diaVence, monto: i.monto,
        diferencia: conAnterior ? i.monto - (previo ?? 0) : null, etiqueta, item: i, linea: null, ingreso: false,
      };
    });
    const total = sumar(items.map((i) => i.monto));
    const totalPrevio = sumar((escAnterior?.items ?? []).filter((i) => i.categoriaId === c.id).map((i) => i.monto));
    return [{ titulo: c.nombre, color: c.color, categoriaId: c.id, total, diferencia: conAnterior ? total - totalPrevio : null, filas, ingresos: false }];
  });

  // Indicadores
  const extras = filasIngreso.filter((f) => f.etiqueta === 'SOLO_MES' && f.monto);
  const difIngresos = grupoIngresos.diferencia;
  const notaEntra = extras.length
    ? `Incluye ${extras.map((f) => `${f.nombre} (${formatCop(f.monto!)})`).join(', ')}`
    : difIngresos ? `${formatCop(difIngresos, { signo: true })} frente a ${nombreMes(anterior.mes)}` : conAnterior ? `Igual que ${nombreMes(anterior.mes)}` : '';
  const cambios = gruposGasto.flatMap((g) => g.filas).filter((f) => f.diferencia).sort((a, b) => Math.abs(b.diferencia!) - Math.abs(a.diferencia!));
  const notaSale = cambios.length
    ? cambios.slice(0, 2).map((f) => `${f.nombre} ${formatCop(f.diferencia!, { signo: true })}`).join(' · ')
    : conAnterior ? `Igual que ${nombreMes(anterior.mes)}` : '';
  const diezmos = esc.items.filter((i) => i.tipo === 'DIEZMO');
  const diezmo = {
    total: sumar(diezmos.map((i) => i.monto)),
    detalle: diezmos.map((i) => `${i.nombre.replace(/^Diezmo\s*·\s*/, '')} ${formatCop(i.monto)}`).join(' · '),
  };

  // Calendario y saldo dia a dia
  const actual = mesDe(hoy);
  const enCurso = mismoMes(ref, actual);
  const pasado = compararMes(ref, actual) < 0 || estadoEfectivo(plan, hoy) === 'CERRADO';
  const porDia: Record<number, MovimientoDia[]> = {};
  const neto = new Map<number, Pesos>();
  let sinFecha = 0;
  let ingresosSinFecha = 0;
  const recibidos = movimientosDe(estado, ref).filter((m) => m.tipo === 'INGRESO_FIJO');
  for (const f of filasIngreso) {
    if (f.monto === null || f.linea?.tipo === 'SOBRANTE') continue;
    if (f.dia === null) {
      ingresosSinFecha += f.monto;
      continue;
    }
    (porDia[f.dia] ??= []).push({ nombre: f.nombre, monto: f.monto, ingreso: true, color: grupoIngresos.color });
    const linea = f.linea?.lineaId ? esc.ingresos.find((l) => l.id === f.linea!.lineaId) : undefined;
    const llego = enCurso && linea !== undefined && recibidos.some((m) => recibeLinea(m, linea));
    if (!llego) neto.set(f.dia, (neto.get(f.dia) ?? 0) + f.monto);
  }
  for (const g of gruposGasto) {
    for (const f of g.filas) {
      const pendiente = enCurso ? Math.max(0, f.monto! - itemPagado(estado, ref, f.item!.id)) : f.monto!;
      if (f.dia === null) {
        sinFecha += pendiente;
        continue;
      }
      (porDia[f.dia] ??= []).push({ nombre: f.nombre, monto: f.monto!, ingreso: false, color: g.color });
      neto.set(f.dia, (neto.get(f.dia) ?? 0) - pendiente);
    }
  }
  const inicio = cuentasDelHogar(estado, hoy).total;
  const dias = diasDelMes(ref);
  const desde = enCurso ? diaDe(hoy) : 1;
  const saldoDiario: (Pesos | null)[] = [];
  let saldo = inicio;
  for (let d = 1; d <= dias; d++) {
    if (pasado || d < desde) {
      saldoDiario.push(null);
      continue;
    }
    saldo += neto.get(d) ?? 0;
    saldoDiario.push(saldo);
  }
  let minimo: VistaMesEscritorio['minimo'] = null;
  saldoDiario.forEach((v, i) => {
    if (v !== null && (minimo === null || v < minimo.saldo)) minimo = { dia: i + 1, saldo: v };
  });

  return {
    ref, estadoTexto: estadoDelMes(estado, ref, hoy), anterior, conAnterior, opcion, grupos: [grupoIngresos, ...gruposGasto],
    entra: opcion.totalIngresos, sale: opcion.totalGastos, libre: opcion.libre, notaEntra, notaSale, diezmo,
    porDia, saldoDiario, inicio, minimo, sinFecha, ingresosSinFecha, seLibera,
  };
}

/** "Borrador · empieza en 16 días", "Activo", "Cerrado". */
export function estadoDelMes(estado: EstadoHogar, ref: MesRef, hoy: Fecha): string {
  const plan = planDe(estado, ref);
  if (!plan) return 'Sin plan';
  const est = estadoEfectivo(plan, hoy);
  if (est === 'CERRADO') return 'Cerrado';
  if (est === 'ACTIVO') return 'Activo';
  const dias = Math.round((Date.parse(fechaEnMes(ref, 1)) - Date.parse(hoy)) / 86_400_000);
  return dias > 0 ? `Borrador · empieza en ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Borrador';
}

// --- Varias opciones -------------------------------------------------------------------------------------------------

export interface CeldaOpcion {
  monto: Pesos | null;
  item: ItemPlan | null;
  /** Distinta de la Opcion A. */
  cambia: boolean;
}

export interface FilaOpciones {
  clave: string;
  nombre: string;
  categoriaId: Id;
  /** "Vence día 6", "Durante el mes". */
  detalle: string;
  dia: number | null;
  tipo: TipoItem;
  celdas: CeldaOpcion[];
  /** Igual en todas las opciones. */
  igual: boolean;
  /** Item de alguna opcion, para crear el gasto en una que no lo tiene. */
  plantilla: ItemPlan;
}

export interface SeccionOpciones {
  categoriaId: Id;
  nombre: string;
  color: string;
  tipo: string;
  subtotales: Pesos[];
  filas: FilaOpciones[];
}

export interface TablaOpciones {
  ref: MesRef;
  estadoTexto: string;
  vistas: VistaOpcion[];
  ingresos: { valores: Pesos[]; cambia: boolean[] };
  secciones: SeccionOpciones[];
  totales: Pesos[];
  libres: Pesos[];
  /** Por opcion, lo que cambia frente a la A ("Suma Regalos de Navidad $600.000"); vacio en la A. */
  cambios: string[][];
  /** Gastos iguales en todas las opciones (los que oculta "Solo lo que cambia"). */
  igualesEnTodas: number;
}

/** Las opciones de un mes lado a lado, gasto por gasto (design D3). */
export function tablaOpciones(estado: EstadoHogar, ref: MesRef, hoy: Fecha): TablaOpciones {
  const vistas = vistasOpciones(estado, ref);
  const escs: Escenario[] = vistas.map((v) => v.escenario);
  const claves = escs.map((e) => clavesDe(e.items));
  const ingresos = vistas.map((v) => v.totalIngresos);
  const secciones: SeccionOpciones[] = [];
  for (const c of [...estado.categorias].sort((a, b) => (a.tipo === 'DIEZMO' ? 1 : 0) - (b.tipo === 'DIEZMO' ? 1 : 0) || a.orden - b.orden)) {
    const orden: string[] = [];
    const porClave = new Map<string, (ItemPlan | null)[]>();
    escs.forEach((e, k) => {
      for (const i of e.items.filter((x) => x.categoriaId === c.id)) {
        const clave = claves[k]!.get(i.id)!;
        if (!porClave.has(clave)) {
          porClave.set(clave, escs.map(() => null));
          orden.push(clave);
        }
        porClave.get(clave)![k] = i;
      }
    });
    if (!orden.length) continue;
    const filas = orden.map((clave): FilaOpciones => {
      const items = porClave.get(clave)!;
      const plantilla = items.find((i) => i !== null)!;
      const montos = items.map((i) => i?.monto ?? null);
      const celdas = items.map((i, k) => ({ monto: montos[k]!, item: i, cambia: k > 0 && montos[k] !== montos[0] }));
      return {
        clave, nombre: plantilla.nombre, categoriaId: c.id, detalle: detalleItem(estado, plantilla, ref, hoy), dia: plantilla.diaVence,
        tipo: plantilla.tipo, celdas, igual: new Set(montos).size === 1, plantilla,
      };
    });
    const subtotales = escs.map((_, k) => sumar(filas.map((f) => f.celdas[k]!.monto ?? 0)));
    secciones.push({ categoriaId: c.id, nombre: c.nombre, color: c.color, tipo: c.tipo, subtotales, filas });
  }
  const cambios = escs.map((_, k) => {
    if (k === 0) return [];
    const lista: string[] = [];
    if (ingresos[k] !== ingresos[0]) lista.push(`Ingresos ${formatCop(ingresos[k]! - ingresos[0]!, { signo: true })}`);
    for (const f of secciones.flatMap((s) => s.filas)) {
      const a = f.celdas[0]!.monto;
      const b = f.celdas[k]!.monto;
      if (a === b) continue;
      if (a === null) lista.push(`Suma ${f.nombre} ${formatCop(b!)}`);
      else if (b === null) lista.push(`Quita ${f.nombre} ${formatCop(a)}`);
      else lista.push(`${f.nombre} ${formatCop(b - a, { signo: true })}`);
    }
    return lista;
  });
  return {
    ref, estadoTexto: estadoDelMes(estado, ref, hoy), vistas,
    ingresos: { valores: ingresos, cambia: ingresos.map((v, k) => k > 0 && v !== ingresos[0]) },
    secciones,
    totales: vistas.map((v) => v.totalGastos),
    libres: vistas.map((v) => v.libre),
    cambios,
    igualesEnTodas: secciones.flatMap((s) => s.filas).filter((f) => f.igual).length,
  };
}

