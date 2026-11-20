import { TestBed } from '@angular/core/testing';

import { NOV, OCT, conSesion, provideAppPrueba } from '../../../testing/demo';
import { app } from '../../../testing/harness';

/** Datos de pago de un gasto (gastos-datos-pago): la hoja del gasto, Hoy y Marcar pago. */
describe('Datos de pago (gastos-datos-pago)', () => {
  const ENLACE = 'https://pagos.ejemplo.com';

  beforeEach(() => {
    localStorage.removeItem('steward/mes-hoy');
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
  });

  it('la sección viene plegada; guardar con la casilla lo lleva a las otras opciones del mes', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar(/^Gastos fijos/);
    await a.tocar(/^Internet/);
    const seccion = a.raiz().querySelector('[data-testid="datos-pago"]')!;
    expect(seccion.querySelector('input')).toBeNull();
    await a.tocar(/Datos de pago/);
    expect(a.texto()).toContain('No guardes contraseñas aquí.');
    expect(a.texto()).not.toContain('Aplicar también a los meses ya planeados');

    await a.escribir('Enlace de pago', 'pagos.ejemplo.com');
    expect(a.texto()).toContain('Debe empezar por https://');
    expect(a.porTexto('Guardar').hasAttribute('disabled')).toBe(true);

    await a.escribir('Enlace de pago', ENLACE);
    await a.escribir('Código de usuario o referencia', '123456');
    const casilla = a.raiz().querySelector<HTMLInputElement>('[data-testid="datos-pago"] input[type="checkbox"]')!;
    expect(casilla.checked).toBe(true);
    await a.tocar('Guardar');

    const internet = (await p.plan.mes(NOV)).opciones.map((o) => o.escenario.items.find((i) => i.nombre === 'Internet'));
    expect(internet.length).toBeGreaterThan(1);
    for (const i of internet) expect(i).toMatchObject({ enlacePago: ENLACE, codigoPago: '123456' });
    // Octubre es anterior: no cambia.
    expect((await p.plan.mes(OCT)).opciones[0]!.escenario.items.find((i) => i.nombre === 'Internet')!.enlacePago ?? null).toBeNull();
  });

  it('sin la casilla solo cambia ese gasto, y vuelve abierta con sus datos', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar(/^Gastos fijos/);
    await a.tocar(/^Internet/);
    await a.tocar(/Datos de pago/);
    await a.escribir('Código de usuario o referencia', '987');
    await a.tocar(/^Aplicar también a los meses ya planeados/, 'label span');
    await a.tocar('Guardar');
    const [primera, ...otras] = (await p.plan.mes(NOV)).opciones.map((o) => o.escenario.items.find((i) => i.nombre === 'Internet')!);
    expect(primera!.codigoPago).toBe('987');
    for (const i of otras) expect(i.codigoPago ?? null).toBeNull();

    await a.tocar(/^Internet/);
    expect(a.campo('Código de usuario o referencia').value).toBe('987');
  });

  it('Hoy: Pagar ↗ solo en los gastos con enlace', async () => {
    const p = await conSesion();
    // El primer fijo que sigue por pagar en octubre.
    const pendiente = (await p.movimientos.resumenMes(OCT)).porPagar.find((e) => e.item.tipo !== 'VARIABLE' && e.item.tipo !== 'DIEZMO')!.item;
    const mes = await p.plan.mes(OCT);
    const esc = mes.opciones.find((o) => o.escenario.items.some((i) => i.id === pendiente.id))!.escenario;
    await p.plan.guardarItem(mes.plan!.id, esc.id, { ...pendiente, enlacePago: ENLACE, codigoPago: '123456' });

    const a = await app('/hoy');
    const ver = [...a.raiz().querySelectorAll('button')].find((b) => /^Ver \d+ más/.test(b.textContent!.trim()));
    if (ver) await a.tocar(/^Ver \d+ más/);
    const enlaces = [...a.raiz().querySelectorAll<HTMLAnchorElement>('[data-testid="pagar-enlace"]')];
    expect(enlaces.map((e) => e.getAttribute('aria-label'))).toEqual([`Pagar ${pendiente.nombre} en línea`]);
    expect(enlaces[0]!.href).toBe(ENLACE + '/');
    expect(enlaces[0]!.target).toBe('_blank');

  });

  it('Marcar pago muestra el portal y copia el código', async () => {
    const p = await conSesion();
    const pendiente = (await p.movimientos.resumenMes(OCT)).porPagar.find((e) => e.item.tipo !== 'VARIABLE' && e.item.tipo !== 'DIEZMO')!.item;
    const mes = await p.plan.mes(OCT);
    const esc = mes.opciones.find((o) => o.escenario.items.some((i) => i.id === pendiente.id))!.escenario;
    await p.plan.guardarItem(mes.plan!.id, esc.id, { ...pendiente, enlacePago: ENLACE, codigoPago: '123456' });
    const escrito: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void escrito.push(t) } });
    const b = await app(`/hoy/pagar/${pendiente.id}`);
    const datos = b.raiz().querySelector('[data-testid="datos-pago-hoja"]')!;
    expect(datos.querySelector('[data-testid="codigo-pago"]')!.textContent).toBe('123456');
    expect(datos.querySelector<HTMLAnchorElement>('[data-testid="abrir-portal"]')!.href).toBe(ENLACE + '/');
    await b.tocar('Copiar');
    expect(escrito).toEqual(['123456']);
    expect(b.texto()).toContain('Código copiado');
  });

  it('un gasto sin datos se ve como antes en Marcar pago', async () => {
    await conSesion();
    const a = await app('/hoy/pagar/m0-internet');
    expect(a.raiz().querySelector('[data-testid="datos-pago-hoja"]')).toBeNull();
  });
});
