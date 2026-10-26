import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { conSesion, provideDemoPrueba, puertos } from '../../../testing/demo';

async function abrir(url: string) {
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  harness.detectChanges();
  return { harness, el: harness.routeNativeElement?.ownerDocument.body as HTMLElement, router: TestBed.inject(Router) };
}

describe('Shell y navegación (steward-ui-shell)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideDemoPrueba()] });
  });

  it('móvil: barra inferior con Hoy activo, Planear y Cuentas (oculta desde 1024 px)', async () => {
    await conSesion();
    const { el } = await abrir('/');
    const barra = el.querySelector('[data-testid="barra-inferior"]')!;
    expect(barra.classList).toContain('lg:hidden');
    const enlaces = [...barra.querySelectorAll('a')];
    expect(enlaces.map((a) => a.textContent!.trim())).toEqual(['Hoy', 'Planear', 'Cuentas']);
    expect(enlaces[0]!.getAttribute('aria-current')).toBe('page');
    expect(el.querySelector('[data-testid="aviso-demo"]')?.textContent).toContain('Datos de prueba');
  });

  it('web: los mismos destinos en un menú lateral que solo se ve desde 1024 px', async () => {
    await conSesion();
    const { el } = await abrir('/hoy');
    const menu = el.querySelector('[data-testid="menu-lateral"]')!;
    expect(menu.classList).toContain('hidden');
    expect(menu.classList).toContain('lg:flex');
    expect([...menu.querySelectorAll('nav a')].map((a) => a.textContent!.trim())).toEqual(['Hoy', 'Planear', 'Cuentas']);
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
