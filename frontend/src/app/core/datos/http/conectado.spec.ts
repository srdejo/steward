import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReglaError, type Puertos } from '@steward/domain';

import { GoogleDePrueba, USUARIO, hogarApi, http, provideConectadoPrueba, responder } from '../../../../testing/conectado';
import { provideAppPrueba } from '../../../../testing/demo';
import { app } from '../../../../testing/harness';
import { PUERTOS, puertosConectados } from '../puertos';
import type { InvitacionConectada } from './puertos-conectados';

const TOKEN = 'steward/sesion';
const tick = () => new Promise<void>((r) => setTimeout(r));

function conToken(): void {
  localStorage.setItem(TOKEN, 'jwt-de-prueba');
}

const sesionApi = (extra: Partial<{ tieneHogar: boolean; hogarConfigurado: boolean; token: string }> = {}) => ({
  usuario: USUARIO,
  tieneHogar: extra.tieneHogar ?? true,
  hogarConfigurado: extra.hogarConfigurado ?? true,
  ...(extra.token ? { token: extra.token } : {}),
});

beforeEach(() => {
  localStorage.removeItem(TOKEN);
  sessionStorage.clear();
});

describe('modo de datos (design D9)', () => {
  it('demo usa solo el adaptador de prueba', () => {
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
    expect(puertosConectados(TestBed.inject(PUERTOS))).toBeNull();
  });

  it('conectado compone HTTP y datos de prueba', () => {
    TestBed.configureTestingModule({ providers: provideConectadoPrueba() });
    expect(puertosConectados(TestBed.inject(PUERTOS))).not.toBeNull();
  });
});

describe('adaptador HTTP (contrato del backend)', () => {
  let p: Puertos;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideConectadoPrueba() });
    p = TestBed.inject(PUERTOS);
  });
  afterEach(() => http().verify());

  it('obtener mapea miembros, el usuario actual e invitaciones', async () => {
    const vista = p.hogar.obtener();
    await responder('GET', '/api/hogar', hogarApi({
      invitaciones: [{ id: 'i-1', email: 'esposa@ejemplo.com', estado: 'PENDIENTE', enviadaEn: '2026-10-26T15:00:00Z', expiraEn: '2026-11-02T15:00:00Z' }],
    }), tick);
    const v = await vista;
    expect(v.hogar.nombre).toBe('Nuestra casa');
    expect(v.miembros[0]).toMatchObject({ usuario: { nombre: 'Ana María', inicial: 'A' }, esActual: true });
    expect(v.invitaciones[0]).toMatchObject({ email: 'esposa@ejemplo.com', estado: 'PENDIENTE', expiraEn: '2026-11-02', token: '' });
    expect(v.hogar.diezmoEnHoy).toBe('SEPARADO');
  });

  it('nombrar crea el hogar si todavía no existe', async () => {
    const nombrar = p.hogar.nombrar('Nuestra casa');
    const patch = await responder('PATCH', '/api/hogar', { codigo: 'SIN_HOGAR', mensaje: 'Todavía no tienes un hogar' }, tick, 404);
    const post = await responder('POST', '/api/hogar', hogarApi(), tick, 201);
    await nombrar;
    expect(patch.request.body).toEqual({ nombre: 'Nuestra casa' });
    expect(post.request.body).toEqual({ nombre: 'Nuestra casa' });
  });

  it('invitar trae si el correo salió y la ruta del enlace', async () => {
    const invitar = p.hogar.invitar('esposa@ejemplo.com');
    await responder('POST', '/api/hogar/invitaciones', {
      invitacion: { id: 'i-1', email: 'esposa@ejemplo.com', estado: 'PENDIENTE', enviadaEn: '2026-10-26T15:00:00Z', expiraEn: '2026-11-02T15:00:00Z' },
      enlace: 'http://steward.test/invitacion/tok-1',
      correoEnviado: false,
    }, tick, 201);
    const inv = (await invitar) as InvitacionConectada;
    expect(inv.correoEnviado).toBe(false);
    expect(inv.enlace).toBe('/invitacion/tok-1');
  });

  it('los errores llegan con su código y mensaje', async () => {
    const error = p.hogar.invitar('esposa@ejemplo.com').then(
      () => null,
      (e: unknown) => e,
    );
    await responder('POST', '/api/hogar/invitaciones', { codigo: 'YA_ES_MIEMBRO', mensaje: 'Esa persona ya es parte del hogar' }, tick, 409);
    const e = await error;
    expect(e).toBeInstanceOf(ReglaError);
    expect(e).toMatchObject({ codigo: 'YA_ES_MIEMBRO', message: 'Esa persona ya es parte del hogar' });
  });

  it('una invitación no válida es null', async () => {
    const inv = p.hogar.invitacion('tok-viejo');
    await responder('GET', '/api/invitaciones/tok-viejo', { codigo: 'INVITACION_NO_VALIDA', mensaje: 'Esta invitación ya no es válida' }, tick, 404);
    expect(await inv).toBeNull();
  });

  it('el token viaja como Bearer y un 401 borra la sesión y abre Acceso', async () => {
    conToken();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const actual = p.sesion.actual();
    const req = await responder('GET', '/api/sesion', { codigo: 'NO_AUTENTICADO', mensaje: 'Inicia sesión' }, tick, 401);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-de-prueba');
    expect(await actual).toBeNull();
    expect(localStorage.getItem(TOKEN)).toBeNull();
    expect(navegar).toHaveBeenCalledWith('/acceso');
  });
});

