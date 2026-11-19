// Que se avisa y cuando (spec steward-avisos, "Qué se avisa" y "Avisos · Próximos"; avisos-pagos, design D1).
// La misma regla corre en el backend (AvisosUseCase); esta sirve al modo de prueba.
import { formatFechaCorta, nombreMes, nombreMesCapital } from '../format';
import type { EstadoHogar, Fecha, Id, ItemPlan, MesRef, Pesos } from '../model';
import { claveMes, diasEntre, fechaEnMes, mesDe, sumarMeses } from './base';
import { escenarioPrincipal, opciones, planDe } from './consultas';
import { DIAS_AVISO_CUADRE } from './cuentas';
import { ejecucionItem, resumenMes } from './ejecucion';
import { estadoEfectivo } from './plan';
import { proximaFecha } from './tarjetas';

/** Los tipos de aviso que cada persona prende o apaga en Configurar. */
export type TipoAviso = 'PAGO' | 'TARJETA' | 'CUOTA' | 'INGRESO' | 'PLAN' | 'CUADRAR';
export type GrupoAviso = 'VENCIDO' | 'SEMANA' | 'ADELANTE' | 'NO_OLVIDAR';

/** A donde lleva un aviso que no es un pago. */
export type DestinoAviso =
  | { tipo: 'CIERRE'; ref: MesRef }
  | { tipo: 'COMPARAR'; ref: MesRef }
  | { tipo: 'HOY' }
  | { tipo: 'CUENTA'; cuentaId: Id };

export interface Aviso {
  /** `tipo:id:yyyy-mm`: lo que no se repite (design D2). */
  clave: string;
  tipo: TipoAviso;
  fecha: Fecha;
  nombre: string;
  /** "En 2 días · valor del extracto", "Cuota 4 de 12 · hace 6 días", "Sin cuadrar desde el 20 sep". */
  detalle: string;
  monto: Pesos | null;
  /** El corte de una tarjeta: se ve distinto de un pago. */
  corte: boolean;
  grupo: GrupoAviso;
  /** Un pago que se marca desde Avisos. */
  pago: { itemId: Id; ref: MesRef } | null;
  destino: DestinoAviso | null;
}

/** Los interruptores de Configurar: los tipos y "Lo que marque {otro miembro}". */
export type TipoAvisoConfigurable = TipoAviso | 'ACTIVIDAD';

/** La configuracion de avisos de una persona (spec "Avisos · Configurar"). */
export interface PreferenciasAviso {
  tiposApagados: TipoAvisoConfigurable[];
  correo: boolean;
  noMolestar: boolean;
}

/** Para quien nunca abrio Configurar: todo activo, correo y no molestar. */
export const PREFERENCIAS_AVISO: PreferenciasAviso = { tiposApagados: [], correo: true, noMolestar: true };

/** Cuando avisa: fijo para todos (spec "Cuándo se avisa"). */
export const TEXTO_CUANDO_AVISA = 'Te aviso el lunes con los pagos de la semana, el día anterior y el mismo día si no se ha pagado, a las 8:00.';
/** El resumen de la fila Avisos de Ajustes. */
export const RESUMEN_CUANDO_AVISA = 'El lunes, el día anterior y el mismo día';

/** Los momentos de push de un pago (design D2): el lunes de su semana, el dia anterior y el mismo dia sin pagar. */
export type MomentoAviso = 'LUNES' | 'ANTES' | 'DIA';

/** Los momentos que tocan `hoy` para un aviso con fecha: "LUNES" si hoy es lunes y la fecha cae en esa semana. */
export function momentosDeHoy(fecha: Fecha, hoy: Fecha): MomentoAviso[] {
  const dias = diasEntre(hoy, fecha);
  const lunes = new Date(`${hoy}T00:00:00Z`).getUTCDay() === 1;
  const m: MomentoAviso[] = [];
  if (lunes && dias >= 0 && dias <= 6) m.push('LUNES');
  if (dias === 1) m.push('ANTES');
  if (dias === 0) m.push('DIA');
  return m;
}

/** Lo que muestra Avisos: lo vencido y lo de los proximos 30 dias. */
export const DIAS_AVISOS = 30;
export const ORDEN_GRUPO_AVISO: Record<GrupoAviso, number> = { VENCIDO: 0, SEMANA: 1, ADELANTE: 2, NO_OLVIDAR: 3 };
export const TITULO_GRUPO_AVISO: Record<GrupoAviso, string> = { VENCIDO: 'Vencido', SEMANA: 'Próximos 7 días', ADELANTE: 'Más adelante', NO_OLVIDAR: 'Para no olvidar' };

