import type { Categoria, CierreMes, Credito, PlanAnual, Tarjeta, Cuenta, EstadoHogar, IngresoFijo, IngresoPlan, ItemPlan, Movimiento, Origen, PlanMes, ReglaDiezmo } from '../index';

import { colorCategoria, hastaDe } from '../index';
import {
  usuarioDe,
  type AnualApi,
  type CategoriaApi,
  type CierreApi,
  type CreditoApi,
  type FinanzasApi,
  type IngresoFijoApi,
  type ItemPlanApi,
  type MovimientoApi,
  type PlanApi,
  type ReglaDiezmoApi,
  type TarjetaApi,
  type UsuarioApi,
} from './api';

/**
 * Superpone las finanzas reales del backend al estado de prueba (design D5 de backend-ingresos-diezmo y de
 * backend-plan-mes-hoy, D2 y D7 de backend-cuentas-creditos), para que Hoy, Planear, Cuentas y el Cierre calculen con las
 * reglas del dominio:
 * - categorias, ingresos fijos, reglas, cuentas, creditos y los planes (con sus lineas de ingreso) son los reales;
 * - lo registrado es solo lo real: todos los movimientos de prueba se quitan;
 * - los cierres son los reales (design D5 de backend-cierre-mes): un mes cerrado muestra su foto y el siguiente su sobrante;
 * - los miembros reales entran a `usuarios` con su id, que es el que usan las hojas de Hoy al registrar.
 * - el plan anual y los aportes proyectados son los reales (design D5 de backend-plan-anual): ya nada es de prueba.
 *
 * Es pura: no cambia `estado`, y el adaptador de prueba nunca la guarda.
 */
export function superponerFinanzas(estado: EstadoHogar, finanzas: FinanzasApi, miembros: UsuarioApi[]): EstadoHogar {
  // El orden real de registro (seq) va despues de todo lo de prueba, igual para las cuentas: asi el saldo estimado
  // (ultimo cuadre + lo registrado despues) es el mismo que usa el backend al cuadrar.
  const base = estado.secuencia;
  const reales = finanzas.movimientos.map((m) => movimiento(m, base + m.seq));
  const ultimo = Math.max(0, ...finanzas.movimientos.map((m) => m.seq), ...finanzas.cuentas.map((c) => c.seqCuadre));
  const ids = new Set(estado.usuarios.map((u) => u.id));

  return {
    ...estado,
    secuencia: base + ultimo,
    usuarios: [...estado.usuarios, ...miembros.filter((m) => !ids.has(m.id)).map(usuarioDe)],
    // Los miembros reales: el anual muestra una fila de aportes por cada uno.
    hogar: { ...estado.hogar, miembros: miembros.map((m) => ({ usuarioId: m.id, unidoEn: '' })) },
    categorias: finanzas.categorias.map(categoria),
    ingresosFijos: finanzas.ingresosFijos.map(ingresoFijo),
    reglas: finanzas.reglas.map(regla),
    cuentas: finanzas.cuentas.map(
      (c): Cuenta => ({ id: c.id, nombre: c.nombre, titularId: c.titularId, saldoCuadre: c.saldoCuadre, fechaCuadre: c.fechaCuadre, cuadrada: c.cuadrada, seqCuadre: base + c.seqCuadre }),
    ),
    creditos: finanzas.creditos.map(credito),
    tarjetas: (finanzas.tarjetas ?? []).map(tarjeta),
    planes: finanzas.planes.map(plan),
    movimientos: reales,
    cierres: finanzas.cierres.map(cierre),
    anuales: finanzas.anuales.map(anual),
    proyecciones: finanzas.proyecciones.map((p) => ({ usuarioId: p.usuarioId, ref: { anio: p.anio, mes: p.mes }, monto: p.monto })),
  };
}

export function ingresoFijo(i: IngresoFijoApi): IngresoFijo {
  return { id: i.id, usuarioId: i.usuarioId, nombre: i.nombre, bruto: i.bruto, neto: i.neto, diaPago: i.diaPago, cuentaId: i.cuentaId, activo: i.activo };
}

export function regla(r: ReglaDiezmoApi): ReglaDiezmo {
  return { usuarioId: r.usuarioId, activa: r.activa, porcentaje: r.porcentaje, base: r.base, aplicaAportes: r.aplicaAportes };
}

