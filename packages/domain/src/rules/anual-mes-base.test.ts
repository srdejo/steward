// Mes base editable de una opcion del año (spec steward-plan-anual, anual-mes-base-editable). Hoy: 26 oct 2026.
import { describe, expect, it } from 'vitest';
import { crearSemilla, DANIEL } from '../demo/seed';
import type { EstadoHogar, MesRef } from '../model';
import {
  ReglaError, anualDe, copiarMesBase, crearOActualizarMeses, guardarItemBase, nuevaOpcionDesdeBase, opcionDe, opciones, planDe, quitarItemBase,
  resumenAnual, usarMesBase, vistaMesBase,
} from '.';

const HOY = '2026-10-26';
const NOV: MesRef = { anio: 2026, mes: 11 };
const semilla = () => crearSemilla(HOY);

/** 2027 con la Opción B creada desde noviembre de 2026 (la semilla ya tiene la A). */
function conOpcionB() {
  return nuevaOpcionDesdeBase(semilla(), { anio: 2027, desde: { tipo: 'MES', ref: NOV }, creadoPor: DANIEL, hoy: HOY });
}

const base = (s: EstadoHogar, id: string) => opcionDe(anualDe(s, 2027)!, id).mesBase!;

describe('Mes base editable', () => {
  it('una opción desde noviembre: copia sus gastos sin el diezmo y llena las celdas', () => {
    const { estado, opcionId } = conOpcionB();
    const op = opcionDe(anualDe(estado, 2027)!, opcionId);
    expect(op.letra).toBe('B');
    expect(op.mesBase!.origen).toEqual(NOV);
    const noviembre = opciones(planDe(estado, NOV)!)[0]!.items.filter((i) => i.tipo !== 'DIEZMO').map((i) => i.nombre);
    expect(op.mesBase!.items.map((i) => i.nombre)).toEqual(noviembre);
    const r = resumenAnual(estado, 2027, opcionId)!;
    expect(r.gastos.find((g) => g.nombre === 'Variables')!.valores[0]).toBe(400_000);
    // La compra a cuotas termina en junio: Créditos baja desde julio.
    expect(r.gastos.find((g) => g.nombre === 'Créditos')!.valores.slice(5, 7)).toEqual([875_000, 500_000]);
  });

  it('ajustar el mes base no toca noviembre ni las celdas; usarlo sí', () => {
    const { estado, opcionId } = conOpcionB();
    const transporte = base(estado, opcionId).items.find((i) => i.nombre === 'Transporte')!;
    const apoyo = base(estado, opcionId).items.find((i) => i.nombre === 'Apoyo familiar')!;
    let s = guardarItemBase(estado, { anio: 2027, opcionId, item: { ...transporte, monto: 300_000 } });
    s = quitarItemBase(s, { anio: 2027, opcionId, itemId: apoyo.id });
    expect(base(s, opcionId).items.find((i) => i.nombre === 'Transporte')!.monto).toBe(300_000);
    expect(base(s, opcionId).items.some((i) => i.nombre === 'Apoyo familiar')).toBe(false);
    expect(planDe(s, NOV)).toEqual(planDe(estado, NOV));
    expect(resumenAnual(s, 2027, opcionId)!.gastos.find((g) => g.nombre === 'Variables')!.valores[0]).toBe(400_000);

    const usado = usarMesBase(s, { anio: 2027, opcionId, hoy: HOY });
    expect(resumenAnual(usado, 2027, opcionId)!.gastos.find((g) => g.nombre === 'Variables')!.valores).toEqual(Array(12).fill(300_000));
    expect(resumenAnual(usado, 2027, opcionId)!.cambios.length).toBe(resumenAnual(s, 2027, opcionId)!.cambios.length);

    const meses = crearOActualizarMeses(usado, { anio: 2027, opcionId, actualizar: [], creadoPor: DANIEL, hoy: HOY });
    const marzo = opciones(planDe(meses, { anio: 2027, mes: 3 })!)[0]!.items;
    expect(marzo.find((i) => i.nombre === 'Transporte')!.monto).toBe(300_000);
    expect(marzo.some((i) => i.nombre === 'Apoyo familiar')).toBe(false);
  });

  it('la vista del editor: grupos, lo que entra y sale, y el crédito que termina', () => {
    const { estado, opcionId } = conOpcionB();
    const v = vistaMesBase(estado, 2027, opcionId, HOY);
    expect(v.origen).toEqual(NOV);
    expect(v.grupos.map((g) => g.nombre)).toEqual(['Gastos fijos', 'Variables', 'Tarjetas', 'Créditos', 'Ahorro']);
    expect(v.grupos.find((g) => g.nombre === 'Créditos')!.filas.find((f) => f.item.nombre === 'Compra a cuotas')!.terminaEn).toBe(6);
    expect(v.libreMes).toBe(v.entra - v.sale - v.diezmo);
    expect(v.libreAnio).toBe(sumaAnio(v.libreMes));
  });

  it('copiar otro mes, la categoría Diezmo y un mes sin plan', () => {
    const { estado, opcionId } = conOpcionB();
    const s = copiarMesBase(estado, { anio: 2027, opcionId, desde: { tipo: 'CERO' } });
    expect(base(s, opcionId)).toEqual({ origen: null, items: [] });
    expect(() => guardarItemBase(s, { anio: 2027, opcionId, item: { categoriaId: 'cat-diezmo', nombre: 'X', monto: 1, diaVence: null, tipo: 'DIEZMO', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false } }))
      .toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
    expect(() => nuevaOpcionDesdeBase(semilla(), { anio: 2027, desde: { tipo: 'MES', ref: { anio: 2026, mes: 12 } }, creadoPor: DANIEL, hoy: HOY })).toThrow(ReglaError);
  });

  it('un año sin plan: la opción nueva es su Opción A', () => {
    const { estado, opcionId } = nuevaOpcionDesdeBase(semilla(), { anio: 2028, desde: { tipo: 'MES', ref: NOV }, creadoPor: DANIEL, hoy: HOY });
    expect(anualDe(estado, 2028)!.opciones.map((o) => [o.id, o.letra])).toEqual([[opcionId, 'A']]);
  });
});

/** En 2027 la compra a cuotas ($375.000) se paga de enero a junio; el resto del año deja eso de más. */
function sumaAnio(libreMes: number): number {
  return libreMes * 12 + 375_000 * 6;
}
