import type { Categoria, Cuenta, EstadoHogar, IngresoFijo, ItemPlan, Movimiento, Origen, PlanMes, ReglaDiezmo } from '@steward/domain';

import {
  usuarioDe,
  type CategoriaApi,
  type FinanzasApi,
  type IngresoFijoApi,
  type MovimientoApi,
  type PlanApi,
  type ReglaDiezmoApi,
  type UsuarioApi,
} from './api';

/**
 * Superpone las finanzas reales del backend al estado de prueba (design D5 de backend-ingresos-diezmo y de
 * backend-plan-mes-hoy), para que Hoy, Planear, Cuentas y el Cierre calculen con las reglas del dominio:
 * - categorias, ingresos fijos, reglas, cuentas, "Diezmo en Hoy" y los planes son los reales;
 * - lo registrado es solo lo real: todos los movimientos de prueba se quitan;
 * - no hay cierres reales hasta la Etapa 6, asi que los de prueba tampoco se ven;
 * - los miembros reales entran a `usuarios` con su id, que es el que usan las hojas de Hoy al registrar.
 * Siguen de prueba los creditos, el plan anual y las proyecciones.
 *
 * Es pura: no cambia `estado`, y el adaptador de prueba nunca la guarda.
 */
export function superponerFinanzas(estado: EstadoHogar, finanzas: FinanzasApi, miembros: UsuarioApi[]): EstadoHogar {
  // Las cuentas reales arrancan despues de todo lo de prueba, y lo registrado despues de ellas: asi el saldo estimado
  // (ultimo cuadre + movimientos posteriores) suma lo real y no lo de prueba.
  const base = estado.secuencia;
  const reales = finanzas.movimientos.map((m, i) => movimiento(m, base + i + 1));
  const ids = new Set(estado.usuarios.map((u) => u.id));

  return {
    ...estado,
    secuencia: base + reales.length,
    usuarios: [...estado.usuarios, ...miembros.filter((m) => !ids.has(m.id)).map(usuarioDe)],
    hogar: { ...estado.hogar, diezmoEnHoy: finanzas.diezmoEnHoy },
    categorias: finanzas.categorias.map(categoria),
    ingresosFijos: finanzas.ingresosFijos.map(ingresoFijo),
    reglas: finanzas.reglas.map(regla),
    cuentas: finanzas.cuentas.map(
      (c): Cuenta => ({ id: c.id, nombre: c.nombre, titularId: c.titularId, saldoCuadre: c.saldoCuadre, fechaCuadre: c.fechaCuadre, cuadrada: c.cuadrada, seqCuadre: base }),
    ),
    planes: finanzas.planes.map(plan),
    movimientos: reales,
    cierres: [],
  };
}

export function ingresoFijo(i: IngresoFijoApi): IngresoFijo {
  return { id: i.id, usuarioId: i.usuarioId, nombre: i.nombre, bruto: i.bruto, neto: i.neto, diaPago: i.diaPago, cuentaId: i.cuentaId, activo: i.activo };
}

export function regla(r: ReglaDiezmoApi): ReglaDiezmo {
  return { usuarioId: r.usuarioId, activa: r.activa, porcentaje: r.porcentaje, base: r.base, aplicaAportes: r.aplicaAportes };
}

export function categoria(c: CategoriaApi): Categoria {
  return { id: c.id, nombre: c.nombre, color: c.color, orden: c.orden, tipo: c.tipo, sistema: c.sistema };
}

function plan(p: PlanApi): PlanMes {
  return {
    id: p.id,
    ref: { anio: p.ref.anio, mes: p.ref.mes },
    estado: p.estado,
    escenarioActivoId: p.escenarioActivoId,
    escenarios: p.escenarios.map((e) => ({
      id: e.id,
      letra: e.letra,
      creadoPor: e.creadoPor,
      nota: e.nota,
      archivado: e.archivado,
      // El vinculo con un credito llega en la Etapa 5.
      items: e.items.map((i): ItemPlan => ({ id: i.id, categoriaId: i.categoriaId, nombre: i.nombre, monto: i.monto, diaVence: i.diaVence, tipo: i.tipo, cuota: i.cuota, creditoId: null })),
    })),
  };
}

function origen(m: MovimientoApi): Origen {
  if (m.origen === 'EXTERNA') return { tipo: 'EXTERNA' };
  return m.origen === 'CUENTA' && m.cuentaId ? { tipo: 'CUENTA', cuentaId: m.cuentaId } : { tipo: 'NINGUNO' };
}

function movimiento(m: MovimientoApi, seq: number): Movimiento {
  return {
    id: m.id,
    seq,
    tipo: m.tipo,
    ref: { anio: m.ref.anio, mes: m.ref.mes },
    monto: m.monto,
    fecha: m.fecha,
    usuarioId: m.usuarioId,
    creadoPor: m.creadoPor,
    origen: origen(m),
    nota: m.nota ?? '',
    itemId: m.itemId ?? null,
    ingresoFijoId: m.ingresoFijoId,
    bruto: m.bruto,
    aplicaDiezmo: m.aplicaDiezmo,
    diezmoDe: m.diezmoDe,
    cuentaDestinoId: null,
    creditoId: null,
  };
}
