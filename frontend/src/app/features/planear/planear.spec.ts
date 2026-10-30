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
    expect(t).toContain('Octubre 2026 Activo · Opción A Editar plan ›');
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

  it('el diezmo es la categoría Diezmo y se edita como cualquier gasto (diezmo-como-gasto)', async () => {
    await conSesion();
    const a = await app('/planear/2026-11');
    expect(a.raiz().querySelector('[data-testid="fila-diezmo"]')).toBeNull();
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.898.000');
    await a.tocar(/^Diezmo/);
    await a.tocar(/^Diezmo · Salario Daniel/);
    expect(a.raiz().querySelector('[data-testid="origen-diezmo"]')!.textContent).toContain('Viene de Salario Daniel');
    await a.escribir('Monto', '750000');
    await a.tocar('Guardar');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.848.000');
    // Quedo ajustado a mano: "Volver a calcular" lo devuelve a lo que sugiere su linea.
    await a.tocar(/^Diezmo · Salario Daniel/);
    await a.tocar('Volver a calcular');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.898.000');
  });

  it('los ingresos de cada opción se editan y se agregan, sin tocar las otras ni Ajustes (diezmo-como-gasto)', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    a.porTexto(/^Opción B/, '[role="tab"]').click();
    await a.estable();
    await a.tocar(/^Salario Daniel/);
    await a.escribir('Monto', '7000000');
    await a.tocar('Guardar');
    expect(a.raiz().querySelector('[data-testid="guardado"]')!.textContent).toContain('Guardado');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.010.000');
    expect((await p.plan.mes(NOV)).opciones[0]!.libre).toBe(2_898_000);
    expect((await p.ingresos.fijos())[0]!.neto).toBe(6_288_000);

    await a.tocar('+ Ingreso');
    await a.escribir('Nombre', 'Venta bicicleta');
    await a.escribir('Monto', '400000');
    await a.tocar('Guardar');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.410.000');
    expect(a.texto()).toContain('Agregado al plan');
  });

  it('editar un monto de la opción cambia lo que dejaría libre', async () => {
    await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar(/^Variables/);
    await a.tocar(/^Mercado/);
    await a.escribir('Monto', '420000');
    await a.tocar('Guardar');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.798.000');
  });

  it('cerrar la hoja sin guardar no cambia nada (usabilidad-plan)', async () => {
    await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar(/^Variables/);
    await a.tocar(/^Mercado/);
    await a.escribir('Monto', '420000');
    await a.tocar('Cancelar');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.898.000');
  });

  it('+ Gasto pide su monto y Quitar confirma (usabilidad-plan)', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar('+ Gasto');
    await a.escribir('Nombre', 'Regalo');
    await a.escribir('Monto', '150000');
    await a.tocar('Guardar');
    expect(a.raiz().querySelector('[data-testid="dejaria-libre"]')!.textContent!.trim()).toBe('$2.748.000');
    const regalo = (await p.plan.mes(NOV)).opciones[0]!.escenario.items.find((i) => i.nombre === 'Regalo')!;
    expect(regalo.monto).toBe(150_000);

    const grupo = (await p.hogar.categorias()).find((c) => c.id === regalo.categoriaId)!;
    await a.tocar(new RegExp('^' + grupo.nombre));
    await a.tocar(/^Regalo/);
    await a.tocar('Quitar');
    expect(a.texto()).toContain('¿Quitar Regalo de la Opción A?');
    await a.tocar('Sí, quitar');
    expect((await p.plan.mes(NOV)).opciones[0]!.escenario.items.some((i) => i.nombre === 'Regalo')).toBe(false);
  });

  it('el mes en curso se edita sin + Duplicar, y las categorías dicen que se abren (usabilidad-plan)', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-10');
    expect(a.texto()).not.toContain('+ Duplicar');
    expect(a.porTexto(/^Variables/).textContent).toContain('›');
    await a.tocar(/^Variables/);
    expect(a.porTexto(/^Variables/).textContent).toContain('⌄');
    await a.tocar(/^Mercado/);
    await a.escribir('Monto', '400000');
    await a.tocar('Guardar');
    expect((await p.plan.mes(OCT)).opciones[0]!.escenario.items.find((i) => i.nombre === 'Mercado')!.monto).toBe(400_000);
  });

  it('un mes cerrado sigue en solo lectura (usabilidad-plan)', async () => {
    await conSesion();
    const a = await app('/planear/2026-09');
    expect(a.texto()).not.toContain('+ Gasto');
    expect(a.raiz().querySelector('[data-testid="linea-ingreso"]')).toBeNull();
  });

  it('borrar el plan de un mes dice qué se borra y lo deja sin plan (usabilidad-plan)', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar('Borrar plan de noviembre');
    expect(a.raiz().querySelector('[data-testid="que-se-borra"]')!.textContent).toContain('Se borra el plan de noviembre');
    await a.tocar('Borrar plan');
    expect((await p.plan.mes(NOV)).estado).toBe('SIN_PLAN');
    expect(a.texto()).toContain('Aún no tiene plan');

    await a.ir('/planear/2026-10');
    await a.tocar('Borrar plan de octubre');
    expect(a.raiz().querySelector('[data-testid="que-se-borra"]')!.textContent).toMatch(/Se borran .* de octubre; los aportes se conservan\./);
    await a.tocar('Continuar');
    await a.tocar('Sí, borrar el plan y sus registros');
    expect((await p.plan.mes(OCT)).estado).toBe('SIN_PLAN');
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
    expect(a.texto()).toContain('Sin cambios Diezmo, Gastos fijos, Tarjetas y cuotas 4.170.000 4.170.000 4.170.000');
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
    // El diezmo es un item del plan: se marca pagado como los demas (diezmo-como-gasto).
    await p.movimientos.marcarPago({ itemId: 'm0-diezmo-salario', ref: OCT, monto: 700_000, usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' } });
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
