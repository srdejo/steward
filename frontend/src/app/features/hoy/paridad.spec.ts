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
    await a.tocar('Noviembre', 'app-hoja [role="radio"]');
    await a.tocar('Guardar aporte');
    expect(a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim()).toBe('$3.436.000');
    expect(a.texto()).toMatch(/Pagado \$3\.933\.000/);
    expect(a.texto()).toMatch(/Vs\. plan −\$62\.000/);
    expect(a.texto()).toMatch(/Falta pagar \$1\.395\.000/);
    expect(a.raiz().querySelector('[data-testid="ver-mas"]')).toBeNull();
  });

  it('replicar octubre en 2028 y la revisión del carro en mayo (planear-anio-desde-un-mes)', async () => {
    await conSesion();
    const a = await app('/planear/anual/2028');
    await a.tocar('Replicar en los 12 meses');
    // El mes base de la Opción A se usa tal cual (anual-mes-base-editable).
    await a.tocar('Usar este mes en los 12 meses');
    await a.tocar('+ Algo distinto en un mes');
    await a.escribir('¿Qué es?', 'Revisión carro');
    const mes = a.raiz().querySelector<HTMLSelectElement>('app-cambio-hoja select')!;
    mes.value = '5';
    mes.dispatchEvent(new Event('change'));
    await a.escribir('¿Cuánto?', '400000');
    await a.tocar('Guardar');
    // Mismas cifras que mobile/test/app.test.tsx. En 2028 la compra a cuotas ya termino (anual-opciones-y-meses).
    expect(a.raiz().querySelector('[data-testid="kpi-libre"]')!.textContent!.trim()).toBe('$44.876.000');
    expect(a.texto()).toContain('Mayo Revisión carro −$400.000 $3.373.000');
    expect(a.texto()).toContain('Enero a abril Igual al mes base · 4 meses $3.773.000');
  });
});
