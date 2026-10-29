import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { storageEnMemoria } from '@steward/domain/demo';

import { routes } from '../../app.routes';
import { providePuertosDemo } from '../../core/datos/puertos';
import { AHORA, NOV, OCT, conSesion, provideAppPrueba, puertos } from '../../../testing/demo';
import { app, textoLegible } from '../../../testing/harness';

describe('Ajustes (steward-ajustes)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppPrueba() }));

  const libre = (a: Awaited<ReturnType<typeof app>>) => a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim();

  it('muestra el hogar con sus miembros', async () => {
    await conSesion();
    const a = await app('/ajustes');
    expect(a.texto()).toContain('Hogar · Nuestra casa');
    expect([...a.raiz().querySelectorAll('[data-testid="miembro"]')].map((m) => textoLegible(m))).toEqual(['D Daniel (tú)', 'E Esposa Se unió el 27 sep']);
    expect(a.texto()).toContain('Salario Daniel Fijo · diezmo 10% del bruto $6.288.000 ›');
  });

  it('Agrupado muestra una sola tarjeta de diezmo con la suma', async () => {
    const p = await conSesion();
    await p.ingresos.registrarAporte({ usuarioId: 'u-daniel', monto: 2_000_000, ref: OCT, cuentaId: null, aplicaDiezmo: true });
    const a = await app('/ajustes');
    await a.tocar('Agrupado');
    await a.ir('/hoy');
    const tarjetas = a.raiz().querySelectorAll('[data-testid="tarjeta-diezmo"]');
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0]!.textContent).toContain('$900.000');
    expect(tarjetas[0]!.textContent).toContain('2 ingresos recibidos');
  });

  it('+ Agregar ingreso fijo: lo crea y Hoy lo muestra por recibir', async () => {
    await conSesion();
    const a = await app('/ajustes');
    await a.tocar('+ Agregar ingreso fijo');
    expect(a.texto()).toContain('Nuevo ingreso fijo');
    await a.escribir('Nombre', 'Prima');
    await a.escribir('Entra (neto)', '1000000');
    await a.escribir('Día de pago', '30');
    await a.tocar('Agregar ingreso');
    expect(a.texto()).toContain('Prima Fijo · diezmo 10% del bruto $1.000.000 ›');
    await a.ir('/hoy');
    expect(a.texto()).toContain('Prima');
    expect(a.texto()).toContain('llega el día 30');
  });

  it('una categoría nueva queda disponible al agregar gastos al plan', async () => {
    await conSesion();
    const a = await app('/ajustes');
    await a.tocar('+ Nueva');
    await a.escribir('Nombre', 'Educación');
    await a.tocar('Crear categoría');
    expect([...a.raiz().querySelectorAll('[data-testid="categoria"]')].map((c) => c.textContent!.replace('Editar', '').trim())).toContain('Educación');
    await a.ir('/planear/2026-11');
    const opciones = [...a.raiz().querySelectorAll('select[aria-label="Categoría del gasto"] option')].map((o) => o.textContent!.trim());
    expect(opciones).toContain('Educación');
  });

  it('ocultar montos muestra $•••• hasta tocar', async () => {
    await conSesion();
    const a = await app('/ajustes');
    const interruptores = [...a.raiz().querySelectorAll<HTMLButtonElement>('[role="switch"]')];
    const ocultar = interruptores.find((b) => a.raiz().querySelector(`#${b.getAttribute('aria-labelledby')}`)!.textContent!.trim() === 'Ocultar montos')!;
    ocultar.click();
    await a.estable();
    await a.ir('/hoy');
    expect(libre(a)).toBe('$••••');
    (a.raiz().querySelector('[data-testid="libre"] button') as HTMLButtonElement).click();
    await a.estable();
    expect(libre(a)).toBe('$3.436.000');
  });

  it('cerrar sesión vuelve a Acceso y conserva los datos', async () => {
    const p = await conSesion();
    await p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: 'Farmacia', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    const a = await app('/ajustes');
    await a.tocar('Cerrar sesión');
    expect(a.url()).toBe('/acceso');
    await a.tocar('Continuar con Google');
    expect(a.url()).toBe('/hoy');
    expect(libre(a)).toBe('$3.351.000');
  });

  it('restablecer datos de prueba vuelve a los datos iniciales', async () => {
    const p = await conSesion();
    await p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: '', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    const a = await app('/ajustes');
    await a.tocar('Restablecer datos de prueba');
    await a.tocar('Restablecer');
    expect(a.texto()).toContain('Volvieron los datos de ejemplo.');
    await a.ir('/hoy');
    expect(libre(a)).toBe('$3.436.000');
  });

  it('probar desde cero lleva al acceso con el hogar sin configurar', async () => {
    await conSesion();
    const a = await app('/ajustes');
    await a.tocar('Probar desde cero');
    await a.tocar('Empezar desde cero');
    expect(a.url()).toBe('/acceso');
    await a.tocar('Continuar con Google');
    expect(a.url()).toBe('/acceso/face-id');
  });

  it('salir del hogar pide confirmación', async () => {
    await conSesion();
    const a = await app('/ajustes');
    await a.tocar('Salir del hogar');
    expect(a.texto()).toContain('Dejarás de ver y registrar en este presupuesto.');
    await a.tocar('Cancelar');
    expect(a.url()).toBe('/ajustes');
    expect((await puertos().hogar.obtener()).miembros).toHaveLength(2);
  });
});

describe('Persistencia del modo demo (steward-ui-shell)', () => {
  it('un gasto registrado sigue ahí al recargar la app', async () => {
    const storage = storageEnMemoria();
    const proveedores = [provideRouter(routes, withComponentInputBinding()), providePuertosDemo({ storage, ahora: AHORA })];
    TestBed.configureTestingModule({ providers: proveedores });
    const p = await conSesion();
    await p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: 'Farmacia', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: proveedores });
    const a = await app('/hoy');
    expect(a.texto()).toContain('Farmacia No estaba planeado');
    expect((await puertos().plan.mes(NOV)).estado).toBe('BORRADOR');
  });
});
