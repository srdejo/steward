import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { conSesion, provideAppPrueba, puertos } from '../../../testing/demo';

async function abrir(url: string) {
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  harness.detectChanges();
  return { harness, el: harness.routeNativeElement?.ownerDocument.body as HTMLElement, router: TestBed.inject(Router) };
}

describe('Shell y navegación (steward-ui-shell)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
  });

  it('móvil: barra inferior con Hoy activo, Planear, el +, Cuentas y Ajustes (oculta desde 1024 px)', async () => {
    await conSesion();
    const { el } = await abrir('/');
    const barra = el.querySelector('[data-testid="barra-inferior"]')!;
    expect(barra.classList).toContain('lg:hidden');
    const espacios = [...barra.children].map((c) => c.getAttribute('aria-label') ?? c.textContent!.trim());
    expect(espacios).toEqual(['Hoy', 'Planear', 'Agregar gasto, aporte o pago', 'Cuentas', 'Ajustes']);
    expect(barra.querySelector('a')!.getAttribute('aria-current')).toBe('page');
    expect(el.querySelector('[data-testid="aviso-demo"]')?.textContent).toContain('Datos de prueba');
  });

  it('web: barra superior con el nombre del hogar, los cuatro destinos, Agregar y los avatares, solo desde 1024 px', async () => {
    await conSesion();
    const { el } = await abrir('/hoy');
    const menu = el.querySelector('[data-testid="barra-superior"]')!;
    expect(menu.classList).toContain('hidden');
    expect(menu.classList).toContain('lg:flex');
    expect(menu.querySelector('[data-testid="avatares-hogar"]')).not.toBeNull();
    expect([...menu.querySelectorAll('nav a')].map((a) => a.textContent!.trim())).toEqual(['Hoy', 'Planear', 'Cuentas', 'Ajustes']);
    expect(menu.querySelector('[data-testid="nombre-hogar"]')?.textContent).toBe('Nuestra casa');
    expect(menu.querySelector('[data-testid="agregar-superior"]')?.textContent!.trim()).toBe('Agregar');
  });

  it('Ajustes queda activo en la barra superior y en la barra inferior', async () => {
    await conSesion();
    const { el } = await abrir('/ajustes');
    const activo = (sel: string) => [...el.querySelectorAll(sel)].find((a) => a.textContent!.trim() === 'Ajustes')!.getAttribute('aria-current');
    expect(activo('[data-testid="barra-superior"] nav a')).toBe('page');
    expect(activo('[data-testid="barra-inferior"] a')).toBe('page');
  });

  it('el + abre Agregar sobre la pantalla actual y cerrarlo vuelve a ella', async () => {
    await conSesion();
    const { el, router, harness } = await abrir('/planear');
    el.querySelector<HTMLButtonElement>('[data-testid="agregar"]')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/planear?agregar=gasto');
    expect(el.querySelector('app-agregar-hoja')).not.toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('app-agregar-hoja button')].find((b) => b.textContent!.trim() === 'Cancelar')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/planear');
    expect(el.querySelector('app-agregar-hoja')).toBeNull();
  });

  it('los avatares del hogar abren Ajustes del hogar', async () => {
    await conSesion();
    const { el, router, harness } = await abrir('/hoy');
    const avatares = el.querySelector<HTMLAnchorElement>('[data-testid="avatares-hogar"]')!;
    expect(avatares.getAttribute('aria-label')).toBe('Ajustes del hogar');
    expect(avatares.getAttribute('href')).toBe('/ajustes');
    expect(avatares.textContent!.replace(/\s/g, '')).toBe('DE');
    avatares.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/ajustes');
  });

  it('sin sesión lleva a Acceso', async () => {
    expect((await abrir('/hoy')).router.url).toBe('/acceso');
  });

  it('con el hogar sin configurar lleva al onboarding', async () => {
    const p = puertos();
    await p.demo!.probarDesdeCero();
    await p.sesion.iniciar('GOOGLE');
    expect((await abrir('/cuentas')).router.url).toBe('/onboarding/1');
  });
});
