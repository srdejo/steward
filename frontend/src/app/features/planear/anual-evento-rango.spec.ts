import { TestBed } from '@angular/core/testing';

import { conSesion, provideAppPrueba } from '../../../testing/demo';
import { anchoDeVentana, app, textoLegible } from '../../../testing/harness';

type Arnes = Awaited<ReturnType<typeof app>>;

/** "Desde {mes} hasta [mes]" en "Algo distinto en un mes" (spec steward-planear "Plan anual", anual-evento-rango). */
describe('Cambio con rango', () => {
  let original: typeof window.matchMedia;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
    original = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  const elegir = async (a: Arnes, etiqueta: 'Desde' | 'Hasta', mes: number) => {
    const s = a.raiz().querySelector<HTMLSelectElement>(`app-cambio-hoja select[aria-label="${etiqueta}"]`)!;
    s.value = String(mes);
    s.dispatchEvent(new Event('change'));
    await a.estable();
  };
  const rango = (a: Arnes) => a.raiz().querySelector('[data-testid="rango"]')!.textContent!.trim();

  it('el hasta por defecto es el mismo mes y ofrece de ese mes a diciembre', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/planear/anual/2027');
    await a.tocar('+ Algo distinto en un mes');
    await elegir(a, 'Desde', 5);
    expect(rango(a)).toBe('Solo en mayo');
    const hasta = a.raiz().querySelector<HTMLSelectElement>('app-cambio-hoja select[aria-label="Hasta"]')!;
    expect([...hasta.options].map((o) => o.textContent!.trim())).toEqual(['Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']);
    // Subir el "desde" por encima del "hasta" lo arrastra.
    await elegir(a, 'Hasta', 6);
    await elegir(a, 'Desde', 9);
    expect(rango(a)).toBe('Solo en septiembre');
  });

  it('un gasto de marzo a junio, y corregir el rango hasta agosto', async () => {
    anchoDeVentana(1280);
    const p = await conSesion();
    const antes = (await p.plan.anual(2027))!.libre;
    const a = await app('/planear/anual/2027');
    await a.tocar('+ Algo distinto en un mes');
    await a.escribir('¿Qué es?', 'Curso');
    await elegir(a, 'Desde', 3);
    await elegir(a, 'Hasta', 6);
    expect(rango(a)).toBe('Marzo a junio · 4 meses');
    await a.escribir('¿Cuánto cada mes?', '250000');
    await a.tocar('Variables', 'app-cambio-hoja button');
    await a.tocar('Guardar');

    const despues = (await p.plan.anual(2027))!.libre;
    expect(despues.map((v, i) => antes[i]! - v)).toEqual([0, 0, 250_000, 250_000, 250_000, 250_000, 0, 0, 0, 0, 0, 0]);
    const fila = [...a.raiz().querySelectorAll<HTMLElement>('[data-testid="rango-cambio"]')].find((x) => x.textContent!.trim() === 'Mar a jun')!;
    expect(textoLegible(fila.closest('button')!)).toContain('Curso Gasto · Variables · 4 meses');

    fila.closest('button')!.click();
    await a.estable();
    await elegir(a, 'Hasta', 8);
    await a.tocar('Guardar');
    const corregido = (await p.plan.anual(2027))!.libre;
    expect(corregido.map((v, i) => antes[i]! - v)).toEqual([0, 0, 250_000, 250_000, 250_000, 250_000, 250_000, 250_000, 0, 0, 0, 0]);
  });
});
