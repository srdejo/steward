import type { Cuenta, EstadoHogar, IngresoFijo, Movimiento, ReglaDiezmo } from '@steward/domain';

import { usuarioDe, type FinanzasApi, type IngresoFijoApi, type MovimientoApi, type ReglaDiezmoApi, type UsuarioApi } from './api';

/**
 * Superpone las finanzas reales del backend al estado de prueba (design D5 de backend-ingresos-diezmo), para que Hoy,
 * Planear, Cuentas y el Cierre calculen con las reglas del dominio sobre datos mezclados:
 * - ingresos fijos, reglas, cuentas y "Diezmo en Hoy" son los reales;
 * - los ingresos recibidos y los diezmos entregados del mes en curso son los reales; los de prueba de ese mes se quitan;
 * - los miembros reales entran a `usuarios` con su id, que es el que usan las hojas de Hoy al registrar.
 *
 * Es pura: no cambia `estado`, y el adaptador de prueba nunca la guarda.
 */
export function superponerFinanzas(estado: EstadoHogar, finanzas: FinanzasApi, miembros: UsuarioApi[]): EstadoHogar {
  const { mes } = finanzas;
  const delMesReal = (m: Movimiento) =>
    (m.tipo === 'INGRESO_FIJO' || m.tipo === 'DIEZMO_ENTREGADO') && m.ref.anio === mes.anio && m.ref.mes === mes.mes;
  // Las cuentas reales arrancan despues de todo lo de prueba, y lo real recibido despues de ellas: asi el saldo
  // estimado (ultimo cuadre + movimientos posteriores) suma lo real y no lo de prueba.
  const base = estado.secuencia;
  const reales = finanzas.movimientos.map((m, i) => movimiento(m, base + i + 1));
  const ids = new Set(estado.usuarios.map((u) => u.id));

  return {
    ...estado,
    secuencia: base + reales.length,
    usuarios: [...estado.usuarios, ...miembros.filter((m) => !ids.has(m.id)).map(usuarioDe)],
    hogar: { ...estado.hogar, diezmoEnHoy: finanzas.diezmoEnHoy },
    ingresosFijos: finanzas.ingresosFijos.map(ingresoFijo),
    reglas: finanzas.reglas.map(regla),
    cuentas: finanzas.cuentas.map(
      (c): Cuenta => ({ id: c.id, nombre: c.nombre, titularId: c.titularId, saldoCuadre: c.saldoCuadre, fechaCuadre: c.fechaCuadre, cuadrada: c.cuadrada, seqCuadre: base }),
    ),
    movimientos: [...estado.movimientos.filter((m) => !delMesReal(m)), ...reales],
  };
}

export function ingresoFijo(i: IngresoFijoApi): IngresoFijo {
  return { id: i.id, usuarioId: i.usuarioId, nombre: i.nombre, bruto: i.bruto, neto: i.neto, diaPago: i.diaPago, cuentaId: i.cuentaId, activo: i.activo };
}

export function regla(r: ReglaDiezmoApi): ReglaDiezmo {
  return { usuarioId: r.usuarioId, activa: r.activa, porcentaje: r.porcentaje, base: r.base, aplicaAportes: r.aplicaAportes };
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
    origen: m.cuentaId ? { tipo: 'CUENTA', cuentaId: m.cuentaId } : { tipo: 'NINGUNO' },
    nota: '',
    itemId: null,
    ingresoFijoId: m.ingresoFijoId,
    bruto: m.bruto,
    aplicaDiezmo: m.aplicaDiezmo,
    diezmoDe: m.diezmoDe,
    cuentaDestinoId: null,
    creditoId: null,
  };
}
