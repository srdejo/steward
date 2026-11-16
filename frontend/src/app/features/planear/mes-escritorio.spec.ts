import { TestBed } from '@angular/core/testing';

import { type MesRef } from '@steward/domain';

import { NOV, conSesion, provideAppPrueba } from '../../../testing/demo';
import { anchoDeVentana, app, textoLegible } from '../../../testing/harness';

const DIC: MesRef = { anio: 2026, mes: 12 };

/** El plan del mes en escritorio (spec steward-planear, plan-mes-escritorio). */
describe('Plan del mes en escritorio', () => {
  let original: typeof window.matchMedia;

  beforeEach(() => {
    localStorage.removeItem('steward/mes-hoy');
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
    original = window.matchMedia;
    anchoDeVentana(1280);
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  /** Diciembre copiado de noviembre, con la prima del anual y la Navidad. */
  async function diciembre() {
    const p = await conSesion();
    await p.plan.crearMes(DIC, 'COPIAR');
    const plan = (await p.plan.mes(DIC)).plan!;
    await p.plan.guardarItem(plan.id, plan.escenarios[0]!.id, {
      categoriaId: 'cat-variables', nombre: 'Navidad', monto: 680_000, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false,
    });
    return p;
  }

  const fila = (raiz: HTMLElement, nombre: string) => textoLegible(raiz.querySelector(`[data-fila="${nombre}"]`)!);

  it('diciembre con una opción: indicadores, lo que no estaba en noviembre y quedaría libre', async () => {
    const p = await diciembre();
    const a = await app('/planear/2026-12');
    expect(a.raiz().querySelector('[data-testid="mes-una-opcion"]')).not.toBeNull();
    expect(a.texto()).toContain('Borrador · empieza en 36 días');
    expect(a.texto()).toContain('Crear otra opción');
    expect(a.texto()).toContain('Usar este plan en diciembre');
    expect(textoLegible(a.raiz().querySelector('[data-testid="nota-entra"]')!)).toBe('Incluye Prima ($3.500.000)');
    expect(fila(a.raiz(), 'Prima')).toContain('Solo diciembre');
    expect(fila(a.raiz(), 'Prima')).toContain('+$3.500.000');
    expect(fila(a.raiz(), 'Navidad')).toContain('Solo diciembre');
    expect(fila(a.raiz(), 'Navidad')).toContain('+$680.000');
    const v = (await p.plan.mes(DIC)).opciones[0]!;
    expect(a.raiz().querySelector('[data-testid="quedaria-libre"]')!.textContent!.trim()).toBe(`$${(v.libre).toLocaleString('de-DE')}`);
    expect(a.texto()).toContain('DIEZMO $1.050.000 Salario Daniel $700.000 · Prima $350.000');
  });

  it('elegir un día desde una fila: el calendario lo marca y lista lo que sale', async () => {
    await diciembre();
    const a = await app('/planear/2026-12');
    (a.raiz().querySelector('[data-fila="Compra a cuotas"]') as HTMLElement).click();
    await a.estable();
    expect(a.raiz().querySelector('[aria-label^="20 de diciembre"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(textoLegible(a.raiz().querySelector('[data-testid="dia-elegido"]')!)).toBe('20 de diciembre Compra a cuotas − $375.000');
    await a.tocar(/^2$/, '[data-testid="calendario"] button');
    expect(textoLegible(a.raiz().querySelector('[data-testid="dia-elegido"]')!)).toBe('2 de diciembre Nada programado este día.');
  });

  it('el punto más bajo: el último pago antes del salario', async () => {
    const p = await diciembre();
    const a = await app('/planear/2026-12');
    const { total } = await p.cuentas.cuentas();
    const antes = 550_000 + 800_000 + 50_000 + 120_000 + 50_000 + 25_000 + 500_000 + 375_000;
    expect(textoLegible(a.raiz().querySelector('[data-testid="punto-bajo"]')!)).toBe(`! Punto más bajo el 20 dic , con ≈ $${(total - antes).toLocaleString('de-DE')} .`);
    expect(a.texto()).toContain('Los gastos sin fecha ($1.430.000) y los ingresos sin fecha ($3.500.000) no están aquí.');
  });

  it('editar Transporte en la celda actualiza Sale, Quedaría libre y su diferencia', async () => {
    const p = await diciembre();
    const a = await app('/planear/2026-12');
    await a.escribir('Transporte en diciembre', '420000');
    const v = (await p.plan.mes(DIC)).opciones[0]!;
    expect(v.grupos.flatMap((g) => g.items).find((i) => i.nombre === 'Transporte')!.monto).toBe(420_000);
    expect(fila(a.raiz(), 'Transporte')).toContain('+$170.000');
    expect(a.raiz().querySelector('[data-testid="quedaria-libre"]')!.textContent!.trim()).toBe(`$${v.libre.toLocaleString('de-DE')}`);
  });

  it('octubre (Activo) se edita en la celda; septiembre (Cerrado) no', async () => {
    await conSesion();
    const a = await app('/planear/2026-10');
    expect(a.texto()).toContain('Ver ejecución');
    expect(a.raiz().querySelector('[data-testid="mes-una-opcion"] input')).not.toBeNull();
    await a.ir('/planear/2026-09');
    expect(a.raiz().querySelector('[data-testid="mes-una-opcion"]')).not.toBeNull();
    expect(a.raiz().querySelector('[data-testid="mes-una-opcion"] input')).toBeNull();
    expect(a.texto()).toContain('Ver cierre');
  });

  it('noviembre con tres opciones: lado a lado, resaltando lo que difiere de la A', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    expect(a.raiz().querySelector('[data-testid="mes-opciones"]')).not.toBeNull();
    const regalos = [...a.raiz().querySelectorAll('[data-fila="Regalos de Navidad"] td[data-cambia]')];
    expect(regalos.map((c) => c.textContent!.trim() || (c.querySelector('input') as HTMLInputElement | null)?.value)).toEqual(['', '$600.000', '—']);
    expect(regalos.map((c) => c.getAttribute('data-cambia'))).toEqual(['false', 'true', 'false']);
    const libres = (await p.plan.mes(NOV)).opciones.map((o) => `$${o.libre.toLocaleString('de-DE')}`);
    expect(fila(a.raiz(), 'Queda libre')).toBe(`Queda libre ${libres.join(' ')}`);
  });

  it('escribir en una celda vacía agrega el gasto a la opción', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.escribir('Regalos de Navidad en la Opción A', '300000');
    const opcionA = (await p.plan.mes(NOV)).opciones[0]!;
    const regalos = opcionA.grupos.find((g) => g.nombre === 'Variables')!.items.find((i) => i.nombre === 'Regalos de Navidad')!;
    expect([regalos.monto, regalos.tipo]).toEqual([300_000, 'VARIABLE']);
    expect(a.raiz().querySelectorAll('[data-fila="Regalos de Navidad"] td[data-cambia="true"]')).toHaveLength(2);
  });

  it('"Solo lo que cambia" oculta las filas iguales y dice cuántas', async () => {
    await conSesion();
    const a = await app('/planear/2026-11');
    const check = a.raiz().querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await a.estable();
    expect([...a.raiz().querySelectorAll('tr[data-categoria]')].map((f) => f.getAttribute('data-fila'))).toEqual(['Regalos de Navidad', 'Abono extra crédito', 'Ahorro viaje']);
    expect(a.raiz().querySelector('[data-testid="ocultos"]')!.textContent!.trim()).toBe('13 gastos iguales en todas las opciones, ocultos');
  });

  it('elegir la B y usarla: noviembre pasa a la vista de una opción', async () => {
    const p = await conSesion();
    const a = await app('/planear/2026-11');
    await a.tocar(/Opción B/, 'th button');
    expect(a.texto()).toContain('Opción B dejaría libre');
    expect(a.texto()).toContain('Suma Regalos de Navidad $600.000');
    await a.tocar('Usar Opción B para noviembre');
    const nov = await p.plan.mes(NOV);
    expect(nov.plan!.escenarioActivoId).toBe('plan-m1-b');
    expect(a.url()).toBe('/planear/2026-11');
    expect(a.raiz().querySelector('[data-testid="mes-una-opcion"]')).not.toBeNull();
  });

  it('Ctrl + D duplica la opción, y crear otra opción pasa a la vista de opciones', async () => {
    const p = await diciembre();
    const a = await app('/planear/2026-12');
    await a.tocar('Crear otra opción');
    expect(a.raiz().querySelector('[data-testid="mes-opciones"]')).not.toBeNull();
    a.raiz().querySelector('[data-testid="mes-opciones"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
    await a.estable();
    expect((await p.plan.mes(DIC)).opciones.map((o) => o.escenario.letra)).toEqual(['A', 'B', 'C']);
  });

  it('N en una celda abre "+ Agregar" en su categoría', async () => {
    await conSesion();
    const a = await app('/planear/2026-11');
    const celda = a.campo('Transporte en la Opción A');
    celda.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    await a.estable();
    expect(a.texto()).toContain('Nuevo gasto');
    expect(a.raiz().querySelector('[role="radio"][aria-checked="true"]')!.textContent!.trim()).toBe('Variables');
  });

  it('un mes sin plan muestra las formas de empezar y "ya trae" una al lado de la otra', async () => {
    await conSesion();
    const a = await app('/planear/2026-12');
    const grid = a.raiz().querySelector('[data-testid="mes-sin-plan"]')!;
    expect(grid.children).toHaveLength(2);
    expect(textoLegible(grid.children[1]!)).toContain('Diciembre ya trae');
  });

  it('Comparar lleva al mes en escritorio; en móvil sigue igual', async () => {
    await conSesion();
    const a = await app('/planear/2026-11/comparar');
    expect(a.url()).toBe('/planear/2026-11');
    expect(a.raiz().querySelector('[data-testid="mes-opciones"]')).not.toBeNull();
    anchoDeVentana(390);
    await a.ir('/planear/2026-11/comparar');
    expect(a.url()).toBe('/planear/2026-11/comparar');
    expect(a.texto()).toContain('Comparar opciones');
  });
});
