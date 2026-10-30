import { TestBed } from '@angular/core/testing';

import { NOV, OCT, conSesion, provideAppPrueba } from '../../../testing/demo';
import { app, textoLegible } from '../../../testing/harness';

describe('Cuentas (steward-cuentas)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppPrueba() }));

  const cuenta = (a: Awaited<ReturnType<typeof app>>, nombre: string) => textoLegible(a.raiz().querySelector(`[data-cuenta="${nombre}"]`)!);

  it('lista cuentas con titular y cuadre, y filtra por titular', async () => {
    await conSesion();
    const a = await app('/cuentas');
    expect(a.raiz().querySelector('[data-testid="saldo-hogar"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ $9.130.000');
    expect(cuenta(a, 'Ahorros Esposa')).toBe('Ahorros Esposa Esposa · sin cuadrar desde 20 sep ≈ $1.420.000');
    expect(cuenta(a, 'Nu')).toBe('Nu Daniel · cuadrada hoy $3.360.000');
    expect(a.texto()).toContain('Debes $14.250.000');
    expect(a.texto()).toContain('Libre inversión Cuota $500.000 · 1,6% EM · faltan 38');

    await a.tocar('Esposa', '[role="radio"]');
    expect([...a.raiz().querySelectorAll('[data-cuenta]')].map((e) => e.getAttribute('data-cuenta'))).toEqual(['Ahorros Esposa']);
  });

  it('el detalle de una cuenta muestra de dónde sale su saldo (usabilidad-plan)', async () => {
    const p = await conSesion();
    await p.cuentas.agregar({ nombre: 'Bancolombia', titularId: null, saldo: 4_000_000 });
    const id = (await p.cuentas.cuentas()).cuentas.find((c) => c.cuenta.nombre === 'Bancolombia')!.cuenta.id;
    await p.movimientos.registrarGasto({ monto: 1_500_000, itemId: null, nota: 'Arriendo', usuarioId: 'u-daniel', origen: { tipo: 'CUENTA', cuentaId: id }, ref: OCT });
    const a = await app('/cuentas');
    await a.tocar(/^Bancolombia/);
    expect(a.url()).toBe('/cuentas/cuenta/' + id);
    expect(a.texto()).toContain('$4.000.000');
    expect(a.texto()).toContain('Arriendo');
    expect(a.texto()).toContain('−$1.500.000');
    expect(a.raiz().querySelector('[data-testid="saldo-cuenta"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ $2.500.000');

    await a.tocar(/^Arriendo/);
    await a.tocar('Borrar este registro');
    expect(a.raiz().querySelector('[data-testid="efecto-borrar"]')!.textContent).toContain('El saldo de Bancolombia sube $1.500.000');
    await a.tocar('Sí, borrar');
    expect(a.url()).toBe('/cuentas/cuenta/' + id);
    expect(a.raiz().querySelector('[data-testid="saldo-cuenta"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ $4.000.000');
  });

  it('agregar una cuenta y mover dinero', async () => {
    const p = await conSesion();
    const a = await app('/cuentas');
    await a.tocar('+ Agregar');
    await a.escribir('Nombre', 'Bancolombia');
    await a.escribir('Saldo aproximado', '500000');
    await a.tocar('Agregar cuenta');
    expect(cuenta(a, 'Bancolombia')).toContain('Conjunta');

    await a.tocar('Mover dinero');
    const chips = (grupo: number) => [...a.raiz().querySelectorAll('app-hoja [role="radiogroup"]')][grupo]!;
    (([...chips(0).querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Bancolombia')) as HTMLButtonElement).click();
    (([...chips(1).querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Nu')) as HTMLButtonElement).click();
    await a.estable();
    await a.escribir('¿Cuánto?', '200000');
    await a.tocar('Mover');
    const vistas = (await p.cuentas.cuentas()).cuentas;
    expect(vistas.find((c) => c.cuenta.nombre === 'Bancolombia')?.saldo).toBe(300_000);
    expect(vistas.find((c) => c.cuenta.nombre === 'Nu')?.saldo).toBe(3_560_000);
  });

  it('cuadrar guarda la diferencia como ajuste y el cierre la cuenta en Sin registrar', async () => {
    const p = await conSesion();
    const a = await app('/cuentas/cuadrar');
    expect(a.texto()).toContain('Hogar · 4 cuentas');
    await a.escribir('[data-cuenta="Davivienda"] input', '3980000');
    await a.escribir('[data-cuenta="Efectivo"] input', '150000');
    await a.escribir('[data-cuenta="Nu"] input', '3360000');
    expect(cuenta(a, 'Davivienda')).toContain('−$170.000');
    expect(cuenta(a, 'Efectivo')).toContain('Hay en la billetera');
    expect(cuenta(a, 'Nu')).toContain('Cuadra');
    expect(a.raiz().querySelector('[data-testid="sin-registrar"]')!.textContent!.trim()).toBe('$220.000');

    await a.tocar('Guardar saldos');
    expect(a.url()).toBe('/cuentas');
    expect(cuenta(a, 'Davivienda')).toBe('Davivienda Daniel · cuadrada hoy $3.980.000');
    expect(cuenta(a, 'Ahorros Esposa')).toContain('≈ $1.420.000');
    expect((await p.cierre.vista(OCT)).sinRegistrar).toBe(220_000);
  });

  it('detalle de crédito: simulador y probarlo como opción', async () => {
    const p = await conSesion();
    const a = await app('/cuentas/credito/cred-libre');
    expect(a.texto()).toContain('Crédito · Davivienda Libre inversión $14.250.000 Saldo actualizado el 25 oct');
    expect(a.texto()).toContain('Pagado 37% de $22.500.000 Faltan 38 cuotas');
    expect(a.raiz().querySelector('[data-testid="simulacion"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('≈ 5 cuotas menos y ≈ $1.200.000 menos en intereses.');
    await a.escribir('Abono', '2000000');
    expect(a.raiz().querySelector('[data-testid="simulacion"]')!.textContent).toContain('cuotas menos');

    await a.tocar('Probarlo como opción de noviembre ›');
    expect(a.url()).toBe('/planear/2026-11');
    const nov = await p.plan.mes(NOV);
    expect(nov.opciones.map((o) => o.escenario.letra)).toEqual(['A', 'B', 'C', 'D']);
    expect(nov.opciones[3]!.grupos.find((g) => g.nombre === 'Créditos')?.items.map((i) => i.monto)).toContain(2_000_000);
  });

  it('registrar un abono baja el saldo', async () => {
    await conSesion();
    const a = await app('/cuentas/credito/cred-libre');
    await a.tocar('Registrar abono');
    await a.escribir('¿Cuánto abonaste?', '1000000');
    await a.tocar('Guardar');
    expect(a.texto()).toContain('Libre inversión $13.250.000');
    expect(a.texto()).toContain('Abono · 26 oct $1.000.000');
  });

  it('el abono pide de dónde sale y baja esa cuenta', async () => {
    const p = await conSesion();
    const a = await app('/cuentas/credito/cred-libre');
    await a.tocar('Registrar abono');
    await a.escribir('¿Cuánto abonaste?', '1000000');
    await a.tocar('Davivienda', 'app-hoja [role="radio"]');
    await a.tocar('Guardar');
    expect((await p.cuentas.cuentas()).cuentas.find((c) => c.cuenta.nombre === 'Davivienda')?.saldo).toBe(3_150_000);
  });

  it('agregar un crédito: su cuota entra al plan del mes (Agregar crédito)', async () => {
    const p = await conSesion();
    const a = await app('/cuentas');
    await a.tocar('+ Agregar', '[aria-label="Agregar crédito"]');
    await a.escribir('Nombre', 'Moto');
    await a.escribir('Entidad', 'Bancolombia');
    await a.escribir('Saldo', '14250000');
    await a.escribir('Total original', '20000000');
    await a.escribir('Tasa (% EM)', '1,6');
    await a.escribir('Día de pago', '15');
    expect(a.porTexto<HTMLButtonElement>('Agregar crédito').disabled).toBe(true);
    await a.escribir('Cuota', '500000');
    await a.tocar('Agregar crédito');
    expect(a.texto()).toContain('Moto Cuota $500.000 · 1,6% EM');
    const credito = (await p.cuentas.creditos()).find((c) => c.credito.nombre === 'Moto')!;
    expect(credito.porcentajePagado).toBe(29);
    const oct = await p.plan.mes(OCT);
    const cuotas = oct.opciones.flatMap((o) => o.grupos.flatMap((g) => g.items)).filter((i) => i.nombre === 'Cuota moto');
    expect(cuotas.map((i) => i.monto)).toEqual([500_000]);
  });
});
