import type { CierreMes, EstadoHogar, Fecha, FilaCierre, Id, MesRef, Pesos } from '../model';
import { ReglaError, clonar, sumar, sumarMeses } from './base';
import { cierreDe, escenarioPrincipal, movimientosDe, planDe } from './consultas';
import { diezmoPlaneado, ingresosDelMes, totalIngresos } from './ingresos';
import { gruposDe } from './plan';

export interface VistaCierre {
  ref: MesRef;
  cerrado: boolean;
  filas: FilaCierre[];
  sinRegistrar: Pesos;
  /** Con lo que termino el mes: ingresos reales − gastos reales − sin registrar. */
  sobrante: Pesos;
  /** Lo que el plan esperaba dejar libre. */
  librePlaneado: Pesos;
  aAhorro: Pesos;
  aSiguiente: Pesos;
  siguiente: MesRef;
}

/** Plan vs real por categoria, "Sin registrar" y el sobrante. Si el mes ya cerro, devuelve lo guardado. */
export function vistaCierre(estado: EstadoHogar, ref: MesRef): VistaCierre {
  const guardado = cierreDe(estado, ref);
  const siguiente = sumarMeses(ref, 1);
  if (guardado) {
    const plan = guardado.filas.reduce((t, f) => t + (f.nombre === 'Ingresos' ? f.plan ?? 0 : -(f.plan ?? 0)), 0);
    return { ref, cerrado: true, filas: guardado.filas, sinRegistrar: guardado.sinRegistrar, sobrante: guardado.sobrante, librePlaneado: plan, aAhorro: guardado.aAhorro, aSiguiente: guardado.aSiguiente, siguiente };
  }
  const planMes = planDe(estado, ref);
  const items = planMes ? escenarioPrincipal(planMes)?.items ?? [] : [];
  const movs = movimientosDe(estado, ref);
  const realDe = (itemIds: Set<Id>) => sumar(movs.filter((m) => (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.itemId !== null && itemIds.has(m.itemId)).map((m) => m.monto));

  const ingresosPlan = totalIngresos(ingresosDelMes(estado, ref, 'PLAN'));
  const ingresosReal = totalIngresos(ingresosDelMes(estado, ref, 'EJECUCION'));
  const filas: FilaCierre[] = [{ nombre: 'Ingresos', plan: ingresosPlan, real: ingresosReal }];
  for (const g of gruposDe(estado, items)) {
    filas.push({ nombre: g.nombre, plan: g.total, real: realDe(new Set(g.items.map((i) => i.id))) });
  }
  const noPlaneado = sumar(movs.filter((m) => m.tipo === 'GASTO' && m.itemId === null).map((m) => m.monto));
  if (noPlaneado) filas.push({ nombre: 'No estaba planeado', plan: null, real: noPlaneado });
  const diezmo = diezmoPlaneado(estado, ref).monto;
  const entregado = sumar(movs.filter((m) => m.tipo === 'DIEZMO_ENTREGADO').map((m) => m.monto));
  if (diezmo || entregado) filas.push({ nombre: 'Diezmo', plan: diezmo, real: entregado });

  const sinRegistrar = sumar(movs.filter((m) => m.tipo === 'AJUSTE_CUADRE').map((m) => m.monto));
  const gastosReal = sumar(filas.slice(1).map((f) => f.real));
  const gastosPlan = sumar(filas.slice(1).map((f) => f.plan ?? 0));
  const sobrante = ingresosReal - gastosReal - sinRegistrar;
  return { ref, cerrado: false, filas, sinRegistrar, sobrante, librePlaneado: ingresosPlan - gastosPlan, aAhorro: 0, aSiguiente: 0, siguiente };
}

/** El reparto debe sumar exactamente el sobrante (si no sobro nada, ambos en cero). */
export function repartoValido(sobrante: Pesos, aAhorro: Pesos, aSiguiente: Pesos): boolean {
  if (aAhorro < 0 || aSiguiente < 0) return false;
  return aAhorro + aSiguiente === Math.max(0, sobrante);
}

/** "Cerrar mes": queda en solo lectura; lo que pasa al siguiente aparece como "Sobrante de {mes}" en sus ingresos. */
export function cerrarMes(estado: EstadoHogar, datos: { ref: MesRef; aAhorro: Pesos; aSiguiente: Pesos; cerradoPor: Id; fecha: Fecha }): EstadoHogar {
  const vista = vistaCierre(estado, datos.ref);
  if (vista.cerrado) throw new ReglaError('MES_CERRADO', 'El mes ya está cerrado');
  if (!repartoValido(vista.sobrante, datos.aAhorro, datos.aSiguiente)) throw new ReglaError('REPARTO_INVALIDO', 'El reparto debe sumar lo que sobró');
  const s = clonar(estado);
  const plan = planDe(s, datos.ref);
  if (plan) plan.estado = 'CERRADO';
  const cierre: CierreMes = {
    ref: datos.ref, filas: vista.filas, sinRegistrar: vista.sinRegistrar, sobrante: vista.sobrante,
    aAhorro: datos.aAhorro, aSiguiente: datos.aSiguiente, cerradoPor: datos.cerradoPor, cerradoEn: datos.fecha,
  };
  s.cierres.push(cierre);
  return s;
}
