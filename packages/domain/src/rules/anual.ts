import type { EstadoHogar, EventoAnual, Fecha, Id, ItemPlan, MesRef, Pesos } from '../model';
import { formatPorcentaje, nombreMesCapital } from '../format';
import { ReglaError, clonar, compararMes, mesDe, nuevoId, sumar } from './base';
import { anualDe, cierreDe, escenarioPrincipal, nombreUsuario, planDe, reglaDe } from './consultas';
import { calcularDiezmo, diezmosDelMes, ingresosNuevos } from './ingresos';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
export const CATEGORIA_EVENTOS = 'Eventos del año';

export interface FilaAnualVista {
  clave: string;
  nombre: string;
  detalle: string;
  valores: Pesos[];
  /** Proyectado (aportes): se ve tenue. */
  tenue: boolean;
  /** Calculado (diezmo): no editable. */
  calculado: boolean;
}

export interface ResumenAnual {
  anio: number;
  estado: 'BORRADOR' | 'CREADO';
  ingresos: FilaAnualVista[];
  gastos: FilaAnualVista[];
  diezmo: FilaAnualVista;
  eventos: FilaAnualVista | null;
  libre: Pesos[];
  kpis: { libreAnio: Pesos; mesApretado: { mes: number; libre: Pesos }; diezmoAnio: Pesos };
}

export function resumenAnual(estado: EstadoHogar, anio: number): ResumenAnual | null {
  const anual = anualDe(estado, anio);
  if (!anual) return null;
  const ingresos: FilaAnualVista[] = [];
  for (const f of estado.ingresosFijos.filter((x) => x.activo)) {
    ingresos.push({ clave: `fijo-${f.id}`, nombre: f.nombre, detalle: '', valores: MESES.map(() => f.neto), tenue: false, calculado: false });
  }
  const extras = anual.eventos.filter((e) => e.tipo === 'INGRESO');
  for (const nombre of new Set(extras.map((e) => e.nombre))) {
    ingresos.push({ clave: `extra-${nombre}`, nombre, detalle: '', valores: MESES.map((m) => sumar(extras.filter((e) => e.nombre === nombre && e.mes === m).map((e) => e.monto))), tenue: false, calculado: false });
  }
  // Una fila de aportes por miembro, aunque no tenga proyecciones, para poder llenarla (backend-plan-anual D1).
  const proyectados = estado.proyecciones.filter((p) => p.ref.anio === anio);
  for (const usuarioId of new Set([...estado.hogar.miembros.map((m) => m.usuarioId), ...proyectados.map((p) => p.usuarioId)])) {
    ingresos.push({
      clave: `proy-${usuarioId}`, nombre: `Aportes ${nombreUsuario(estado, usuarioId)}`, detalle: 'Proyectado · se vuelve real al registrarlo',
      valores: MESES.map((m) => proyectados.find((p) => p.usuarioId === usuarioId && p.ref.mes === m)?.monto ?? 0), tenue: true, calculado: false,
    });
  }
  const categorias = new Map(estado.categorias.map((c) => [c.id, c]));
  // Una fila por categoria del hogar (las nuevas en $0); "Eventos del año" va en su propia fila.
  const conFila = new Set(anual.filas.map((f) => f.categoriaId));
  const filas = [
    ...anual.filas,
    ...[...categorias.values()].filter((c) => !conFila.has(c.id) && c.nombre !== CATEGORIA_EVENTOS && c.tipo !== 'DIEZMO').sort((a, b) => a.orden - b.orden).map((c) => ({ categoriaId: c.id, montos: MESES.map(() => 0) })),
  ];
  const gastos: FilaAnualVista[] = filas.map((f) => ({ clave: f.categoriaId, nombre: categorias.get(f.categoriaId)?.nombre ?? '', detalle: '', valores: [...f.montos], tenue: false, calculado: false }));

  let detalleDiezmo = '';
  const diezmo = MESES.map((m) => {
    let total = 0;
    for (const f of estado.ingresosFijos.filter((x) => x.activo)) {
      const regla = reglaDe(estado, f.usuarioId);
      if (!regla) continue;
      total += calcularDiezmo(regla.porcentaje, f.bruto, f.neto, regla.base);
      detalleDiezmo = `Calculado · ${formatPorcentaje(regla.porcentaje)} del ${regla.base === 'BRUTO' ? 'bruto' : 'neto'}`;
    }
    for (const e of extras.filter((x) => x.mes === m && x.usuarioId)) {
      const regla = reglaDe(estado, e.usuarioId!);
      if (regla) total += calcularDiezmo(regla.porcentaje, e.monto, e.monto, 'BRUTO');
    }
    return total;
  });
  const gastosEventos = anual.eventos.filter((e) => e.tipo === 'GASTO');
  const eventos = gastosEventos.length
    ? { clave: 'eventos', nombre: CATEGORIA_EVENTOS, detalle: [...new Set(gastosEventos.map((e) => e.nombre))].join(' · '), valores: MESES.map((m) => sumar(gastosEventos.filter((e) => e.mes === m).map((e) => e.monto))), tenue: false, calculado: false }
    : null;

  const libre = MESES.map((_, i) => sumar(ingresos.map((f) => f.valores[i]!)) - sumar(gastos.map((f) => f.valores[i]!)) - diezmo[i]! - (eventos?.valores[i] ?? 0));
  const minimo = libre.reduce((min, v, i) => (v < libre[min]! ? i : min), 0);
  return {
    anio, estado: anual.estado, ingresos, gastos,
    diezmo: { clave: 'diezmo', nombre: 'Diezmo', detalle: detalleDiezmo || 'Calculado', valores: diezmo, tenue: false, calculado: true },
    eventos, libre,
    kpis: { libreAnio: sumar(libre), mesApretado: { mes: minimo + 1, libre: libre[minimo]! }, diezmoAnio: sumar(diezmo) },
  };
}

