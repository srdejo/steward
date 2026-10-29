import { TestBed } from '@angular/core/testing';

import { NOV, OCT, conSesion, provideAppPrueba } from '../../../testing/demo';
import { app } from '../../../testing/harness';

describe('Planear (steward-planear)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppPrueba() }));

  it('planear inicio muestra el año y los meses con su estado', async () => {
    await conSesion();
    const a = await app('/planear');
    const t = a.texto();
    expect(t).toContain('Año 2027 Libre proyectado $28.996.000');
    expect(t).toContain('Noviembre 2026 Borrador · 3 opciones');
    expect(t).toContain('Diciembre 2026 Sin plan Planear ›');
    expect(t).toContain('Enero 2027 Saldrá del plan anual $598.000');
    expect(t).toContain('Octubre 2026 Activo · Opción A Ver hoy ›');
    expect(t).toContain('Septiembre 2026 Cerrado · sobró $1.840.000 Ver cierre');
  });

  it('abrir un mes sin plan y copiar el mes anterior', async () => {
    await conSesion();
    const a = await app('/planear');
    await a.tocar(/^Diciembre 2026/);
    expect(a.url()).toBe('/planear/2026-12');
    expect(a.texto()).toContain('Aún no tiene plan');
    expect(a.texto()).toContain('Diciembre ya trae Prima +$3.500.000 Diezmo de la prima $350.000 Sobrante de noviembre al cerrar noviembre');
    await a.tocar(/^Copiar noviembre/);
    expect(a.texto()).toContain('Borrador');
    expect([...a.raiz().querySelectorAll('[role="tab"]')].map((t) => t.textContent!.trim())).toEqual(['Opción A']);
  });

  it('duplicar crea una opción nueva del usuario actual', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    expect([...a.raiz().querySelectorAll('[role="tab"]')].map((t) => t.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Opción A', 'Opción B · E', 'Opción C']);
    await a.tocar('+ Duplicar');
    const tabs = [...a.raiz().querySelectorAll('[role="tab"]')];
    expect(tabs.at(-1)!.textContent!.trim()).toBe('Opción D');
    expect(tabs.at(-1)!.getAttribute('aria-selected')).toBe('true');
    const nov = await p.plan.mes(NOV);
    expect(nov.opciones.at(-1)!.escenario.creadoPor).toBe('u-daniel');
  });

  it('quitar una opción: con confirmación, nunca la última ni la que está en uso (backend-opciones-mes)', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar(/Opción C/, '[role="tab"]');
    await a.tocar('Quitar opción');
    await a.tocar('Quitar opción C');
    expect((await p.plan.mes(NOV)).opciones.map((o) => o.escenario.letra)).toEqual(['A', 'B']);
    await a.tocar(/Opción B/, '[role="tab"]');
    await a.tocar('Quitar opción');
    await a.tocar('Quitar opción B');
    expect(a.texto()).not.toContain('Quitar opción');
  });

  it('crear el plan anual 2028 vacío y editar una celda (backend-plan-anual)', async () => {
    const p = await conSesion();
    const a = await app('/planear/anual/2028');
    await a.tocar('Crear plan anual 2028');
    expect(a.texto()).toContain('Plan anual 2028');
    await a.tocar(/.*/, '[aria-label="Gastos fijos · Marzo"]');
    await a.escribir('Monto del mes', '800000');
    await a.tocar('Guardar');
    expect((await p.plan.anual(2028))!.gastos[0]!.valores[2]).toBe(800_000);
    expect(a.raiz().querySelector('[aria-label="Aportes Daniel · Enero"]')).not.toBeNull();
  });

  it('octubre (Activo) no ofrece + Duplicar', async () => {
    await conSesion();
    const a = await app('/planear/2026-10');
    expect(a.texto()).not.toContain('+ Duplicar');
  });

  it('el diezmo se ve calculado y no se puede editar', async () => {
    await conSesion();
    const a = await app('/planear/2026-11');
    const fila = a.raiz().querySelector('[data-testid="fila-diezmo"]')!;
    expect(fila.textContent).toContain('Calculado · 10% de Salario Daniel');
    expect(fila.querySelector('input, button')).toBeNull();
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.898.000');
  });

  it('editar un monto de la opción cambia lo que dejaría libre', async () => {
    await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar(/^Variables/);
    await a.escribir('Monto de Mercado', '420000');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.798.000');
  });

  it('usar una opción archiva las demás', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar('Usar opción A');
    expect(a.url()).toBe('/planear');
    const nov = await p.plan.mes(NOV);
    expect(nov.opciones.map((o) => o.escenario.letra)).toEqual(['A']);
    expect(nov.plan!.escenarios.filter((e) => e.archivado).map((e) => e.letra)).toEqual(['B', 'C']);
  });

  it('comparar resalta solo las filas que cambian', async () => {
    await conSesion();
    const a = await app('/planear/2026-11/comparar');
    const resaltadas = () => [...a.raiz().querySelectorAll('tr[data-cambia="true"] th')].map((th) => th.firstElementChild!.textContent!.trim());
    expect(resaltadas()).toEqual(['Variables', 'Créditos', 'Ahorro']);
    expect(a.texto()).toContain('Sin cambios Gastos fijos, Tarjetas y cuotas, diezmo 4.170.000 4.170.000 4.170.000');
    expect(a.texto()).toContain('Queda libre 2.898.000 1.298.000 1.398.000');
    expect(a.raiz().querySelector('[data-testid="tabla-comparar"]')!.classList).toContain('overflow-x-auto');
    await a.tocar('Mostrar solo lo que cambia', 'label');
    expect(a.texto()).not.toContain('Sin cambios');
    expect(a.texto()).toContain('Gastos fijos 795.000 795.000 795.000');
  });

  it('plan anual: KPI, evento del año y crear meses', async () => {
    const p = await conSesion();
    const a = await app('/planear/anual/2027');
    expect(a.raiz().querySelector('[data-testid="kpi-libre"]')!.textContent!.trim()).toBe('$28.996.000');
    expect(a.texto()).toContain('Mes más apretado Enero · $598.000');
    expect(a.texto()).toContain('Diezmo del año (calculado) $9.100.000');
    await a.tocar('+ Evento del año');
    await a.escribir('Evento', 'SOAT moto');
    const mes = a.raiz().querySelector('select')!;
    mes.value = '3';
    mes.dispatchEvent(new Event('change'));
    await a.escribir('Monto', '1200000');
    await a.tocar('Agregar evento');
    expect(a.raiz().querySelector('[data-testid="kpi-libre"]')!.textContent!.trim()).toBe('$27.796.000');
    await a.tocar('Crear meses desde este plan');
    expect(a.texto()).toContain('Los 12 meses de 2027 quedaron en borrador');
    expect((await p.plan.mes({ anio: 2027, mes: 1 })).estado).toBe('BORRADOR');
  });

  it('cerrar octubre reparte el sobrante y lo pasa a noviembre', async () => {
    const p = await conSesion();
    const pagar = (itemId: string, monto: number) => p.movimientos.marcarPago({ itemId, ref: OCT, monto, usuarioId: 'u-daniel', origen: { tipo: 'CUENTA', cuentaId: 'cta-davivienda' } });
    await pagar('m0-mastercard', 1_500_000);
    await pagar('m0-cuotas', 375_000);
    await p.movimientos.registrarGasto({ monto: 140_000, itemId: 'm0-mercado', nota: '', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    await p.movimientos.registrarGasto({ monto: 112_000, itemId: null, nota: 'Farmacia', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    const diezmo = (await p.movimientos.resumenMes(OCT)).diezmo.pendientes[0]!;
    await p.ingresos.entregarDiezmo([diezmo.id], OCT, null);
    await p.cuentas.cuadrar([{ cuentaId: 'cta-nu', saldoBanco: 3_190_000 }, { cuentaId: 'cta-efectivo', saldoBanco: 150_000 }]);

    const a = await app('/planear/2026-10/cierre');
    expect(a.raiz().querySelector('[data-testid="sobrante"]')!.textContent!.trim()).toBe('$3.166.000');
    expect(a.texto()).toContain('El plan esperaba $2.898.000 libres.');
    expect(a.texto()).toContain('Ingresos 8.288.000 8.826.000');
    expect(a.texto()).toContain('Sin registrar de cuadrar cuentas — 220.000');

    await a.escribir('A ahorro', '2000000');
    expect(a.raiz().querySelector('[data-testid="aviso-reparto"]')).not.toBeNull();
    expect(a.porTexto('Cerrar octubre').hasAttribute('disabled')).toBe(true);
    await a.escribir('Pasar a noviembre', '1166000');
    expect(a.porTexto('Cerrar octubre').hasAttribute('disabled')).toBe(false);
    await a.tocar('Cerrar octubre');
    expect(a.raiz().querySelector('[role="alert"]')?.textContent ?? '').toBe('');
    expect(a.url()).toBe('/planear/2026-11');
    expect(a.texto()).toContain('Sobrante de octubre Del cierre de mes $1.166.000');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$4.064.000');

    await a.ir('/planear/2026-10/cierre');
    expect(a.texto()).toContain('El mes está cerrado: queda en solo lectura.');
    expect(a.texto()).not.toContain('Cerrar octubre');
  });
});