export function categoria(c: CategoriaApi): Categoria {
  return { id: c.id, nombre: c.nombre, color: colorCategoria(c), orden: c.orden, tipo: c.tipo, sistema: c.sistema };
}

/** Cada opcion del año, con sus celdas tocadas por categoria en filas de 12 montos (design D2 de anual-opciones-y-meses). */
export function anual(a: AnualApi): PlanAnual {
  return {
    anio: a.anio, estado: a.estado, opcionEnUso: a.opcionEnUso ?? null,
    opciones: a.opciones.map((o) => {
      const filas = new Map<string, number[]>();
      for (const c of o.celdas) {
        const montos = filas.get(c.categoriaId) ?? Array.from({ length: 12 }, () => 0);
        montos[c.mes - 1] = c.monto;
        filas.set(c.categoriaId, montos);
      }
      return {
        id: o.id, letra: o.letra, creadoPor: o.creadoPor, nota: o.nota ?? '',
        filas: [...filas].map(([categoriaId, montos]) => ({ categoriaId, montos })),
        eventos: o.eventos.map((e) => ({ id: e.id, nombre: e.nombre, mes: e.mes, monto: e.monto, tipo: e.tipo, usuarioId: e.usuarioId ?? null, categoriaId: e.categoriaId ?? null, hasta: hastaDe(e) })),
        base: o.base ? { anio: o.base.anio, mes: o.base.mes } : null,
        mesBase: o.mesBase
          ? { origen: o.mesBase.origen ? { anio: o.mesBase.origen.anio, mes: o.mesBase.origen.mes } : null, items: o.mesBase.items.map(itemPlan) }
          : null,
      };
    }),
  };
}

export function cierre(c: CierreApi): CierreMes {
  return {
    ref: { anio: c.ref.anio, mes: c.ref.mes }, filas: c.filas.map((f) => ({ nombre: f.nombre, plan: f.plan ?? null, real: f.real })),
    sinRegistrar: c.sinRegistrar, sobrante: c.sobrante, aAhorro: c.aAhorro, aSiguiente: c.aSiguiente, cerradoPor: c.cerradoPor, cerradoEn: c.cerradoEn,
  };
}

export function credito(c: CreditoApi): Credito {
  return {
    id: c.id, nombre: c.nombre, entidad: c.entidad, saldo: c.saldo, saldoActualizadoEn: c.saldoActualizadoEn, cuota: c.cuota,
    tasaEM: c.tasaEM, diaPago: c.diaPago, totalOriginal: c.totalOriginal, pagos: c.pagos.map((p) => ({ ...p })),
    metodo: c.metodo ?? 'TASA', numeroCuotas: c.numeroCuotas ?? null, cuotasPagadas: c.cuotasPagadas ?? 0, valorFinanciado: c.valorFinanciado ?? null,
  };
}

export function tarjeta(t: TarjetaApi): Tarjeta {
  return {
    id: t.id, nombre: t.nombre, diaCorte: t.diaCorte, diaPago: t.diaPago, uso: t.uso,
    pago: t.pagoTipo === 'FIJO' ? { tipo: 'FIJO', monto: t.pagoMonto } : { tipo: 'COMPLETA', estimado: t.pagoMonto },
  };
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
      ingresos: (e.ingresos ?? []).map((l): IngresoPlan => ({ id: l.id, nombre: l.nombre, monto: l.monto, usuarioId: l.usuarioId ?? null, tipo: l.tipo, ingresoFijoId: l.ingresoFijoId ?? null, bruto: l.bruto ?? l.monto })),
      items: e.items.map(itemPlan),
    })),
  };
}

function itemPlan(i: ItemPlanApi): ItemPlan {
  return {
    id: i.id, categoriaId: i.categoriaId, nombre: i.nombre, monto: i.monto, diaVence: i.diaVence, tipo: i.tipo, cuota: i.cuota,
    creditoId: i.creditoId ?? null, ingresoFijoId: i.ingresoFijoId ?? null, aporteId: i.aporteId ?? null, ingresoPlanId: i.ingresoPlanId ?? null, ajustadoAMano: i.ajustadoAMano ?? false, tarjetaId: i.tarjetaId ?? null,
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
    cuentaDestinoId: m.cuentaDestinoId ?? null,
    creditoId: m.creditoId ?? null,
    ingresoPlanId: m.ingresoPlanId ?? null,
    capital: m.capital ?? null,
  };
}
