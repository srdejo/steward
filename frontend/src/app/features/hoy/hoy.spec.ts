import { TestBed } from '@angular/core/testing';

import { NOV, OCT, conSesion, provideAppPrueba, puertos } from '../../../testing/demo';
import { app } from '../../../testing/harness';

describe('Hoy (steward-hoy)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppPrueba() }));

  const libre = (a: Awaited<ReturnType<typeof app>>) => a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim();

  it('muestra el resumen de los datos de ejemplo', async () => {
    await conSesion();
    const a = await app('/hoy');
    expect(a.texto()).toContain('Hoy · LUN 26');
    expect(a.texto()).toContain('Octubre 2026');
    expect(libre(a)).toBe('$3.436.000');
    expect(a.texto()).toMatch(/Plan\s*\$5\.390\.000/);
    expect(a.texto()).toMatch(/Pagado\s*\$2\.613\.000/);
    expect(a.texto()).toMatch(/Vs\. plan\s*−\$62\.000/);
    expect(a.texto()).toContain('Aportes Esposa 2 aportes · 1 pago directo');
    expect(a.texto()).toContain('Tarjeta Mastercard Vence en 4 días');
    expect(a.texto()).toContain('Mercado Variable · llevas $180.000 de $320.000');
  });

  it('muestra plan vs real en un pago', async () => {
    await conSesion();
    const a = await app('/hoy');
    const luz = [...a.raiz().querySelectorAll('app-fila')].find((f) => f.textContent!.includes('Recibo Luz'))!;
    expect(luz.textContent!.replace(/\s+/g, ' ')).toContain('plan $50.000 · −$12.000');
    expect(luz.textContent).toContain('$38.000');
    expect(luz.querySelector('app-avatar')?.getAttribute('aria-label')).toBe('Pagó Esposa');
  });

  it('el diezmo es un gasto por pagar: Recibí no crea tarjeta y se marca pagado (diezmo-como-gasto)', async () => {
    const p = puertos();
    await p.demo!.probarDesdeCero();
    await p.sesion.iniciar('GOOGLE');
    await p.hogar.nombrar('Nuestra casa');
    await p.ingresos.guardarRegla({ activa: true, porcentaje: 10, base: 'BRUTO', aplicaAportes: false });
    await p.ingresos.guardarFijo({ nombre: 'Salario Daniel', bruto: 7_000_000, neto: 6_288_000, diaPago: 25, cuentaId: null });
    await p.hogar.completarOnboarding();
    await p.plan.crearMes(OCT, 'CERO');
    const a = await app('/hoy');
    expect(a.texto()).toContain('Diezmo · Salario Daniel');
    const libre = a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim();

    // Recibí abre el monto de la linea para confirmarlo o cambiarlo.
    await a.tocar('Recibí');
    expect(a.url()).toMatch(/^\/hoy\/recibir\//);
    await a.escribir('Valor recibido', '6350000');
    await a.tocar('Marcar recibido');
    expect(a.url()).toBe('/hoy');
    expect(a.texto()).not.toContain('Disponible para diezmar');
    expect(a.texto()).toContain('Fijo · recibido 26 oct');
    expect(a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim()).not.toBe(libre);

    // Llevar el diezmo: Marcar pago desde una cuenta, como cualquier gasto.
    const diezmo = (await p.movimientos.resumenMes(OCT)).porPagar.find((i) => i.item.tipo === 'DIEZMO')!;
    expect(diezmo.plan).toBe(700_000);
    await a.ir(`/hoy/pagar/${diezmo.item.id}`);
    await a.tocar('Marcar pagado');
    expect((await p.movimientos.resumenMes(OCT)).yaPagado.map((i) => i.item.nombre)).toContain('Diezmo · Salario Daniel');
  });

  it('un aporte para el mes siguiente no cambia el libre de este mes', async () => {
    await conSesion();
    const a = await app('/hoy/aporte');
    await a.tocar('Esposa');
    await a.escribir('¿Cuánto?', '500000');
    await a.tocar('Noviembre');
    expect(a.raiz().querySelector('[data-testid="efecto-aporte"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Noviembre pasa a tener $500.000 más en ingresos');
    await a.tocar('Guardar aporte');
    expect(a.url()).toBe('/hoy');
    expect(libre(a)).toBe('$3.436.000');
    const nov = await puertos().plan.mes(NOV);
    expect(nov.opciones[0]!.ingresos.find((l) => l.nombre === 'Aporte Esposa')?.monto).toBe(2_500_000);
  });

  it('pago directo desde "Su cuenta" cuenta como aporte de quien pagó', async () => {
    await conSesion();
    const a = await app('/hoy/pagar/m0-mastercard');
    expect(a.texto()).toContain('Tarjetas y cuotas');
    expect(a.texto()).toContain('vence 30 oct');
    expect(a.campo('Valor pagado').value).toBe('$1.500.000');
    await a.tocar('Esposa');
    await a.tocar('Su cuenta');
    expect(a.raiz().querySelector('[data-testid="aviso-su-cuenta"]')!.textContent!.replace(/\s+/g, ' ')).toContain('aporte de Esposa en octubre');
    await a.tocar('Marcar pagado');
    expect(a.url()).toBe('/hoy');
    expect(a.texto()).toContain('Aportes Esposa 2 aportes · 2 pagos directos');
    expect(a.texto()).toContain('$4.038.000');
    const fila = [...a.raiz().querySelectorAll('#ya-pagado ~ div app-fila')].find((f) => f.textContent!.includes('Tarjeta Mastercard'))!;
    expect(fila.querySelector('app-avatar')?.textContent?.trim()).toBe('E');
  });

  it('un fijo ya pagado avisa quién y cuándo en lugar de pagarlo otra vez', async () => {
    await conSesion();
    const a = await app('/hoy/pagar/m0-luz');
    expect(a.raiz().querySelector('[data-testid="ya-pagado"]')!.textContent!.trim()).toBe('Ya lo pagó Esposa el 12 oct');
    expect(a.texto()).not.toContain('Marcar pagado');
  });

  it('gasto variable acumula y gasto no planeado resta del libre', async () => {
    await conSesion();
    const a = await app('/hoy/gasto?item=m0-mercado');
    expect(a.porTexto('Mercado').getAttribute('aria-checked')).toBe('true');
    await a.escribir('¿Cuánto?', '40000');
    expect(a.raiz().querySelector('[data-testid="vista-previa-gasto"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Mercado: llevas $220.000 de $320.000 con este gasto.');
    await a.tocar('Guardar gasto');
    expect(a.texto()).toContain('Mercado Variable · llevas $220.000 de $320.000');

    await a.ir('/hoy/gasto');
    await a.escribir('¿Cuánto?', '85000');
    await a.tocar('No estaba planeado');
    await a.escribir('Nota · Opcional', 'Farmacia');
    await a.tocar('Guardar gasto');
    expect(libre(a)).toBe('$3.351.000');
    expect(a.texto()).toContain('Farmacia No estaba planeado');
  });
});
