// Opciones del plan anual y "Meses con la Opción X" (spec steward-plan-anual, anual-opciones-y-meses). Hoy: 26 oct 2026.
import { describe, expect, it } from 'vitest';
import { crearSemilla, DANIEL, ESPOSA } from '../demo/seed';
import type { EstadoHogar, MesRef } from '../model';
import {
  ReglaError, agregarEvento, crearMes, crearOActualizarMeses, duplicarOpcionAnual, editarMontoAnual, marcarPago, mesesDesdeAnual, opcionDe, opciones,
  planDe, quitarOpcionAnual, replicarMes, resumenAnual, anualDe,
} from '.';

const HOY = '2026-10-26';
const OCT: MesRef = { anio: 2026, mes: 10 };
const semilla = () => crearSemilla(HOY);
const gastos = (s: EstadoHogar, ref: MesRef) => opciones(planDe(s, ref)!)[0]!.items.filter((i) => i.tipo !== 'DIEZMO');
const nombres = (s: EstadoHogar, ref: MesRef) => gastos(s, ref).map((i) => i.nombre);

/** 2027 con la Opción B "con carro nuevo": venta del carro viejo en marzo y la cuota del carro desde abril. */
function conCarro() {
  const { estado, opcionId } = duplicarOpcionAnual(semilla(), { anio: 2027, opcionId: 'anual-sig-a', creadoPor: ESPOSA });
  let s = agregarEvento(estado, { anio: 2027, opcionId, evento: { nombre: 'Venta carro viejo', mes: 3, monto: 8_000_000, tipo: 'INGRESO', usuarioId: null } });
  s = agregarEvento(s, { anio: 2027, opcionId, evento: { nombre: 'Cuota carro nuevo', mes: 4, monto: 1_200_000, tipo: 'GASTO', usuarioId: null, categoriaId: 'cat-creditos', enAdelante: true } });
  return { s, b: opcionId };
}

/** Marzo a diciembre de 2027 creados antes de llenar el año: solo el salario y su diezmo (el caso de Daniel). */
function mesesVacios(): EstadoHogar {
  let s = semilla();
  for (let mes = 3; mes <= 12; mes++) s = crearMes(s, { ref: { anio: 2027, mes }, modo: 'CERO', creadoPor: DANIEL });
  for (const p of s.planes.filter((x) => x.ref.anio === 2027)) for (const e of p.escenarios) e.items = e.items.filter((i) => i.tipo === 'DIEZMO');
  return s;
}

describe('Opciones del plan anual', () => {
  it('duplicar la A: la B a nombre de Esposa, con las mismas celdas y eventos', () => {
    const { estado, opcionId } = duplicarOpcionAnual(semilla(), { anio: 2027, opcionId: 'anual-sig-a', creadoPor: ESPOSA });
    const anual = anualDe(estado, 2027)!;
    const b = opcionDe(anual, opcionId);
    expect([b.letra, b.creadoPor]).toEqual(['B', ESPOSA]);
    expect(b.filas).toEqual(anual.opciones[0]!.filas);
    expect(b.eventos.map((e) => e.nombre)).toEqual(anual.opciones[0]!.eventos.map((e) => e.nombre));
    expect(resumenAnual(estado, 2027, opcionId)!.libre).toEqual(resumenAnual(estado, 2027)!.libre);
  });

  it('cambiar solo la B: con carro nuevo deja $2.800.000 menos en el año y la A no cambia', () => {
    const { s, b } = conCarro();
    const a = resumenAnual(s, 2027)!;
    const rb = resumenAnual(s, 2027, b)!;
    expect(a.kpis.libreAnio).toBe(resumenAnual(semilla(), 2027)!.kpis.libreAnio);
    expect(rb.kpis.libreAnio - a.kpis.libreAnio).toBe(8_000_000 - 9 * 1_200_000);
    expect(rb.libre[3]! - a.libre[3]!).toBe(-1_200_000);
    expect(rb.libreA).toEqual(a.libre);
    expect(rb.opcion.letra).toBe('B');
    expect(rb.opciones.map((o) => [o.letra, o.inicialAutor, o.libreAnio])).toEqual([['A', 'D', a.kpis.libreAnio], ['B', 'E', rb.kpis.libreAnio]]);
    // Celdas de la B tampoco tocan la A.
    const celda = editarMontoAnual(s, { anio: 2027, categoriaId: 'cat-fijos', mes: 1, monto: 900_000, opcionId: b });
    expect(resumenAnual(celda, 2027)!.gastos[0]!.valores[0]).toBe(795_000);
  });

  it('quitar: la B sí; la última o la que está en uso, no', () => {
    const { s, b } = conCarro();
    expect(anualDe(quitarOpcionAnual(s, { anio: 2027, opcionId: b }), 2027)!.opciones.map((o) => o.letra)).toEqual(['A']);
    expect(() => quitarOpcionAnual(semilla(), { anio: 2027, opcionId: 'anual-sig-a' })).toThrow(expect.objectContaining({ codigo: 'OPCION_EN_USO' }));
    const enUso = crearOActualizarMeses(s, { anio: 2027, opcionId: b, actualizar: [], creadoPor: DANIEL, hoy: HOY });
    expect(() => quitarOpcionAnual(enUso, { anio: 2027, opcionId: b })).toThrow(expect.objectContaining({ codigo: 'OPCION_EN_USO' }));
    expect(() => duplicarOpcionAnual(s, { anio: 2027, opcionId: 'otra', creadoPor: DANIEL })).toThrow(expect.objectContaining({ codigo: 'OPCION_NO_ENCONTRADA' }));
  });
});

