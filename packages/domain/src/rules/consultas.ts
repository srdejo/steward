import type { Categoria, CierreMes, Escenario, EstadoHogar, Id, MesRef, Movimiento, PlanAnual, PlanMes, ReglaDiezmo, Usuario, EventoAnual, OpcionAnual } from '../model';
import { ReglaError, mismoMes } from './base';

export function usuario(estado: EstadoHogar, id: Id): Usuario {
  const u = estado.usuarios.find((x) => x.id === id);
  if (!u) throw new ReglaError('NO_EXISTE', `No existe el usuario ${id}`);
  return u;
}

/** Quien ya no esta en el hogar: lo que registro se conserva (design D5 de app-movil-conectada). */
export const EX_MIEMBRO = 'Ex miembro';

export function nombreUsuario(estado: EstadoHogar, id: Id): string {
  return estado.usuarios.find((x) => x.id === id)?.nombre ?? EX_MIEMBRO;
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

/** La opcion pedida del plan anual; sin id (o si no existe), la que esta en uso o la primera (design D1 de anual-opciones-y-meses). */
export function opcionDe(anual: PlanAnual, id?: Id | null): OpcionAnual {
  return (id ? anual.opciones.find((o) => o.id === id) : undefined) ?? anual.opciones.find((o) => o.id === anual.opcionEnUso) ?? anual.opciones[0]!;
}

/**
 * Los eventos que tocan un mes en una opcion (por defecto la en uso): los que lo tienen en su rango, de su mes a su
 * `hasta` (design D1 de anual-evento-rango).
 */
export function eventosDelMes(anual: PlanAnual | null | undefined, mes: number, opcionId?: Id | null): EventoAnual[] {
  if (!anual || !anual.opciones.length) return [];
  return opcionDe(anual, opcionId).eventos.filter((e) => aplicaEn(e, mes));
}

/** Si un evento del año toca un mes: de su mes a su `hasta`. */
export function aplicaEn(e: Pick<EventoAnual, 'mes' | 'hasta'>, mes: number): boolean {
  return e.mes <= mes && mes <= e.hasta;
}

/** Un mes cerrado queda en solo lectura: nada se registra contra el. */
export function asegurarAbierto(estado: EstadoHogar, ref: MesRef): void {
  if (planDe(estado, ref)?.estado === 'CERRADO' || cierreDe(estado, ref)) throw new ReglaError('MES_CERRADO', 'El mes está cerrado');
}

/** Un pago o gasto desde "Su cuenta" (fuera de la app) cuenta como aporte de quien pago. */
export function esAporteImplicito(m: Movimiento): boolean {
  return (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.origen.tipo === 'EXTERNA';
}
