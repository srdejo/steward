import type { Categoria, CierreMes, Escenario, EstadoHogar, Id, MesRef, Movimiento, PlanAnual, PlanMes, ReglaDiezmo, Usuario } from '../model';
import { ReglaError, mismoMes } from './base';

export function usuario(estado: EstadoHogar, id: Id): Usuario {
  const u = estado.usuarios.find((x) => x.id === id);
  if (!u) throw new ReglaError('NO_EXISTE', `No existe el usuario ${id}`);
  return u;
}

export function nombreUsuario(estado: EstadoHogar, id: Id): string {
  return estado.usuarios.find((x) => x.id === id)?.nombre ?? '';
}

export function reglaDe(estado: EstadoHogar, usuarioId: Id): ReglaDiezmo | null {
  const r = estado.reglas.find((x) => x.usuarioId === usuarioId);
  return r && r.activa ? r : null;
}

export function categoria(estado: EstadoHogar, id: Id): Categoria {
  const c = estado.categorias.find((x) => x.id === id);
  if (!c) throw new ReglaError('NO_EXISTE', `No existe la categoria ${id}`);
  return c;
}

export function planDe(estado: EstadoHogar, ref: MesRef): PlanMes | null {
  return estado.planes.find((p) => mismoMes(p.ref, ref)) ?? null;
}

export function planPorId(estado: EstadoHogar, id: Id): PlanMes {
  const p = estado.planes.find((x) => x.id === id);
  if (!p) throw new ReglaError('NO_EXISTE', `No existe el plan ${id}`);
  return p;
}

/** Opciones vigentes (no archivadas) en orden de letra. */
export function opciones(plan: PlanMes): Escenario[] {
  return plan.escenarios.filter((e) => !e.archivado).sort((a, b) => a.letra.localeCompare(b.letra));
}

/** La opcion que se ejecuta o se muestra primero: la elegida, o la primera vigente. */
export function escenarioPrincipal(plan: PlanMes): Escenario | null {
  const elegido = plan.escenarios.find((e) => e.id === plan.escenarioActivoId);
  return elegido ?? opciones(plan)[0] ?? null;
}

export function escenario(plan: PlanMes, id: Id): Escenario {
  const e = plan.escenarios.find((x) => x.id === id);
  if (!e) throw new ReglaError('NO_EXISTE', `No existe la opcion ${id}`);
  return e;
}

export function movimientosDe(estado: EstadoHogar, ref: MesRef): Movimiento[] {
  return estado.movimientos.filter((m) => mismoMes(m.ref, ref));
}

export function cierreDe(estado: EstadoHogar, ref: MesRef): CierreMes | null {
  return estado.cierres.find((c) => mismoMes(c.ref, ref)) ?? null;
}

export function anualDe(estado: EstadoHogar, anio: number): PlanAnual | null {
  return estado.anuales.find((a) => a.anio === anio) ?? null;
}

/** Un mes cerrado queda en solo lectura: nada se registra contra el. */
export function asegurarAbierto(estado: EstadoHogar, ref: MesRef): void {
  if (planDe(estado, ref)?.estado === 'CERRADO' || cierreDe(estado, ref)) throw new ReglaError('MES_CERRADO', 'El mes está cerrado');
}

/** Un pago o gasto desde "Su cuenta" (fuera de la app) cuenta como aporte de quien pago. */
export function esAporteImplicito(m: Movimiento): boolean {
  return (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.origen.tipo === 'EXTERNA';
}
