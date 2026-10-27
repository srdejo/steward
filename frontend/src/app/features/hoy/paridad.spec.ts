import { TestBed } from '@angular/core/testing';

import { conSesion, provideAppPrueba } from '../../../testing/demo';
import { app } from '../../../testing/harness';

/** Misma secuencia que mobile/test/app.test.tsx ("paridad con la PWA"): las dos apps deben dar las mismas cifras. */
describe('paridad con la app (steward-mobile-app)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppPrueba() }));

  it('pagar la Mastercard desde Davivienda y un aporte para noviembre', async () => {
    await conSesion();
    const a = await app('/hoy/pagar/m0-mastercard');
    await a.tocar('Davivienda');
    await a.tocar('Marcar pagado');
    await a.ir('/hoy/aporte');
    await a.escribir('¿Cuánto?', '500000');
    await a.tocar('Noviembre');
    await a.tocar('Guardar aporte');
    expect(a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim()).toBe('$3.436.000');
    expect(a.texto()).toMatch(/Pagado \$4\.113\.000/);
    expect(a.texto()).toMatch(/Vs\. plan −\$62\.000/);
  });
});
