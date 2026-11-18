import { TestBed } from '@angular/core/testing';

import { conSesion, provideAppPrueba } from '../../../testing/demo';
import { anchoDeVentana, app } from '../../../testing/harness';

const OCT = { anio: 2026, mes: 10 };

/** Spec steward-hoy, "Agregar desde un solo botón" (rediseno-libreta-clara). */
describe('Agregar desde un solo botón', () => {
  let original: typeof window.matchMedia;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
    original = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  const pestana = (raiz: HTMLElement) =>
    [...raiz.querySelectorAll('[data-testid="pestanas-agregar"] [role="tab"]')].find((b) => b.getAttribute('aria-selected') === 'true')?.textContent!.trim();

  it('gasto desde el + en Planear: se cierra y se sigue en Planear', async () => {
    anchoDeVentana(390);
    const p = await conSesion();
    const a = await app('/planear');
    a.raiz().querySelector<HTMLButtonElement>('[data-testid="agregar"]')!.click();
    await a.estable();
    expect(pestana(a.raiz())).toBe('Gasto');
    await a.escribir('¿Cuánto?', '40000');
    await a.tocar('Transporte');
    await a.tocar('Guardar gasto');
    expect(a.url()).toBe('/planear');
    expect(a.raiz().querySelector('app-agregar-hoja')).toBeNull();
    const transporte = [...(await p.movimientos.resumenMes(OCT)).yaPagado].find((i) => i.item.nombre === 'Transporte')!;
    expect(transporte.real).toBe(290_000);
    expect(transporte.detalle).toBe('Variable · $40.000 sobre el plan');
  });

  it('"+ Aporte" en Hoy abre Agregar en la pestaña Aporte, con el monto primero', async () => {
    anchoDeVentana(390);
    await conSesion();
    const a = await app('/hoy');
    await a.tocar('+ Aporte');
    expect(a.url()).toBe('/hoy?agregar=aporte');
    expect(pestana(a.raiz())).toBe('Aporte');
    const etiquetas = [...a.raiz().querySelectorAll('app-aporte-hoja .rotulo')].map((e) => e.textContent!.trim());
    expect(etiquetas.slice(0, 2)).toEqual(['¿Cuánto?', '¿Quién?']);
  });

  it('un pago de Por pagar abre la pestaña Pago con el ítem y el valor del plan', async () => {
    anchoDeVentana(390);
    await conSesion();
    const a = await app('/hoy');
    await a.tocar(/Tarjeta Mastercard/, 'a');
    expect(a.url()).toBe('/hoy?agregar=pago&item=m0-mastercard');
    expect(pestana(a.raiz())).toBe('Pago');
    expect(a.raiz().querySelector('[data-testid="pago-elegido"]')!.textContent).toContain('Tarjeta Mastercard');
    expect(a.raiz().querySelector<HTMLInputElement>('app-pagar-hoja input')!.value).toBe('$1.500.000');
  });

  it('la pestaña Pago sin ítem lista lo pendiente para elegir', async () => {
    anchoDeVentana(390);
    await conSesion();
    const a = await app('/hoy?agregar=pago');
    const pendientes = [...a.raiz().querySelectorAll('[data-testid="pendientes-agregar"] button')].map((b) => b.querySelector('span span')!.textContent!.trim());
    expect(pendientes).toEqual(['Compra a cuotas', 'Tarjeta Nu · Mercado', 'Tarjeta Mastercard', 'Diezmo · Salario Daniel']);
    await a.tocar(/Tarjeta Nu · Mercado/);
    expect(a.raiz().querySelector('[data-testid="pago-elegido"]')!.textContent).toContain('Tarjeta Nu · Mercado');
  });

  it('en web, Agregar del menú lateral abre la misma hoja', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/cuentas');
    a.raiz().querySelector<HTMLButtonElement>('[data-testid="agregar-lateral"]')!.click();
    await a.estable();
    expect(a.url()).toBe('/cuentas?agregar=gasto');
    expect([...a.raiz().querySelectorAll('[data-testid="pestanas-agregar"] [role="tab"]')].map((b) => b.textContent!.trim())).toEqual(['Gasto', 'Aporte', 'Pago']);
  });

  it('las rutas de siempre abren Agregar', async () => {
    anchoDeVentana(390);
    await conSesion();
    const a = await app('/hoy/pagar/m0-mastercard');
    expect(a.url()).toBe('/hoy?agregar=pago&item=m0-mastercard');
    expect(pestana(a.raiz())).toBe('Pago');
  });
});