describe('pantallas en modo conectado (steward-acceso-onboarding, steward-ui-shell)', () => {
  let google: GoogleDePrueba;
  beforeEach(() => {
    google = new GoogleDePrueba();
    TestBed.configureTestingModule({ providers: provideConectadoPrueba(google) });
  });

  it('opciones aún no disponibles: Face ID y correo deshabilitados, Google lo dibuja GIS', async () => {
    const a = await app('/acceso');
    await responder('GET', '/api/auth/config', { googleClientId: 'cid-de-beauty' }, a.estable);
    expect(a.texto()).toContain('Próximamente');
    expect(a.porTexto('Entrar con Face ID').hasAttribute('disabled')).toBe(true);
    expect(a.porTexto('Continuar con correo').hasAttribute('disabled')).toBe(true);
    expect(google.clientId).toBe('cid-de-beauty');
    expect(google.botones).toBe(1);
  });

  it('sin acceso de desarrollo no aparece "Entrar como…"', async () => {
    const a = await app('/acceso');
    await responder('GET', '/api/auth/config', { googleClientId: 'cid-de-beauty', devLogin: false }, a.estable);
    expect(a.raiz().querySelector('[data-testid="dev-login"]')).toBeNull();
  });

  it('acceso de desarrollo: entra con correo y nombre, sin Google', async () => {
    const a = await app('/acceso');
    await responder('GET', '/api/auth/config', { googleClientId: null, devLogin: true }, a.estable);
    expect(a.raiz().querySelector('[data-testid="dev-login"]')).not.toBeNull();
    await a.escribir('Correo', 'esposa@ejemplo.com');
    await a.escribir('Nombre', 'Esposa');
    a.porTexto('Entrar como…').click();
    const login = await responder('POST', '/api/auth/dev', sesionApi({ token: 'jwt-dev', tieneHogar: false, hogarConfigurado: false }), a.estable);
    expect(login.request.body).toEqual({ email: 'esposa@ejemplo.com', nombre: 'Esposa' });
    await responder('GET', '/api/mis-invitaciones', [], a.estable);
    expect(a.url()).toBe('/acceso/face-id');
    expect(localStorage.getItem(TOKEN)).toBe('jwt-dev');
  });

  it('Google real, primera vez: crea la cuenta y abre Activar Face ID', async () => {
    const a = await app('/acceso');
    await responder('GET', '/api/auth/config', { googleClientId: 'cid-de-beauty' }, a.estable);
    google.elegirCuenta('credencial-1');
    const login = await responder('POST', '/api/auth/google', sesionApi({ token: 'jwt-nuevo', tieneHogar: false, hogarConfigurado: false }), a.estable);
    expect(login.request.body).toEqual({ idToken: 'credencial-1' });
    await responder('GET', '/api/mis-invitaciones', [], a.estable);
    expect(a.url()).toBe('/acceso/face-id');
    expect(localStorage.getItem(TOKEN)).toBe('jwt-nuevo');
  });

  const MIA = {
    id: 'inv-1',
    hogar: 'Jimenez Navarro',
    invitadoPor: { id: 'u-d', nombre: 'Daniel', email: 'srdejo@ejemplo.com', inicial: 'D' },
    miembros: [{ id: 'u-d', nombre: 'Daniel', email: 'srdejo@ejemplo.com', inicial: 'D' }],
    email: 'ana@ejemplo.com',
  };

  it('invitado que entra sin el enlace: abre la invitación y se une', async () => {
    const a = await app('/acceso');
    await responder('GET', '/api/auth/config', { googleClientId: null, devLogin: true }, a.estable);
    await a.escribir('Correo', 'ana@ejemplo.com');
    await a.escribir('Nombre', 'Ana María');
    a.porTexto('Entrar como…').click();
    await responder('POST', '/api/auth/dev', sesionApi({ token: 'jwt-ana', tieneHogar: false, hogarConfigurado: false }), a.estable);
    await responder('GET', '/api/mis-invitaciones', [MIA], a.estable);
    expect(a.url()).toBe('/invitacion/para-mi/inv-1');
    await responder('GET', '/api/mis-invitaciones', [MIA], a.estable);
    expect(a.texto()).toContain('Daniel te invitó a Jimenez Navarro');
    expect(a.porTexto('Prefiero crear mi hogar')).toBeTruthy();
    // El nombre viene de la cuenta: unirse sin escribirlo no se queda en "Escribe tu nombre".
    a.porTexto('Unirme al hogar').click();
    const aceptar = await responder('POST', '/api/mis-invitaciones/inv-1/aceptar', sesionApi(), a.estable);
    expect(aceptar.request.body).toEqual({ nombre: 'Ana María', diezmoAportes: false });
    expect(a.url()).toBe('/hoy');
  });

  it('onboarding paso 1 avisa de una invitación pendiente para su correo', async () => {
    conToken();
    const a = await app('/onboarding/1', async (estable) => {
      await responder('GET', '/api/sesion', sesionApi({ tieneHogar: false, hogarConfigurado: false }), estable);
    });
    await responder('GET', '/api/hogar', { codigo: 'SIN_HOGAR', mensaje: 'Todavía no tienes un hogar' }, a.estable, 404);
    await responder('GET', '/api/mis-invitaciones', [MIA], a.estable);
    const aviso = a.raiz().querySelector<HTMLAnchorElement>('[data-testid="invitacion-pendiente"]');
    expect(aviso?.textContent).toContain('Daniel te invitó a Jimenez Navarro');
    expect(aviso?.getAttribute('href')).toBe('/invitacion/para-mi/inv-1');
  });

  it('hogar creado en el backend en el paso 1', async () => {
    conToken();
    const a = await app('/onboarding/1', async (estable) => {
      await responder('GET', '/api/sesion', sesionApi({ tieneHogar: false, hogarConfigurado: false }), estable);
    });
    await responder('GET', '/api/hogar', { codigo: 'SIN_HOGAR', mensaje: 'Todavía no tienes un hogar' }, a.estable, 404);
    await responder('GET', '/api/mis-invitaciones', [], a.estable);
    expect(a.raiz().querySelector('[data-testid="invitacion-pendiente"]')).toBeNull();
    expect(a.campo('Tu nombre').value).toBe('Ana María');
    await a.escribir('Nombre del hogar', 'Nuestra casa');
    a.porTexto('Continuar').click();
    await responder('PATCH', '/api/perfil', USUARIO, a.estable);
    await responder('PATCH', '/api/hogar', { codigo: 'SIN_HOGAR', mensaje: 'Todavía no tienes un hogar' }, a.estable, 404);
    const crear = await responder('POST', '/api/hogar', hogarApi(), a.estable, 201);
    expect(crear.request.body).toEqual({ nombre: 'Nuestra casa' });
    expect(a.url()).toBe('/onboarding/2');
  });

  it('correo no enviado: la invitación queda pendiente y se avisa copiar el enlace', async () => {
    conToken();
    const a = await app('/onboarding/5', async (estable) => {
      await responder('GET', '/api/sesion', sesionApi({ hogarConfigurado: false }), estable);
    });
    await responder('GET', '/api/hogar', hogarApi(), a.estable);
    await a.escribir('#correo-invitacion', 'esposa@ejemplo.com');
    a.porTexto('Invitar').click();
    await responder('POST', '/api/hogar/invitaciones', {
      invitacion: { id: 'i-1', email: 'esposa@ejemplo.com', estado: 'PENDIENTE', enviadaEn: '2026-10-26T15:00:00Z', expiraEn: '2026-11-02T15:00:00Z' },
      enlace: 'http://steward.test/invitacion/tok-1',
      correoEnviado: false,
    }, a.estable, 201);
    expect(a.texto()).toContain('esposa@ejemplo.com');
    expect(a.texto()).toContain('No pudimos enviar el correo');
    expect(a.texto()).toContain('el anterior deja de servir');
  });

  it('enlace no válido', async () => {
    const a = await app('/invitacion/tok-usado');
    await responder('GET', '/api/invitaciones/tok-usado', { codigo: 'INVITACION_NO_VALIDA', mensaje: 'Esta invitación ya no es válida' }, a.estable, 404);
    expect(a.texto()).toContain('Esta invitación ya no es válida');
    expect(a.porTexto('Ir al acceso')).toBeTruthy();
  });

  it('unirse sin sesión: entra con Google, vuelve y queda unida', async () => {
    const recibida = { hogar: 'Nuestra casa', invitadoPor: { id: 'u-d', nombre: 'Daniel', email: 'd@ejemplo.com', inicial: 'D' }, miembros: [{ id: 'u-d', nombre: 'Daniel', email: 'd@ejemplo.com', inicial: 'D' }], email: 'ana@ejemplo.com' };
    const a = await app('/invitacion/tok-1');
    await responder('GET', '/api/invitaciones/tok-1', recibida, a.estable);
    await a.escribir('Tu nombre', 'Ana María');
    await a.tocar('Unirme al hogar');
    expect(decodeURIComponent(a.url())).toBe('/acceso?volver=/invitacion/tok-1');

    await responder('GET', '/api/auth/config', { googleClientId: 'cid-de-beauty' }, a.estable);
    google.elegirCuenta();
    await responder('POST', '/api/auth/google', sesionApi({ token: 'jwt-ana', tieneHogar: false, hogarConfigurado: false }), a.estable);
    expect(a.url()).toBe('/invitacion/tok-1');
    await responder('GET', '/api/invitaciones/tok-1', recibida, a.estable);
    const aceptar = await responder('POST', '/api/invitaciones/tok-1/aceptar', sesionApi(), a.estable);
    expect(aceptar.request.body).toEqual({ nombre: 'Ana María', diezmoAportes: false });
    expect(a.url()).toBe('/hoy');
  });

  it('modo conectado en Ajustes: hogar real, aviso de datos de prueba y sin "Probar desde cero"', async () => {
    conToken();
    const a = await app('/ajustes', async (estable) => {
      await responder('GET', '/api/sesion', sesionApi(), estable);
    });
    for (let i = 0; i < 3; i++) {
      const pendientes = http().match((r) => r.method === 'GET' && r.url === '/api/hogar');
      pendientes.forEach((r) => r.flush(hogarApi({ configurado: true })));
      await a.estable();
    }
    expect(a.texto()).toContain('Nuestra casa');
    expect(a.texto()).toContain('Ana María');
    expect(a.texto()).toContain('Datos de prueba');
    expect(a.texto()).toContain('Restablecer datos de prueba');
    expect(a.texto()).not.toContain('Probar desde cero');
  });
});
