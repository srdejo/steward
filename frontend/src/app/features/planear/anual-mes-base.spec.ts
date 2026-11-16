import { TestBed } from '@angular/core/testing';

import { conSesion, provideAppPrueba } from '../../../testing/demo';
import { anchoDeVentana, app, textoLegible } from '../../../testing/harness';

/** Nueva opción y su mes base en la web (spec steward-planear, anual-mes-base-editable). */
describe('Mes base de una opción', () => {
  let original: typeof window.matchMedia;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
    original = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  it('nueva opción desde el mes en curso: se ajusta el mes base y se usa en los 12 meses', async () => {
    anchoDeVentana(1280);
    const p = await conSesion();
    const a = await app('/planear/anual/2027');
    await a.tocar('+ Nueva opción desde un mes base');
    const fuentes = a.raiz().querySelector('[data-testid="fuentes-mes-base"]')!;
    const elegida = [...fuentes.querySelectorAll<HTMLInputElement>('input')].findIndex((i) => i.checked);
    expect(textoLegible(fuentes.querySelectorAll('label')[elegida]!)).toContain('en curso');
    await a.tocar('Crear la Opción B');
    await a.estable();
    expect(a.url()).toBe('/planear/anual/2027/base?opcion=B');
    expect(a.texto()).toContain('Mes base de la Opción B');

    const fila = a.raiz().querySelector<HTMLElement>('[data-fila]')!;
    const nombre = fila.getAttribute('data-fila')!;
    fila.querySelector<HTMLButtonElement>('[aria-label^="Quitar"]')!.click();
    await a.estable();
    expect(a.raiz().querySelector(`[data-fila="${nombre}"]`)).toBeNull();
    // El mes real no cambia.
    const noviembre = (await p.plan.mes({ anio: 2026, mes: 11 })).opciones[0]!.grupos.flatMap((g) => g.items.map((i) => i.nombre));
    expect(noviembre).toContain(nombre);

    await a.tocar('Usar este mes en los 12 meses');
    await a.estable();
    expect(a.url()).toBe('/planear/anual/2027?opcion=B');
    const anual = (await p.plan.anual(2027, null))!;
    expect(anual.opciones.map((o) => o.letra)).toEqual(['A', 'B']);
  });

  it('"Cambiar mes base" se ve siempre y abre el editor de la opción', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/planear/anual/2027');
    await a.tocar('Cambiar mes base');
    await a.estable();
    expect(a.url()).toBe('/planear/anual/2027/base?opcion=A');
    expect(a.texto()).toContain('Mes base de la Opción A');
    expect(a.raiz().querySelector('[data-testid="resumen-base"]')).not.toBeNull();
  });
});
