// "Datos de pago de un gasto" y "Datos de pago en el mes base" (gastos-datos-pago). Hoy: 26 oct 2026.
// Semilla: agosto y septiembre cerrados, octubre activo, noviembre en borrador con opciones A, B y C.
import { describe, expect, it } from 'vitest';
import { DANIEL, crearSemilla } from '../demo/seed';
import type { EstadoHogar, ItemPlan, MesRef } from '../model';
import { anualDe, crearMes, guardarItem, guardarItemBase, nuevaOpcionDesdeBase, opcionDe, planDe, crearOActualizarMeses, usarMesBase } from '.';

const HOY = '2026-10-26';
const SEP: MesRef = { anio: 2026, mes: 9 };
const OCT: MesRef = { anio: 2026, mes: 10 };
const NOV: MesRef = { anio: 2026, mes: 11 };
const DIC: MesRef = { anio: 2026, mes: 12 };
const ENLACE = 'https://pagos.ejemplo.com';

const items = (s: EstadoHogar, ref: MesRef, nombre: string) =>
  planDe(s, ref)!.escenarios.flatMap((e) => e.items).filter((i) => i.nombre === nombre);
const internetOct = (s: EstadoHogar) => planDe(s, OCT)!.escenarios[0]!.items.find((i) => i.nombre === 'Internet')!;

function guardar(s: EstadoHogar, cambios: Partial<ItemPlan>, aplicarAMeses = true, ref = OCT, nombre = 'Internet') {
  const plan = planDe(s, ref)!;
  const esc = plan.escenarios[0]!;
  const item = esc.items.find((i) => i.nombre === nombre)!;
  return guardarItem(s, { planId: plan.id, escenarioId: esc.id, item: { ...item, ...cambios }, aplicarAMeses });
}

