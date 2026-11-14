import { TestBed } from '@angular/core/testing';

import { conSesion, provideAppPrueba } from '../../../testing/demo';
import { anchoDeVentana, app } from '../../../testing/harness';

const limpio = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Hoy detallado en escritorio (steward-hoy)', () => {
  const original = window.matchMedia;

  beforeEach(() => {
    localStorage.removeItem('steward/mes-hoy');
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  it('a 1280 px monta solo la vista detallada, con las cuatro tarjetas', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/hoy');
    expect(a.raiz().querySelector('[data-testid="hoy-escritorio"]')).not.toBeNull();
    expect(a.raiz().querySelectorAll('[data-testid="libre"]')).toHaveLength(1);
    expect(a.raiz().querySelector('[data-testid="ver-mas"]')).toBeNull();
    expect(a.raiz().querySelector('app-segmentado')).toBeNull();

    expect(limpio(a.raiz().querySelector('[data-testid="tarjeta-libre"]'))).toBe('Te queda libre $3.436.000 de $8.826.000 que entran este mes');
    expect(limpio(a.raiz().querySelector('[data-testid="tarjeta-falta"]'))).toBe('Falta pagar $2.715.000 4 pendientes · 1 vencido');
    expect(limpio(a.raiz().querySelector('[data-testid="tarjeta-pagado"]'))).toBe('Pagado $2.613.000 12 pagos · 48% de lo planeado');
    expect(limpio(a.raiz().querySelector('[data-testid="tarjeta-vs-plan"]'))).toBe('Vs. plan −$62.000 gastaste menos de lo planeado');
  });

  it('la tabla Por pagar tiene todos los pendientes y marca el vencido en rojo', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/hoy');
    const filas = [...a.raiz().querySelectorAll('[data-testid="tabla-por-pagar"] tbody tr')];
    expect(filas.map((f) => f.getAttribute('data-item'))).toEqual(['Compra a cuotas', 'Diezmo · Salario Daniel', 'Tarjeta Mastercard', 'Mercado']);
    const cuotas = filas[0]!.querySelector('[data-col="vence"]')!;
    expect(limpio(cuotas)).toBe('Venció el 20');
    expect(cuotas.className).toContain('text-negativo');
    expect(limpio(filas[2]!.querySelector('[data-col="vence"]'))).toBe('30 oct · en 4 días');
    expect(filas[2]!.querySelector('[data-col="vence"]')!.className).toContain('text-aviso');
    expect(limpio(filas[1]!.querySelector('[data-col="vence"]'))).toBe('Del Salario Daniel · día 25');
    expect(limpio(filas[3]!.querySelector('[data-col="vence"]'))).toBe('Durante el mes');
    expect(limpio(filas[0])).toContain('Tarjetas y cuotas');
  });

  it('"Marcar pagado" abre la hoja y al guardar baja Falta pagar', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/hoy');
    const mastercard = a.raiz().querySelector('[data-testid="tabla-por-pagar"] tr[data-item="Tarjeta Mastercard"]')!;
    (mastercard.querySelector('a:last-of-type') as HTMLElement).click();
    await a.estable();
    expect(a.url()).toBe('/hoy/pagar/m0-mastercard');
    await a.tocar('Davivienda');
    await a.tocar(/^Marcar pagado/, 'app-pagar-hoja button');
    expect(a.url()).toBe('/hoy');
    expect(limpio(a.raiz().querySelector('[data-testid="tarjeta-falta"]'))).toContain('Falta pagar $1.215.000');
    expect(a.raiz().querySelector('[data-testid="tabla-ya-pagado"] tr[data-item="Tarjeta Mastercard"]')).not.toBeNull();
  });

  it('Ya pagado dice quién pagó y de qué cuenta salió', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/hoy');
    const fila = (nombre: string) => a.raiz().querySelector(`[data-testid="tabla-ya-pagado"] tr[data-item="${nombre}"]`)!;
    expect(limpio(fila('Pensión').querySelector('[data-col="desde"]'))).toBe('Davivienda');
    expect(limpio(fila('Pensión').querySelector('[data-col="dif"]'))).toBe('—');
    expect(limpio(fila('Recibo Luz').querySelector('[data-col="desde"]'))).toBe('Su cuenta');
    expect(limpio(fila('Recibo Luz').querySelector('[data-col="dif"]'))).toBe('−$12.000');
    expect(fila('Recibo Luz').querySelector('app-avatar')?.getAttribute('aria-label')).toBe('Pagó Esposa');
  });

  it('la columna lateral trae ingresos, avance por categoría y cuentas', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/hoy');
    expect(a.texto()).toContain('Aportes Esposa 2 aportes · 1 pago directo');
    const categorias = a.raiz().querySelector('[data-testid="por-categoria"]')!;
    const fijos = categorias.querySelector('[data-categoria="Gastos fijos"]')!;
    expect(limpio(fijos)).toContain('$733.000 / $795.000');
    expect(fijos.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('92');
    const cuentas = a.raiz().querySelector('[data-testid="cuentas-escritorio"]')!;
    expect(limpio(cuentas.querySelector('[data-cuenta="Davivienda"]'))).toContain('Daniel ·');
    expect(cuentas.querySelector('a[href="/cuentas/cuadrar"]')).not.toBeNull();
  });

  it('las flechas recorren solo los meses de Hoy', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/hoy');
    const flecha = (nombre: string) => a.raiz().querySelector<HTMLButtonElement>(`button[aria-label="${nombre}"]`)!;
    expect(flecha('Mes anterior').disabled).toBe(true);
    flecha('Mes siguiente').click();
    await a.estable();
    expect(a.texto()).toContain('Noviembre 2026');
    expect(flecha('Mes siguiente').disabled).toBe(true);
    expect(flecha('Mes anterior').disabled).toBe(false);
  });

  it('"Cerrar octubre" abre el cierre del mes en curso y no se ve en noviembre (web-escritorio-completo)', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/hoy');
    const cerrar = () => a.raiz().querySelector<HTMLAnchorElement>('[data-testid="cerrar-mes"]');
    expect(cerrar()!.textContent!.trim()).toBe('Cerrar octubre');
    a.raiz().querySelector<HTMLButtonElement>('button[aria-label="Mes siguiente"]')!.click();
    await a.estable();
    expect(cerrar()).toBeNull();
    a.raiz().querySelector<HTMLButtonElement>('button[aria-label="Mes anterior"]')!.click();
    await a.estable();
    await a.tocar('Cerrar octubre');
    expect(a.url()).toBe('/planear/2026-10/cierre');
  });

  it('a 800 px sigue en una columna con la lista corta', async () => {
    anchoDeVentana(800);
    await conSesion();
    const a = await app('/hoy');
    expect(a.raiz().querySelector('[data-testid="hoy-escritorio"]')).toBeNull();
    expect(a.raiz().querySelector('[data-testid="ver-mas"]')).not.toBeNull();
  });
});