export function libreAnualDelMes(estado: EstadoHogar, ref: MesRef): Pesos {
  return resumenAnual(estado, ref.anio)?.libre[ref.mes - 1] ?? 0;
}

export function nombreMesApretado(r: ResumenAnual): string {
  return nombreMesCapital(r.kpis.mesApretado.mes);
}

export function agregarEvento(estado: EstadoHogar, datos: { anio: number; evento: Omit<EventoAnual, 'id'> }): EstadoHogar {
  const { evento } = datos;
  if (!evento.nombre.trim()) throw new ReglaError('NOMBRE_REQUERIDO', 'El evento necesita un nombre');
  if (!(evento.monto > 0) || evento.mes < 1 || evento.mes > 12) throw new ReglaError('MONTO_INVALIDO', 'Revisa el mes y el monto');
  const s = clonar(estado);
  const anual = anualDe(s, datos.anio);
  if (!anual) throw new ReglaError('NO_EXISTE', 'No hay plan anual para ese año');
  anual.eventos.push({ ...evento, nombre: evento.nombre.trim(), id: nuevoId(s, 'ev') });
  return s;
}

export function editarMontoAnual(estado: EstadoHogar, datos: { anio: number; categoriaId: Id; mes: number; monto: Pesos }): EstadoHogar {
  if (datos.monto < 0 || datos.mes < 1 || datos.mes > 12) throw new ReglaError('MONTO_INVALIDO', 'Revisa el mes y el monto');
  const s = clonar(estado);
  const anual = anualDe(s, datos.anio);
  if (!anual) throw new ReglaError('NO_EXISTE', 'No hay plan anual para ese año');
  const cat = s.categorias.find((c) => c.id === datos.categoriaId);
  if (!cat) throw new ReglaError('NO_EXISTE', 'No existe esa categoría');
  if (cat.tipo === 'DIEZMO') throw new ReglaError('DATOS_INVALIDOS', 'El diezmo del año se calcula con las reglas');
  // Una categoria creada despues del anual gana su fila al editarla.
  let fila = anual.filas.find((f) => f.categoriaId === datos.categoriaId);
  if (!fila) {
    fila = { categoriaId: datos.categoriaId, montos: MESES.map(() => 0) };
    anual.filas.push(fila);
  }
  fila.montos[datos.mes - 1] = datos.monto;
  return s;
}

