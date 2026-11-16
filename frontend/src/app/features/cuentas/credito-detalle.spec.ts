import { TestBed } from '@angular/core/testing';

import { NOV, OCT, conSesion, provideAppPrueba } from '../../../testing/demo';
import { anchoDeVentana, app, textoLegible } from '../../../testing/harness';

/** El detalle de un crédito en escritorio y "Eliminar crédito" (spec steward-cuentas, credito-escritorio-y-eliminar). */
describe('Detalle de crédito y eliminar', () => {
  let original: typeof window.matchMedia;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
    original = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  it('Libre inversión a 1280 px: indicadores, 12 cuotas, pagos con su cuenta y "Eliminar crédito"', async () => {
    anchoDeVentana(1280);
    await conSesion();
    const a = await app('/cuentas/credito/cred-libre');
    const indicadores = textoLegible(a.raiz().querySelector('[data-testid="indicadores"]')!);
    expect(indicadores).toContain('Cuota $500.000 Día 15 de cada mes');
    expect(indicadores).toContain('Pagado');
    expect(indicadores).toContain('Termina ≈');
    expect(a.raiz().querySelectorAll('[data-testid="proximas-cuotas"] tbody tr')).toHaveLength(12);
    expect(textoLegible(a.raiz().querySelector('[data-testid="pago"]')!)).toBe('Cuota · 15 oct Davivienda $500.000');
    expect(a.texto()).toContain('¿Ya no lo tienen?');
    expect(a.porTexto('Eliminar crédito')).toBeTruthy();
  });

  it('eliminar la compra a cuotas: confirma, la quita de Créditos y del plan', async () => {
    const p = await conSesion();
    const antes = (await p.cuentas.resumenCreditos()).deben;
    const a = await app('/cuentas/credito/cred-cuotas');
    await a.tocar('Eliminar crédito');
    expect(a.texto()).toContain('¿Eliminar Compra a cuotas?');
    expect(a.texto()).toContain('Sale de Créditos y su cuota sale del plan de octubre en adelante.');
    expect(textoLegible(a.raiz().querySelector('[data-testid="que-se-conserva"]')!)).toContain('Se conserva el pago registrado, en el historial de las cuentas.');
    await a.tocar('Eliminar crédito', '[role="dialog"] button, app-hoja button');
    expect(a.url()).toBe('/cuentas?pestana=creditos');
    expect((await p.cuentas.creditos()).map((c) => c.credito.id)).toEqual(['cred-libre']);
    expect((await p.cuentas.resumenCreditos()).deben).toBe(antes - 3_375_000);
    const nombres = async (ref: typeof OCT) => (await p.plan.mes(ref)).opciones.flatMap((o) => o.grupos.flatMap((g) => g.items.map((i) => i.nombre)));
    expect(await nombres(OCT)).not.toContain('Compra a cuotas');
    expect(await nombres(NOV)).not.toContain('Compra a cuotas');
  });
});
