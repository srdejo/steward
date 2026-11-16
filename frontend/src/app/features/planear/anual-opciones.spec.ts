import { TestBed } from '@angular/core/testing';

import { type MesRef } from '@steward/domain';

import { conSesion, provideAppPrueba } from '../../../testing/demo';
import { anchoDeVentana, app, textoLegible } from '../../../testing/harness';

/** Opciones del plan anual y "Meses con la Opción X" (spec steward-planear "Plan anual", anual-opciones-y-meses). */
describe('Opciones del año', () => {
  let original: typeof window.matchMedia;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
    original = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  it('opción B con carro nuevo a 1280 px: lo distinto de la A marcado y las dos opciones mes a mes', async () => {
    anchoDeVentana(1280);
    const p = await conSesion();
    const a = await app('/planear/anual/2027');
    await a.tocar('+ Duplicar Opción A');
    expect(a.url()).toBe('/planear/anual/2027?opcion=B');
    const b = (await p.plan.anual(2027, null))!.opciones[1]!.id;
    await p.plan.agregarEvento(2027, { nombre: 'Venta carro viejo', mes: 3, monto: 8_000_000, tipo: 'INGRESO', usuarioId: null }, b);
    await p.plan.agregarEvento(2027, { nombre: 'Cuota carro nuevo', mes: 4, monto: 1_200_000, tipo: 'GASTO', usuarioId: null, categoriaId: 'cat-creditos', enAdelante: true }, b);
    await a.estable();

    expect(a.porTexto(/^Opción B/, '[role="tab"]').getAttribute('aria-selected')).toBe('true');
    expect(textoLegible(a.raiz().querySelector('[data-testid="frente-a"]')!)).toBe('−$2.800.000 frente a la Opción A');
    const creditos = [...a.raiz().querySelectorAll('[data-testid="tabla-anual"] tr')].find((tr) => tr.querySelector('th')!.textContent!.trim() === 'Créditos')!;
    expect([...creditos.querySelectorAll('td')].map((td) => td.hasAttribute('data-distinto'))).toEqual([false, false, false, ...Array(9).fill(true)]);
    const mesAMes = a.raiz().querySelector('[data-testid="mes-a-mes"]')!;
    expect(textoLegible(mesAMes.querySelector('[data-fila="B"]')!)).toContain('Opción B');
    expect(a.texto()).toContain('Lo que cambia en la Opción B · 8');
    // La A no cambió.
    await a.tocar(/^Opción A/, '[role="tab"]');
    expect(a.texto()).not.toContain('Venta carro viejo');
  });

  it('meses con la Opción A: enero hecho a mano sin marcar, febrero con pagos bloqueado, marzo a diciembre se actualizan', async () => {
    const p = await conSesion();
    const ref = (mes: number): MesRef => ({ anio: 2027, mes });
    // Diciembre 2026 copia noviembre; enero y febrero copian el anterior; marzo a diciembre solo con el salario y su diezmo.
    await p.plan.crearMes(ref(1), 'CERO');
    await p.plan.crearMes(ref(2), 'CERO');
    for (let mes = 3; mes <= 12; mes++) {
      await p.plan.crearMes(ref(mes), 'CERO');
      const plan = (await p.plan.mes(ref(mes))).plan!;
      for (const i of plan.escenarios[0]!.items.filter((x) => x.tipo !== 'DIEZMO')) await p.plan.quitarItem(plan.id, plan.escenarios[0]!.id, i.id);
    }
    const febrero = (await p.plan.mes(ref(2))).opciones[0]!;
    const luz = febrero.grupos.flatMap((g) => g.items).find((i) => i.tipo !== 'DIEZMO')!;
    await p.movimientos.marcarPago({ itemId: luz.id, ref: ref(2), monto: luz.monto, usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' } });

    const a = await app('/planear/anual/2027');
    await a.tocar('Meses con la Opción A');
    const hoja = a.raiz().querySelector('[data-testid="meses-anual"]')!;
    const fila = (meses: string) => hoja.querySelector<HTMLElement>(`[data-meses="${meses}"]`)!;
    expect(textoLegible(fila('1'))).toContain('No se toca');
    expect(fila('1').querySelector('input')!.checked).toBe(false);
    expect(textoLegible(fila('2'))).toContain('Tiene pagos');
    expect(fila('2').querySelector('input')!.disabled).toBe(true);
    expect(textoLegible(fila('3,4,5,6,7,8,9,10,11,12'))).toContain('Marzo a diciembre Borrador · solo ingresos y diezmo · 10 meses Se actualizan');
    await a.tocar('Actualizar 10 meses');
    expect(a.texto()).toContain('Listo: 10 actualizados con la Opción A.');
    const marzo = (await p.plan.mes(ref(3))).opciones[0]!.grupos.flatMap((g) => g.items.map((i) => i.nombre));
    expect(marzo).toEqual(expect.arrayContaining(['Pensión', 'SOAT']));
  });
});