/** "Crear plan anual {año}": vacio, para el año en curso o uno futuro (backend-plan-anual D1). */
export function crearAnual(estado: EstadoHogar, datos: { anio: number; hoy: Fecha }): EstadoHogar {
  if (datos.anio < mesDe(datos.hoy).anio) throw new ReglaError('MONTO_INVALIDO', 'El plan anual es del año en curso o uno futuro');
  if (anualDe(estado, datos.anio)) throw new ReglaError('YA_EXISTE', 'Ese año ya tiene plan anual');
  const s = clonar(estado);
  s.anuales.push({ anio: datos.anio, estado: 'BORRADOR', filas: [], eventos: [] });
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

/**
 * "Crear meses desde este plan": cada mes sin plan nace en BORRADOR con su columna como Opcion A.
 * Los items salen del ultimo plan que existe antes del año (misma estructura) y se ajustan al monto
 * de la columna; los eventos de gasto entran en "Eventos del año". Editar un mes despues no toca el anual.
 */
export function crearMesesDesdeAnual(estado: EstadoHogar, datos: { anio: number; creadoPor: Id }): EstadoHogar {
  const s = clonar(estado);
  const anual = anualDe(s, datos.anio);
  if (!anual) throw new ReglaError('NO_EXISTE', 'No hay plan anual para ese año');
  const previos = s.planes.filter((p) => compararMes(p.ref, { anio: datos.anio, mes: 1 }) < 0).sort((a, b) => compararMes(b.ref, a.ref));
  // Los items de diezmo del plan base no se copian: cada mes gana los suyos (design D2 de diezmo-como-gasto).
  const plantilla = (previos.length ? escenarioPrincipal(previos[0]!)?.items ?? [] : []).filter((i) => i.tipo !== 'DIEZMO');
  let eventosCat = s.categorias.find((c) => c.nombre === CATEGORIA_EVENTOS);
  if (!eventosCat && anual.eventos.some((e) => e.tipo === 'GASTO')) {
    eventosCat = { id: nuevoId(s, 'cat'), nombre: CATEGORIA_EVENTOS, color: '#5F625C', orden: 90, tipo: 'OTRO', sistema: false };
    s.categorias.push(eventosCat);
  }
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
        if (monto > 0) items.push({ id: nuevoId(s, 'item'), categoriaId: fila.categoriaId, nombre: nombreCategoria, monto, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null });
        continue;
      }
      items.push(...base);
      if (diferencia > 0) {
        const nombre = base.length ? 'Ajuste del plan anual' : nombreCategoria;
        items.push({ id: nuevoId(s, 'item'), categoriaId: fila.categoriaId, nombre, monto: diferencia, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null });
      }
    }
    for (const e of anual.eventos.filter((x) => x.tipo === 'GASTO' && x.mes === mes)) {
      items.push({ id: nuevoId(s, 'item'), categoriaId: eventosCat!.id, nombre: e.nombre, monto: e.monto, diaVence: null, tipo: 'FIJO', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null });
    }
    items.push(...diezmosDelMes(s, ref, items));
    const ingresos = ingresosNuevos(s, ref);
    s.planes.push({ id: nuevoId(s, 'plan'), ref, estado: 'BORRADOR', escenarioActivoId: null, escenarios: [{ id: nuevoId(s, 'esc'), letra: 'A', creadoPor: datos.creadoPor, nota: 'Del plan anual', archivado: false, ingresos, items }] });
  }
  anual.estado = 'CREADO';
  return s;
}