function grupo(dias: number): GrupoAviso {
  return dias < 0 ? 'VENCIDO' : dias <= 7 ? 'SEMANA' : 'ADELANTE';
}

/** "Hoy", "Mañana", "En 4 días", "Ayer", "Hace 6 días". */
export function cuandoAviso(dias: number): string {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return dias > 0 ? `En ${dias} días` : `Hace ${-dias} días`;
}

function tipoDeItem(i: ItemPlan): TipoAviso {
  if (i.tarjetaId) return 'TARJETA';
  if (i.tipo === 'CREDITO') return 'CUOTA';
  return 'PAGO';
}

/** "Cuota 4 de 12"; `adelante`: meses despues del en curso. */
function cuotaDe(estado: EstadoHogar, i: ItemPlan, adelante: number): string | null {
  if (i.cuota) return `Cuota ${i.cuota.actual} de ${i.cuota.total}`;
  const c = i.creditoId ? estado.creditos.find((x) => x.id === i.creditoId) : undefined;
  if (c?.metodo === 'PLAN' && c.numeroCuotas && !i.nombre.startsWith('Abono')) return `Cuota ${Math.min(c.numeroCuotas, c.cuotasPagadas + 1 + adelante)} de ${c.numeroCuotas}`;
  return null;
}

/** Los pagos con dia de un mes abierto: fijos, tarjetas y cuotas (no variables ni diezmo, spec "Qué se avisa"). */
function avisosDePagos(estado: EstadoHogar, ref: MesRef, hoy: Fecha, hasta: Fecha, conVencidos: boolean): Aviso[] {
  const plan = planDe(estado, ref);
  if (!plan || estadoEfectivo(plan, hoy) === 'CERRADO') return [];
  const opcion = escenarioPrincipal(plan);
  return (opcion?.items ?? []).flatMap((i): Aviso[] => {
    if (i.tipo === 'VARIABLE' || i.tipo === 'DIEZMO' || i.diaVence === null) return [];
    if (ejecucionItem(estado, i, ref, hoy).pagado) return [];
    const fecha = fechaEnMes(ref, i.diaVence);
    const dias = diasEntre(hoy, fecha);
    if (fecha > hasta || (dias < 0 && !conVencidos)) return [];
    const tipo = tipoDeItem(i);
    const tarjeta = i.tarjetaId ? estado.tarjetas.find((t) => t.id === i.tarjetaId) : undefined;
    const cuota = tipo === 'CUOTA' ? cuotaDe(estado, i, conVencidos ? 0 : 1) : null;
    const cuando = cuandoAviso(dias);
    const detalle = cuota ? `${cuota} · ${cuando.toLowerCase()}` : tarjeta ? `${cuando} · ${tarjeta.pago.tipo === 'FIJO' ? 'pago fijo' : 'valor del extracto'}` : cuando;
    return [{
      clave: `${tipo}:${i.id}:${claveMes(ref)}`, tipo, fecha, nombre: i.nombre.replace(/^Tarjeta /, ''), detalle, monto: i.monto, corte: false,
      grupo: grupo(dias), pago: { itemId: i.id, ref }, destino: null,
    }];
  });
}

/** El corte de cada tarjeta en los proximos dias. */
function avisosDeCortes(estado: EstadoHogar, hoy: Fecha, hasta: Fecha): Aviso[] {
  return estado.tarjetas.flatMap((t): Aviso[] => {
    const fecha = proximaFecha(t.diaCorte, hoy);
    if (fecha > hasta) return [];
    const dias = diasEntre(hoy, fecha);
    return [{
      clave: `CORTE:${t.id}:${fecha.slice(0, 7)}`, tipo: 'TARJETA', fecha, nombre: `Corte ${t.nombre}`, detalle: cuandoAviso(dias), monto: null, corte: true,
      grupo: grupo(dias), pago: null, destino: null,
    }];
  });
}

/** Los ingresos fijos por recibir con su dia ("¿Llegó Salario Daniel?"). */
function avisosDeIngresos(estado: EstadoHogar, ref: MesRef, hoy: Fecha, hasta: Fecha, conVencidos: boolean): Aviso[] {
  const plan = planDe(estado, ref);
  if (plan && estadoEfectivo(plan, hoy) === 'CERRADO') return [];
  return resumenMes(estado, ref, hoy).ingresos.flatMap((l): Aviso[] => {
    if (l.tipo !== 'FIJO' || l.recibido || l.tenue) return [];
    const fijo = l.ingresoFijoId ? estado.ingresosFijos.find((f) => f.id === l.ingresoFijoId) : undefined;
    if (!fijo) return [];
    const fecha = fechaEnMes(ref, fijo.diaPago);
    const dias = diasEntre(hoy, fecha);
    if (fecha > hasta || (dias < 0 && !conVencidos)) return [];
    return [{
      clave: `INGRESO:${l.lineaId ?? fijo.id}:${claveMes(ref)}`, tipo: 'INGRESO', fecha, nombre: `¿Llegó ${l.nombre}?`, detalle: cuandoAviso(dias), monto: l.monto, corte: false,
      grupo: grupo(dias), pago: null, destino: { tipo: 'HOY' },
    }];
  });
}

