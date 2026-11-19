import { TestBed } from '@angular/core/testing';

import { conSesion, provideAppPrueba } from '../../../testing/demo';
import { app, textoLegible } from '../../../testing/harness';

// Spec steward-avisos (avisos-pagos): "Avisos · Próximos", "Avisos · Configurar" y "Campana en Hoy".
describe('Avisos (steward-avisos)', () => {
  beforeEach(() => {
    localStorage.removeItem('steward/mes-hoy');
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
  });

  const nombres = (a: Awaited<ReturnType<typeof app>>, grupo: string) =>
    [...a.raiz().querySelectorAll(`[data-grupo="${grupo}"] [data-testid="aviso"]`)].map((f) => f.querySelector('.grow > span')!.textContent!.trim());

  it('próximos el 26 oct: vencido, próximos 7 días, más adelante y para no olvidar', async () => {
    await conSesion();
    const a = await app('/avisos');
    expect(nombres(a, 'VENCIDO')).toEqual(['Compra a cuotas']);
    expect(nombres(a, 'SEMANA')).toEqual(['Nu · Mercado', 'Mastercard', 'Cerrar octubre', 'Elegir opción de noviembre']);
    expect(nombres(a, 'ADELANTE')).toContain('Pensión');
    expect(nombres(a, 'NO_OLVIDAR')).toEqual(['Cuadrar Ahorros Esposa']);
    const nu = [...a.raiz().querySelectorAll('[data-testid="aviso"]')].find((f) => f.textContent!.includes('Nu · Mercado'))!;
    expect(textoLegible(nu)).toContain('28 oct Nu · Mercado En 2 días · valor del extracto $320.000');
  });

  it('marcar pagado desde Avisos abre Marcar pago y lo deja pagado en Hoy', async () => {
    const p = await conSesion();
    const a = await app('/avisos');
    await a.tocar(/.*/, '[aria-label="Marcar pagado Nu · Mercado"]');
    expect(a.url()).toContain('agregar=pago');
    await a.tocar('Marcar pagado');
    expect(nombres(a, 'SEMANA')).not.toContain('Nu · Mercado');
    const oct = await p.movimientos.resumenMes({ anio: 2026, mes: 10 });
    expect(oct.yaPagado.map((i) => i.item.nombre)).toContain('Tarjeta Nu · Mercado');
  });

  it('un pago de noviembre se marca en noviembre', async () => {
    const p = await conSesion();
    const a = await app('/avisos');
    await a.tocar(/.*/, '[aria-label="Marcar pagado Pensión"]');
    expect(a.url()).toContain('mes=2026-11');
    await a.tocar('Marcar pagado');
    const nov = await p.movimientos.resumenMes({ anio: 2026, mes: 11 });
    expect(nov.yaPagado.map((i) => i.item.nombre)).toContain('Pensión');
  });

  it('lo que no es un pago lleva a su pantalla: cerrar octubre abre el cierre', async () => {
    await conSesion();
    const a = await app('/avisos');
    await a.tocar(/.*/, '[aria-label="Ir a Cerrar octubre"]');
    await a.estable();
    expect(a.url()).toBe('/planear/2026-10/cierre');
  });

  it('configurar: cuándo avisa, y apagar Tarjetas es solo de quien lo apaga', async () => {
    const p = await conSesion();
    const a = await app('/avisos?pestana=configurar');
    expect(a.raiz().querySelector('[data-testid="cuando-avisa"]')!.textContent).toBe(
      'Te aviso el lunes con los pagos de la semana, el día anterior y el mismo día si no se ha pagado, a las 8:00.',
    );
    expect(a.texto()).toContain('Lo que marque Esposa');
    const tarjetas = [...a.raiz().querySelectorAll('app-interruptor')].find((i) => i.textContent!.includes('Fecha de pago y de corte'))!;
    tarjetas.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    await a.estable();
    expect((await p.avisos.preferencias()).tiposApagados).toEqual(['TARJETA']);
    expect(tarjetas.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('la campana de Hoy muestra lo vencido y lo de 7 días, y la fila de Ajustes abre Configurar', async () => {
    await conSesion();
    const a = await app('/hoy');
    const campana = a.raiz().querySelector('[data-testid="campana"]')!;
    expect(campana.getAttribute('aria-label')).toBe('Avisos · 5 pendientes');
    expect(campana.querySelector('[data-testid="insignia-avisos"]')!.textContent!.trim()).toBe('5');
    await a.ir('/ajustes');
    const fila = a.raiz().querySelector('[data-testid="fila-avisos"]')!;
    expect(textoLegible(fila)).toContain('Avisos El lunes, el día anterior y el mismo día');
    expect(fila.getAttribute('href')).toBe('/avisos?pestana=configurar');
  });

  it('sin nada pendiente, la campana no muestra insignia', async () => {
    const p = await conSesion();
    vi.spyOn(p.avisos, 'proximos').mockResolvedValue([]);
    const a = await app('/hoy');
    const campana = a.raiz().querySelector('[data-testid="campana"]');
    expect(campana?.querySelector('[data-testid="insignia-avisos"]') ?? null).toBeNull();
  });
});
