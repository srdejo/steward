import { TestBed } from '@angular/core/testing';

import { provideAppPrueba, puertos } from '../../../testing/demo';
import { app } from '../../../testing/harness';

describe('Acceso y onboarding (steward-acceso-onboarding)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppPrueba() }));

  async function desdeCero() {
    await puertos().demo!.probarDesdeCero();
    return app('/acceso');
  }

  it('primera vez: Continuar con Google lleva a Activar Face ID', async () => {
    const a = await desdeCero();
    expect(a.texto()).toContain('Si es tu primera vez, se crea tu cuenta.');
    await a.tocar('Continuar con Google');
    expect(a.url()).toBe('/acceso/face-id');
  });

  it('hogar ya configurado: Continuar con correo abre Hoy', async () => {
    const a = await app('/acceso');
    await a.tocar('Continuar con correo');
    expect(a.url()).toBe('/hoy');
  });

  it('omitir Face ID sigue al onboarding con la preferencia desactivada', async () => {
    const a = await desdeCero();
    await a.tocar('Continuar con Google');
    await a.tocar('Ahora no');
    expect(a.url()).toBe('/onboarding/1');
    expect((await puertos().sesion.actual())?.preferencias.faceIdAlAbrir).toBe(false);
  });

  it('flujo completo: vista previa del diezmo, saltar cuentas, invitación pendiente y Hoy', async () => {
    const a = await desdeCero();
    await a.tocar('Continuar con Google');
    await a.tocar('Activar Face ID');
    expect((await puertos().sesion.actual())?.preferencias.faceIdAlAbrir).toBe(true);

    // Paso 1: nombre prellenado y nombre del hogar.
    expect(a.campo('Tu nombre').value).toBe('Daniel');
    await a.escribir('Nombre del hogar', 'Nuestra casa');
    await a.tocar('Continuar');
    expect(a.url()).toBe('/onboarding/2');

    // Paso 2: diezmo 10 % sobre el bruto (valores por defecto).
    expect(a.porTexto(/Sí, diezmo/).getAttribute('aria-checked')).toBe('true');
    expect(a.porTexto('Bruto').getAttribute('aria-checked')).toBe('true');
    await a.tocar('Continuar');
    expect(a.url()).toBe('/onboarding/3');

    // Paso 3: la vista previa del diezmo sale del bruto.
    await a.escribir('BRUTO', '7000000');
    await a.escribir('ENTRA (NETO)', '6288000');
    await a.escribir('DÍA DE PAGO', '25');
    expect(a.raiz().querySelector('[data-testid="vista-previa-diezmo"]')?.textContent).toContain('$700.000');
    await a.tocar('Atrás');
    expect(a.url()).toBe('/onboarding/2');
    await a.tocar('Continuar');
    await a.tocar('Continuar');
    expect(a.url()).toBe('/onboarding/4');
    expect((await puertos().ingresos.fijos()).map((f) => [f.nombre, f.bruto, f.neto, f.diaPago])).toEqual([['Salario', 7_000_000, 6_288_000, 25]]);

    // Paso 4: saltar deja el hogar sin cuentas.
    await a.tocar('Saltar por ahora');
    expect(a.url()).toBe('/onboarding/5');
    expect((await puertos().cuentas.cuentas()).cuentas).toEqual([]);

    // Paso 5: la invitación queda pendiente con Reenviar.
    await a.escribir('#correo-invitacion', 'esposa@ejemplo.com');
    await a.tocar('Invitar');
    const inv = a.raiz().querySelector('[data-testid="invitacion"]')!;
    expect(inv.textContent).toContain('esposa@ejemplo.com');
    expect(inv.textContent).toContain('Invitación enviada · pendiente');
    expect(inv.textContent).toContain('Reenviar');

    await a.tocar('Empezar');
    expect(a.url()).toBe('/hoy');
    expect((await puertos().sesion.actual())?.hogarConfigurado).toBe(true);
  });

  it('el paso 1 exige nombre del hogar', async () => {
    const a = await desdeCero();
    await a.tocar('Continuar con Google');
    await a.tocar('Ahora no');
    await a.tocar('Continuar');
    expect(a.url()).toBe('/onboarding/1');
    expect(a.raiz().querySelector('[role="alert"]')?.textContent).toContain('El hogar necesita un nombre');
  });

  it('unirse desde una invitación deja al invitado como miembro y abre Hoy', async () => {
    const p = puertos();
    await p.demo!.probarDesdeCero();
    await p.sesion.iniciar('GOOGLE');
    await p.hogar.nombrar('Nuestra casa');
    await p.hogar.completarOnboarding();
    const inv = await p.hogar.invitar('esposa@ejemplo.com');
    await p.sesion.cerrar();

    const a = await app(`/invitacion/${inv.token}`);
    expect(a.texto()).toContain('Daniel te invitó a Nuestra casa');
    await a.escribir('Tu nombre', 'Ana');
    await a.tocar('Unirme al hogar');
    expect(a.url()).toBe('/hoy');
    expect((await p.hogar.obtener()).miembros.map((m) => m.usuario.nombre)).toEqual(['Daniel', 'Ana']);
    expect((await p.sesion.actual())?.usuario.nombre).toBe('Ana');
  });

  it('una invitación usada o vencida lo dice', async () => {
    const a = await app('/invitacion/no-existe');
    expect(a.texto()).toContain('Esta invitación ya no sirve');
  });
});
