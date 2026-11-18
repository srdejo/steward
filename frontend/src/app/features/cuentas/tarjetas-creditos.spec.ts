import { TestBed } from '@angular/core/testing';

import { OCT, conSesion, provideAppPrueba } from '../../../testing/demo';
import { app, textoLegible } from '../../../testing/harness';

/** Specs steward-tarjetas y steward-cuentas (tarjetas-y-creditos), en la vista móvil. */
describe('Tarjetas y créditos (tarjetas-y-creditos)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppPrueba() }));

  const texto = (a: Awaited<ReturnType<typeof app>>, selector: string) => textoLegible(a.raiz().querySelector(selector)!);

  it('tarjetas: por pagar este ciclo, próximas fechas, el pago de Nu en rojo y el aviso en la pestaña', async () => {
    await conSesion();
    const a = await app('/cuentas');
    expect(texto(a, '[data-testid="pago-pronto"]')).toBe('2 días');
    await a.tocar(/^Tarjetas/, '[role="tab"]');
    expect(a.url()).toBe('/cuentas?pestana=tarjetas');
    expect(texto(a, '[data-testid="por-pagar-ciclo"]')).toBe('$2.620.000');
    const fechas = [...a.raiz().querySelectorAll('[data-testid="fecha-tarjeta"]')].map((f) => textoLegible(f));
    expect(fechas[0]).toBe('28 oct Pagar Nu · Mercado En 2 días · valor del extracto $320.000');
    expect(fechas).toContain('13 nov Corte Nu Mejor día para una compra grande: 14 nov');
    const pago = a.raiz().querySelector('[data-tarjeta="Nu"] [data-testid="proximo-pago"]')!;
    expect(textoLegible(pago)).toBe('Pago 28 oct en 2 días');
    expect(pago.querySelector('.text-negativo')).not.toBeNull();
    expect(texto(a, '[data-tarjeta="Nu"] [data-testid="ayuda-tarjeta"]')).toBe('Lo que compres hasta el 13 nov se paga el 28 nov. Desde el 14 nov, el 28 dic.');
    expect(texto(a, '[data-tarjeta="Mastercard"] [data-testid="ayuda-tarjeta"]')).toBe('No se paga completa: el saldo que queda genera intereses.');
  });

  it('agregar una tarjeta: su línea entra al mes; quitarla deja la línea sin enlace', async () => {
    const p = await conSesion();
    const a = await app('/cuentas?pestana=tarjetas');
    await a.tocar('+ Agregar tarjeta');
    await a.escribir('Nombre', 'Éxito');
    await a.escribir('Uso · Opcional', 'Ropa');
    await a.escribir('Día de corte', '15');
    expect(a.porTexto<HTMLButtonElement>('Agregar tarjeta').disabled).toBe(true);
    await a.escribir('Día de pago', '30');
    await a.tocar('Pago fijo', 'app-hoja [role="radio"]');
    await a.escribir('Pago fijo', '200000');
    await a.tocar('Agregar tarjeta');
    expect(texto(a, '[data-testid="por-pagar-ciclo"]')).toBe('$2.820.000');
    const linea = (await p.plan.mes(OCT)).opciones[0]!.escenario.items.find((i) => i.nombre === 'Tarjeta Éxito · Ropa')!;
    expect(linea).toMatchObject({ monto: 200_000, diaVence: 30 });

    await a.tocar(/^Éxito/, '[data-tarjeta="Éxito"]');
    await a.tocar('Quitar tarjeta');
    await a.tocar('Quitar tarjeta', 'app-hoja button.boton-grande');
    expect(a.raiz().querySelector('[data-tarjeta="Éxito"]')).toBeNull();
    expect((await p.plan.mes(OCT)).opciones[0]!.escenario.items.find((i) => i.nombre === 'Tarjeta Éxito · Ropa')!.tarjetaId).toBeNull();
  });

  it('créditos: lo que deben, lo que pagan y el progreso de cuotas', async () => {
    await conSesion();
    const a = await app('/cuentas?pestana=creditos');
    expect(texto(a, '[data-testid="deben-creditos"]')).toBe('$17.625.000');
    expect(texto(a, '[data-testid="pagan-mes"]')).toBe('$875.000');
    const cuotas = texto(a, '[data-credito="Compra a cuotas"]');
    expect(cuotas).toContain('Plan de pagos');
    expect(cuotas).toContain('$3.375.000 Cuota 4 de 12');
    expect(cuotas).toContain('3 pagadas · faltan 9 · jun 2027');
    expect(texto(a, '[data-credito="Libre inversión"]')).toContain('Cuota 23 de 60');
  });

  it('agregar un plan de pagos sin intereses, y la tasa efectiva anual se convierte', async () => {
    await conSesion();
    const a = await app('/cuentas?pestana=creditos');
    await a.tocar('+ Agregar crédito');
    await a.escribir('Nombre', 'Nevera');
    await a.escribir('Entidad', 'Almacén');
    await a.escribir('Día de pago', '20');
    await a.tocar('Anual (EA)', 'app-hoja [role="radio"]');
    await a.escribir('Saldo hoy', '14250000');
    await a.escribir('Cuota', '500000');
    await a.escribir('Tasa (%)', '12');
    expect(texto(a, '[data-testid="resumen-metodo"]')).toContain('Equivale a 0,95 % EM.');

    await a.tocar(/^Con el plan de pagos/, 'app-hoja [role="radio"]');
    await a.escribir('Valor financiado', '4500000');
    await a.escribir('Número de cuotas', '12');
    await a.escribir('Tasa efectiva anual (%)', '0');
    await a.escribir('Cuotas pagadas', '3');
    expect(texto(a, '[data-testid="resumen-metodo"]')).toContain('Cuota de $375.000 · debes $3.375.000 · cuota 4 de 12');
    await a.tocar('Agregar crédito');
    expect(texto(a, '[data-credito="Nevera"]')).toContain('Cuota 4 de 12');
  });

  it('detalle: cómo baja, la próxima cuota y corregir con el extracto', async () => {
    await conSesion();
    const a = await app('/cuentas/credito/cred-libre');
    expect(texto(a, '[data-testid="metodo"]')).toContain('Baja solo con la tasa · 1,6% EM');
    expect(a.texto()).toContain('Cuota 23 de 60 22 pagadas · faltan 38');
    const primera = a.raiz().querySelector('[data-testid="proximas-cuotas"] tbody tr')!;
    expect(textoLegible(primera)).toBe('23 / 60 nov $228.000 $272.000 $13.978.000');
    expect(texto(a, '[data-testid="intereses-anio"]')).toMatch(/^En 2027 pagarías \$[\d.]+ en intereses\.$/);
    await a.tocar('Corregir con extracto');
    await a.escribir('Saldo que dice el extracto', '13900000');
    await a.tocar('Guardar');
    expect(a.texto()).toContain('$13.900.000');
    expect(textoLegible(a.raiz().querySelector('[data-testid="proximas-cuotas"] tbody tr')!)).toContain('$222.400');
  });

  it('cambiar a plan de pagos desde el detalle', async () => {
    await conSesion();
    const a = await app('/cuentas/credito/cred-cuotas');
    expect(texto(a, '[data-testid="metodo"]')).toContain('Sigue el plan de pagos');
    await a.tocar('Cambiar');
    await a.tocar(/^Lo actualizo a mano/, 'app-hoja [role="radio"]');
    await a.tocar('Guardar');
    expect(texto(a, '[data-testid="metodo"]')).toContain('Lo actualizas a mano');
    expect(a.raiz().querySelector('[data-testid="proximas-cuotas"]')).toBeNull();
  });
});
