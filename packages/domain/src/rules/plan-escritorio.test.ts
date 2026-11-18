// Plan de un mes en escritorio (spec steward-planear, plan-mes-escritorio).
import { describe, expect, it } from 'vitest';
import { crearSemilla, DANIEL } from '../demo/seed';
import type { EstadoHogar, MesRef } from '../model';
import { crearMes, cuentasDelHogar, guardarItem, planDe, tablaOpciones, vistaMesEscritorio, vistasOpciones } from '.';

const HOY = '2026-10-26';
const OCT: MesRef = { anio: 2026, mes: 10 };
const NOV: MesRef = { anio: 2026, mes: 11 };
const DIC: MesRef = { anio: 2026, mes: 12 };
const semilla = () => crearSemilla(HOY);

/** Diciembre copiado de noviembre (Opcion A), con la prima del anual y la Navidad. */
function diciembre(): EstadoHogar {
  let s = crearMes(semilla(), { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL });
  const plan = planDe(s, DIC)!;
  s = guardarItem(s, {
    planId: plan.id, escenarioId: plan.escenarios[0]!.id,
    item: { categoriaId: 'cat-variables', nombre: 'Navidad', monto: 680_000, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false },
  });
  return s;
}

describe('vistaMesEscritorio', () => {
  it('diciembre: lo que no estaba en noviembre, las diferencias y los indicadores', () => {
    const v = vistaMesEscritorio(diciembre(), DIC, HOY)!;
    const fila = (nombre: string) => v.grupos.flatMap((g) => g.filas).find((f) => f.nombre === nombre)!;
    expect(v.conAnterior).toBe(true);
    expect(v.estadoTexto).toBe('Borrador · empieza en 36 días');
    expect([fila('Prima').etiqueta, fila('Prima').diferencia]).toEqual(['SOLO_MES', 3_500_000]);
    expect([fila('Navidad').etiqueta, fila('Navidad').diferencia]).toEqual(['SOLO_MES', 680_000]);
    expect([fila('Transporte').etiqueta, fila('Transporte').diferencia]).toEqual([null, 0]);
    expect(v.notaEntra).toBe('Incluye Prima ($3.500.000)');
    expect(v.notaSale).toBe('Navidad +$680.000 · Diezmo · Prima +$350.000');
    expect(v.diezmo).toEqual({ total: 1_050_000, detalle: 'Salario Daniel $700.000 · Prima $350.000' });
    expect(v.libre).toBe(v.entra - v.sale);
    expect(v.grupos.map((g) => g.titulo)).toEqual(['Ingresos', 'Gastos fijos', 'Variables', 'Tarjetas', 'Créditos', 'Diezmo']);
    const variables = v.grupos.find((g) => g.titulo === 'Variables')!;
    expect([variables.total, variables.diferencia]).toEqual([1_080_000, 680_000]);
    // Noviembre no esta cerrado: su sobrante se espera sin monto.
    expect(fila('Sobrante de noviembre').monto).toBeNull();
  });

  it('el calendario: lo que pasa el 20', () => {
    const v = vistaMesEscritorio(diciembre(), DIC, HOY)!;
    expect(v.porDia[20]).toEqual([{ nombre: 'Compra a cuotas', monto: 375_000, ingreso: false, color: '#6B5BA8' }]);
    expect(v.porDia[25]!.map((m) => [m.nombre, m.ingreso])).toEqual([['Salario Daniel', true], ['Diezmo · Salario Daniel', false]]);
  });

  it('el saldo dia a dia y su punto mas bajo, desde el saldo del hogar', () => {
    const s = diciembre();
    const v = vistaMesEscritorio(s, DIC, HOY)!;
    const inicio = cuentasDelHogar(s, HOY).total;
    expect(v.inicio).toBe(inicio);
    expect(v.saldoDiario).toHaveLength(31);
    // Antes del salario (el 25) salen pension, Visa, celular, internet, luz, gas, la cuota del credito y la compra a cuotas.
    const antes = 550_000 + 800_000 + 50_000 + 120_000 + 50_000 + 25_000 + 500_000 + 375_000;
    expect(v.minimo).toEqual({ dia: 20, saldo: inicio - antes });
    expect(v.saldoDiario[23]).toBe(inicio - antes);
    expect(v.saldoDiario[24]).toBe(inicio - antes + 6_288_000 - 700_000);
    // Sin fecha: transporte, apoyo, Navidad y el diezmo de la prima; la prima tampoco tiene dia.
    expect(v.sinFecha).toBe(250_000 + 150_000 + 680_000 + 350_000);
    expect(v.ingresosSinFecha).toBe(3_500_000);
  });

  it('el mes en curso proyecta desde hoy y solo lo que falta', () => {
    const v = vistaMesEscritorio(semilla(), OCT, HOY)!;
    expect(v.saldoDiario.slice(0, 25).every((x) => x === null)).toBe(true);
    const inicio = cuentasDelHogar(semilla(), HOY).total;
    // Del 26 en adelante falta la Nu (28), la Mastercard (30) y el diezmo del salario sin pagar (25 ya paso).
    expect(v.saldoDiario[25]).toBe(inicio);
    expect(v.saldoDiario[30]).toBe(inicio - 320_000 - 1_500_000);
  });

  it('la ultima cuota de la compra a cuotas: "Último" y "Se libera" en junio', () => {
    let s = semilla();
    for (let m = 12; m <= 18; m++) s = crearMes(s, { ref: { anio: 2026 + Math.floor((m - 1) / 12), mes: ((m - 1) % 12) + 1 }, modo: 'COPIAR', creadoPor: DANIEL });
    const junio = vistaMesEscritorio(s, { anio: 2027, mes: 6 }, HOY)!;
    const cuotas = junio.grupos.flatMap((g) => g.filas).find((f) => f.nombre === 'Compra a cuotas')!;
    expect(cuotas.etiqueta).toBe('ULTIMO');
    expect(cuotas.detalle).toBe('Día 20 · cuota 12 de 12');
    expect(junio.seLibera).toEqual([{ nombre: 'Compra a cuotas', monto: 375_000, desde: { anio: 2027, mes: 7 } }]);
    expect(vistaMesEscritorio(s, { anio: 2027, mes: 5 }, HOY)!.seLibera).toEqual([]);
  });

  it('sin plan no hay vista; sin mes anterior no hay diferencias', () => {
    expect(vistaMesEscritorio(semilla(), DIC, HOY)).toBeNull();
    const ene = crearMes(semilla(), { ref: { anio: 2027, mes: 1 }, modo: 'CERO', creadoPor: DANIEL });
    const v = vistaMesEscritorio(ene, { anio: 2027, mes: 1 }, HOY)!;
    expect(v.conAnterior).toBe(false);
    expect(v.grupos.flatMap((g) => g.filas).every((f) => f.diferencia === null && f.etiqueta !== 'SOLO_MES')).toBe(true);
  });
});