/** Elegir la opcion del mes siguiente (si tiene varias y ninguna en uso) y cerrar el mes en su ultimo dia. */
function avisosDelPlan(estado: EstadoHogar, actual: MesRef, hoy: Fecha, hasta: Fecha): Aviso[] {
  const avisos: Aviso[] = [];
  const planActual = planDe(estado, actual);
  if (planActual && estadoEfectivo(planActual, hoy) !== 'CERRADO') {
    const fecha = fechaEnMes(actual, 31);
    if (fecha <= hasta) {
      avisos.push({
        clave: `PLAN:cerrar:${claveMes(actual)}`, tipo: 'PLAN', fecha, nombre: `Cerrar ${nombreMes(actual.mes)}`, detalle: `${cuandoAviso(diasEntre(hoy, fecha))} · último día del mes`,
        monto: null, corte: false, grupo: grupo(diasEntre(hoy, fecha)), pago: null, destino: { tipo: 'CIERRE', ref: actual },
      });
    }
  }
  const siguiente = sumarMeses(actual, 1);
  const planSiguiente = planDe(estado, siguiente);
  if (planSiguiente && !planSiguiente.escenarioActivoId && opciones(planSiguiente).length > 1 && estadoEfectivo(planSiguiente, hoy) === 'BORRADOR') {
    const fecha = fechaEnMes(siguiente, 1);
    if (fecha <= hasta) {
      const dias = diasEntre(hoy, fecha);
      avisos.push({
        clave: `PLAN:opcion:${claveMes(siguiente)}`, tipo: 'PLAN', fecha, nombre: `Elegir opción de ${nombreMes(siguiente.mes)}`,
        detalle: `${nombreMesCapital(siguiente.mes)} empieza ${dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`} · ${opciones(planSiguiente).length} opciones`,
        monto: null, corte: false, grupo: grupo(dias), pago: null, destino: { tipo: 'COMPARAR', ref: siguiente },
      });
    }
  }
  return avisos;
}

/** Las cuentas sin cuadrar hace mas de 30 dias. */
function avisosDeCuadre(estado: EstadoHogar, hoy: Fecha): Aviso[] {
  return estado.cuentas.flatMap((c): Aviso[] => {
    const dias = diasEntre(c.fechaCuadre, hoy);
    if (c.cuadrada && dias <= DIAS_AVISO_CUADRE) return [];
    return [{
      clave: `CUADRAR:${c.id}:${claveMes(mesDe(hoy))}`, tipo: 'CUADRAR', fecha: hoy, nombre: `Cuadrar ${c.nombre}`, detalle: `Sin cuadrar desde el ${formatFechaCorta(c.fechaCuadre)}`,
      monto: null, corte: false, grupo: 'NO_OLVIDAR', pago: null, destino: { tipo: 'CUENTA', cuentaId: c.id },
    }];
  });
}

/** Lo vencido del mes en curso y lo que viene en `dias` dias, en el orden de Avisos (spec "Avisos · Próximos"). */
export function proximosAvisos(estado: EstadoHogar, hoy: Fecha, dias = DIAS_AVISOS): Aviso[] {
  const actual = mesDe(hoy);
  const hasta = new Date(Date.parse(`${hoy}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
  const meses = [actual, sumarMeses(actual, 1)];
  const avisos = [
    ...meses.flatMap((m, i) => avisosDePagos(estado, m, hoy, hasta, i === 0)),
    ...avisosDeCortes(estado, hoy, hasta),
    ...meses.flatMap((m, i) => avisosDeIngresos(estado, m, hoy, hasta, i === 0)),
    ...avisosDelPlan(estado, actual, hoy, hasta),
    ...avisosDeCuadre(estado, hoy),
  ];
  return avisos.sort((a, b) => ORDEN_GRUPO_AVISO[a.grupo] - ORDEN_GRUPO_AVISO[b.grupo] || a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre));
}

/** El numero de la campana: lo vencido y lo de los proximos 7 dias, sin los cortes (spec "Campana en Hoy"). */
export function pendientesAvisos(avisos: readonly Aviso[]): number {
  return avisos.filter((a) => (a.grupo === 'VENCIDO' || a.grupo === 'SEMANA') && !a.corte).length;
}