describe('Meses con la Opción X', () => {
  it('el caso real: marzo a diciembre vacíos se actualizan; febrero con un pago no se toca', () => {
    let s = mesesVacios();
    s = crearMes(s, { ref: { anio: 2027, mes: 2 }, modo: 'CERO', creadoPor: DANIEL });
    const febrero = gastos(s, { anio: 2027, mes: 2 })[0]!;
    s = marcarPago(s, { itemId: febrero.id, ref: { anio: 2027, mes: 2 }, monto: febrero.monto, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });

    const vista = mesesDesdeAnual(s, 2027);
    expect(vista.map((m) => m.accion)).toEqual(['CREAR', 'BLOQUEADO', ...Array(10).fill('ACTUALIZABLE')]);
    expect([vista[1]!.motivo, vista[2]!.marcado, vista[2]!.ahora]).toEqual(['Tiene pagos', true, 'Borrador · solo ingresos y diezmo']);

    expect(() => crearOActualizarMeses(s, { anio: 2027, actualizar: [2, 3], creadoPor: DANIEL, hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'MES_CON_REGISTROS' }));

    const listo = crearOActualizarMeses(s, { anio: 2027, actualizar: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], creadoPor: DANIEL, hoy: HOY });
    expect(nombres(listo, { anio: 2027, mes: 3 })).toEqual(expect.arrayContaining(['Pensión', 'Tarjeta Mastercard', 'Cuota libre inversión', 'SOAT']));
    expect(nombres(listo, { anio: 2027, mes: 4 })).toContain('Predial');
    expect(planDe(listo, { anio: 2027, mes: 3 })!.escenarios[0]!.nota).toBe('Del plan anual');
    expect(planDe(listo, { anio: 2027, mes: 2 })).toEqual(planDe(s, { anio: 2027, mes: 2 }));
    expect(nombres(listo, { anio: 2027, mes: 1 })).toContain('Matrícula');
    const anual = anualDe(listo, 2027)!;
    expect([anual.estado, anual.opcionEnUso]).toEqual(['CREADO', 'anual-sig-a']);
  });

  it('un mes hecho a mano sale sin marcar', () => {
    const s = crearMes(semilla(), { ref: { anio: 2027, mes: 1 }, modo: 'COPIAR', creadoPor: DANIEL });
    expect(mesesDesdeAnual(crearMes(s, { ref: { anio: 2027, mes: 2 }, modo: 'COPIAR', creadoPor: DANIEL }), 2027)[1]).toMatchObject({ accion: 'ACTUALIZABLE', marcado: false });
  });

  it('la compra a cuotas sale de enero a junio y no después', () => {
    const s = crearOActualizarMeses(semilla(), { anio: 2027, actualizar: [], creadoPor: DANIEL, hoy: HOY });
    expect(nombres(s, { anio: 2027, mes: 6 })).toContain('Compra a cuotas');
    expect(nombres(s, { anio: 2027, mes: 7 })).not.toContain('Compra a cuotas');
  });

  it('tarjetas sin fila: cada mes trae la Mastercard del mes base', () => {
    let s = replicarMes(semilla(), { anio: 2028, base: { tipo: 'MES', ref: OCT }, hoy: HOY });
    const op = opcionDe(anualDe(s, 2028)!);
    op.filas = op.filas.filter((f) => f.categoriaId !== 'cat-tarjetas');
    expect(resumenAnual(s, 2028)!.gastos.find((g) => g.nombre === 'Tarjetas')!.valores[0]).toBe(2_620_000);
    s = crearOActualizarMeses(s, { anio: 2028, actualizar: [], creadoPor: DANIEL, hoy: HOY });
    expect(gastos(s, { anio: 2028, mes: 5 }).find((i) => i.nombre === 'Tarjeta Mastercard')).toMatchObject({ monto: 1_500_000, categoriaId: 'cat-tarjetas' });
  });

  it('replicar con los meses creados se puede; la fila Créditos baja tras la última cuota', () => {
    const creado = crearOActualizarMeses(semilla(), { anio: 2027, actualizar: [], creadoPor: DANIEL, hoy: HOY });
    const s = replicarMes(creado, { anio: 2027, base: { tipo: 'MES', ref: OCT }, hoy: HOY });
    const creditos = resumenAnual(s, 2027)!.gastos.find((g) => g.nombre === 'Créditos')!.valores;
    expect(creditos).toEqual([...Array(6).fill(875_000), ...Array(6).fill(500_000)]);
    expect(planDe(s, { anio: 2027, mes: 3 })).toEqual(planDe(creado, { anio: 2027, mes: 3 }));
  });

  it('un año sin plan anual', () => {
    expect(() => mesesDesdeAnual(semilla(), 2030)).toThrow(ReglaError);
  });
});