describe('tablaOpciones', () => {
  it('noviembre: los gastos lado a lado, resaltados frente a la A', () => {
    const t = tablaOpciones(semilla(), NOV, HOY);
    const regalos = t.secciones.flatMap((s) => s.filas).find((f) => f.nombre === 'Regalos de Navidad')!;
    expect(regalos.celdas.map((c) => c.monto)).toEqual([null, 600_000, null]);
    expect(regalos.celdas.map((c) => c.cambia)).toEqual([false, true, false]);
    expect(t.libres).toEqual(vistasOpciones(semilla(), NOV).map((v) => v.libre));
    expect(t.cambios[0]).toEqual([]);
    expect(t.cambios[1]).toEqual(['Suma Regalos de Navidad $600.000', 'Suma Ahorro viaje $1.000.000']);
    expect(t.cambios[2]).toEqual(['Suma Abono extra crédito $1.500.000']);
    expect(t.igualesEnTodas).toBe(13);
    expect(t.estadoTexto).toBe('Borrador · empieza en 6 días');
  });

  it('dos gastos con el mismo nombre en una opcion no se juntan', () => {
    let s = semilla();
    s = guardarItem(s, {
      planId: 'plan-m1', escenarioId: 'plan-m1-a',
      item: { categoriaId: 'cat-variables', nombre: 'transporte ', monto: 90_000, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false },
    });
    const filas = tablaOpciones(s, NOV, HOY).secciones.flatMap((x) => x.filas).filter((f) => f.nombre.trim().toLowerCase() === 'transporte');
    expect(filas.map((f) => f.celdas.map((c) => c.monto))).toEqual([[250_000, 250_000, 250_000], [90_000, null, null]]);
  });
});

describe('Colores de categoría (color-categorias)', () => {
  it('los colores del diseño anterior pasan a Libreta clara; los elegidos no cambian', async () => {
    const { migrarColores } = await import('./colores');
    expect(migrarColores([
      { tipo: 'FIJO', sistema: true, color: '#E2551B' },
      { tipo: 'CREDITO', sistema: true, color: '#2E6B45' },
      { tipo: 'VARIABLE', sistema: true, color: '#9A4F7E' },
      { tipo: 'OTRO', sistema: false, color: '#123456' },
      { tipo: 'OTRO', sistema: false, color: '#8d8f88' },
    ]).map((c) => c.color)).toEqual(['#C2603A', '#6B5BA8', '#9A4F7E', '#123456', '#8A8D85']);
  });

  it('la paleta tiene 10 colores y reconoce uno sin importar mayúsculas', async () => {
    const { PALETA_CATEGORIAS, colorDePaleta } = await import('./colores');
    expect(PALETA_CATEGORIAS).toHaveLength(10);
    expect(colorDePaleta('#3f6e9e')).toBe('#3F6E9E');
    expect(colorDePaleta('#123456')).toBeNull();
  });
});