describe('datos de pago de un gasto', () => {
  it('aplicar a los meses ya planeados: el mes, sus otras opciones y los siguientes, no los cerrados', () => {
    const s = guardar(crearSemilla(HOY), { enlacePago: ` ${ENLACE} `, codigoPago: '123456' });
    expect(internetOct(s)).toMatchObject({ enlacePago: ENLACE, codigoPago: '123456' });
    const nov = items(s, NOV, 'Internet');
    expect(nov.length).toBeGreaterThan(1);
    for (const i of nov) expect(i).toMatchObject({ enlacePago: ENLACE, codigoPago: '123456' });
    for (const i of items(s, SEP, 'Internet')) expect(i.enlacePago ?? null).toBeNull();
  });

  it('solo este mes si no se marca la casilla', () => {
    const s = guardar(crearSemilla(HOY), { codigoPago: '987' }, false);
    expect(internetOct(s).codigoPago).toBe('987');
    for (const i of items(s, NOV, 'Internet')) expect(i.codigoPago ?? null).toBeNull();
  });

  it('el mismo nombre en otra categoría o con otro nombre no cambia', () => {
    const s = guardar(crearSemilla(HOY), { codigoPago: '987' });
    for (const i of items(s, NOV, 'Recibo Luz')) expect(i.codigoPago ?? null).toBeNull();
  });

  it('sin indicar los datos se conservan; vacío los quita', () => {
    const con = guardar(crearSemilla(HOY), { enlacePago: ENLACE, codigoPago: '123' }, false);
    const { enlacePago: _e, codigoPago: _c, ...sinPago } = internetOct(con);
    const plan = planDe(con, OCT)!;
    const editado = guardarItem(con, { planId: plan.id, escenarioId: plan.escenarios[0]!.id, item: { ...sinPago, monto: 130_000 } });
    expect(internetOct(editado)).toMatchObject({ monto: 130_000, enlacePago: ENLACE, codigoPago: '123' });
    const quitado = guardar(con, { enlacePago: '', codigoPago: null }, false);
    expect(internetOct(quitado)).toMatchObject({ enlacePago: null, codigoPago: null });
  });

  it('el enlace debe ser http(s) y el código de hasta 60', () => {
    for (const enlacePago of ['javascript:alert(1)', 'pagos.ejemplo.com', 'https://a b.com', 'https://' + 'a'.repeat(500)]) {
      expect(() => guardar(crearSemilla(HOY), { enlacePago })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
    }
    expect(() => guardar(crearSemilla(HOY), { codigoPago: 'x'.repeat(61) })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
    expect(internetOct(guardar(crearSemilla(HOY), { enlacePago: 'HTTP://pagos.ejemplo.com/x?y=1' })).enlacePago).toBe('HTTP://pagos.ejemplo.com/x?y=1');
  });

  it('un gasto nuevo sin datos se guarda como siempre', () => {
    const s = crearSemilla(HOY);
    const plan = planDe(s, OCT)!;
    const nuevo = guardarItem(s, {
      planId: plan.id, escenarioId: plan.escenarios[0]!.id, aplicarAMeses: true,
      item: { categoriaId: 'cat-variables', nombre: 'Mercado extra', monto: 10_000, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false },
    });
    expect(items(nuevo, OCT, 'Mercado extra')[0]).toMatchObject({ enlacePago: null, codigoPago: null });
  });

  it('el mes nuevo los trae al copiar el anterior y con solo los fijos', () => {
    const s = guardar(crearSemilla(HOY), { enlacePago: ENLACE, codigoPago: '123' }, true, NOV);
    for (const modo of ['COPIAR', 'FIJOS'] as const) {
      const dic = crearMes(s, { ref: DIC, modo, creadoPor: DANIEL });
      expect(items(dic, DIC, 'Internet')[0]).toMatchObject({ enlacePago: ENLACE, codigoPago: '123' });
    }
  });
});

describe('datos de pago en el mes base', () => {
  it('replicar un mes los trae y los meses creados desde el anual también', () => {
    const s = guardar(crearSemilla(HOY), { enlacePago: ENLACE, codigoPago: '123' }, true, NOV);
    const { estado, opcionId } = nuevaOpcionDesdeBase(s, { anio: 2027, desde: { tipo: 'MES', ref: NOV }, creadoPor: DANIEL, hoy: HOY });
    const base = opcionDe(anualDe(estado, 2027)!, opcionId).mesBase!;
    expect(base.items.find((i) => i.nombre === 'Internet')).toMatchObject({ enlacePago: ENLACE, codigoPago: '123' });
    const usado = usarMesBase(estado, { anio: 2027, opcionId, hoy: HOY });
    const meses = crearOActualizarMeses(usado, { anio: 2027, opcionId, actualizar: [], creadoPor: DANIEL, hoy: HOY });
    expect(items(meses, { anio: 2027, mes: 3 }, 'Internet')[0]).toMatchObject({ enlacePago: ENLACE, codigoPago: '123' });
  });

  it('aplicar desde un mes llega al mes base del año en adelante', () => {
    const { estado, opcionId } = nuevaOpcionDesdeBase(crearSemilla(HOY), { anio: 2027, desde: { tipo: 'MES', ref: NOV }, creadoPor: DANIEL, hoy: HOY });
    const s = guardar(estado, { codigoPago: '555' });
    expect(opcionDe(anualDe(s, 2027)!, opcionId).mesBase!.items.find((i) => i.nombre === 'Internet')!.codigoPago).toBe('555');
  });

  it('editar un gasto del mes base sin indicar los datos los conserva', () => {
    const { estado, opcionId } = nuevaOpcionDesdeBase(crearSemilla(HOY), { anio: 2027, desde: { tipo: 'MES', ref: NOV }, creadoPor: DANIEL, hoy: HOY });
    const item = opcionDe(anualDe(estado, 2027)!, opcionId).mesBase!.items.find((i) => i.nombre === 'Internet')!;
    const con = guardarItemBase(estado, { anio: 2027, opcionId, item: { ...item, codigoPago: '777' } });
    const { codigoPago: _c, enlacePago: _e, ...sinPago } = item;
    const editado = guardarItemBase(con, { anio: 2027, opcionId, item: { ...sinPago, monto: 1 } });
    expect(opcionDe(anualDe(editado, 2027)!, opcionId).mesBase!.items.find((i) => i.nombre === 'Internet')).toMatchObject({ monto: 1, codigoPago: '777' });
    expect(() => guardarItemBase(con, { anio: 2027, opcionId, item: { ...item, enlacePago: 'ftp://x' } })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
  });
});
