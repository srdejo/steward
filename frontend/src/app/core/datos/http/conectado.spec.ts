import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReglaError, type Puertos } from '@steward/domain';

import { GoogleDePrueba, USUARIO, finanzasPrueba, finanzasVacias, hogarApi, http, provideConectadoPrueba, responder } from '../../../../testing/conectado';
import { CLAVE_ESTADO } from '@steward/domain/demo';
import type { FinanzasApi, MovimientoApi } from './api';
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

// --- Finanzas en el backend (backend-ingresos-diezmo, design D5) --------------------------------------------------

const OCT = { anio: 2026, mes: 10 };
const SALARIO = { id: 'ing-1', usuarioId: USUARIO.id, nombre: 'Salario Ana', bruto: 7_000_000, neto: 6_288_000, diaPago: 25, cuentaId: null, activo: true };
const REGLA = { usuarioId: USUARIO.id, activa: true, porcentaje: 10, base: 'BRUTO' as const, aplicaAportes: false };
const RECIBIDO: MovimientoApi = {
  id: 'mov-1', tipo: 'INGRESO_FIJO', ref: OCT, monto: 6_288_000, fecha: '2026-10-26', usuarioId: USUARIO.id, creadoPor: USUARIO.id,
  cuentaId: null, ingresoFijoId: 'ing-1', bruto: 7_000_000, aplicaDiezmo: true, diezmoDe: [],
};

function finanzas(extra: Partial<FinanzasApi> = {}): FinanzasApi {
  return { ...finanzasVacias(), ingresosFijos: [SALARIO], reglas: [REGLA], ...extra };
}

describe('finanzas en el backend (steward-finanzas, design D5)', () => {
  let p: Puertos;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideConectadoPrueba() });
    p = TestBed.inject(PUERTOS);
    conToken();
    finanzasPrueba.valor = finanzas();
    const sesion = p.sesion.actual();
    await responder('GET', '/api/sesion', sesionApi(), tick);
    await sesion;
  });
  afterEach(() => http().verify());

  it('ingresos y regla vienen del backend y se superponen sin guardarse en el dispositivo', async () => {
    expect((await p.ingresos.fijos()).map((f) => f.nombre)).toEqual(['Salario Ana']);
    expect(await p.ingresos.regla()).toMatchObject({ porcentaje: 10, base: 'BRUTO' });
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.ingresos.find((l) => l.nombre === 'Salario Ana')).toMatchObject({ detalle: 'Fijo · llega el día 25', recibido: false });
    // El salario de prueba ya no esta: los ingresos fijos son los reales.
    expect(r.ingresos.some((l) => l.nombre === 'Salario Daniel')).toBe(false);
    await p.movimientos.registrarGasto({ monto: 1_000, itemId: null, nota: 'Pan', usuarioId: USUARIO.id, origen: { tipo: 'NINGUNO' }, ref: OCT });
    expect(localStorage.getItem(CLAVE_ESTADO) ?? '').not.toContain('Salario Ana');
  });

  it('Recibí genera el diezmo y Entregado lo cierra, en el backend', async () => {
    const recibir = p.ingresos.marcarRecibido('ing-1', OCT);
    finanzasPrueba.valor = finanzas({ movimientos: [RECIBIDO] });
    await responder('POST', '/api/ingresos-fijos/ing-1/recibido', RECIBIDO, tick, 201);
    await recibir;
    const pendientes = (await p.movimientos.resumenMes(OCT)).diezmo.pendientes;
    expect(pendientes).toEqual([expect.objectContaining({ id: 'mov-1', monto: 700_000, detalle: '10% de Salario Ana · recibido 26 oct' })]);

    const entregar = p.ingresos.entregarDiezmo(['mov-1'], OCT, null);
    const entrega: MovimientoApi = { ...RECIBIDO, id: 'mov-2', tipo: 'DIEZMO_ENTREGADO', monto: 700_000, ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: ['mov-1'] };
    finanzasPrueba.valor = finanzas({ movimientos: [RECIBIDO, entrega] });
    const req = await responder('POST', '/api/diezmo/entregas', entrega, tick, 201);
    await entregar;
    expect(req.request.body).toEqual({ obligaciones: ['mov-1'], cuentaId: null });
    expect((await p.movimientos.resumenMes(OCT)).diezmo.pendientes).toHaveLength(0);
  });

  it('YA_RECIBIDO: llega el mensaje y el ingreso queda como recibido', async () => {
    // Se captura ya: el rechazo llega antes de que el test lo espere.
    const recibir = p.ingresos.marcarRecibido('ing-1', OCT).catch((e: unknown) => e);
    finanzasPrueba.valor = finanzas({ movimientos: [RECIBIDO] });
    await responder('POST', '/api/ingresos-fijos/ing-1/recibido', { codigo: 'YA_RECIBIDO', mensaje: 'Ese ingreso ya se marcó como recibido este mes' }, tick, 409);
    expect(await recibir).toMatchObject({ codigo: 'YA_RECIBIDO' });
    const linea = (await p.movimientos.resumenMes(OCT)).ingresos.find((l) => l.nombre === 'Salario Ana');
    expect(linea?.recibido).toBe(true);
  });

  it('guardar regla e ingresos: crear, editar y quitar', async () => {
    const regla = p.ingresos.guardarRegla({ activa: true, porcentaje: 12.5, base: 'NETO', aplicaAportes: true });
    const r1 = await responder('PUT', '/api/regla-diezmo', { ...REGLA, porcentaje: 12.5 }, tick);
    await regla;
    expect(r1.request.body).toEqual({ activa: true, porcentaje: 12.5, base: 'NETO', aplicaAportes: true });

    const crear = p.ingresos.guardarFijo({ nombre: 'Prima', bruto: 1_000_000, neto: 1_000_000, diaPago: 30, cuentaId: null });
    const r2 = await responder('POST', '/api/ingresos-fijos', { ...SALARIO, id: 'ing-2' }, tick, 201);
    await crear;
    expect(r2.request.body).toEqual({ nombre: 'Prima', bruto: 1_000_000, neto: 1_000_000, diaPago: 30, cuentaId: null });

    const editar = p.ingresos.guardarFijo({ id: 'ing-1', nombre: 'Salario Ana', bruto: 7_000_000, neto: 6_500_000, diaPago: 25, cuentaId: null });
    const r3 = await responder('PUT', '/api/ingresos-fijos/ing-1', SALARIO, tick);
    await editar;
    expect(r3.request.body).toMatchObject({ neto: 6_500_000 });

    const quitar = p.ingresos.quitarFijo('ing-1');
    await responder('DELETE', '/api/ingresos-fijos/ing-1', null, tick, 204);
    await quitar;
  });

  it('cuentas: agregar a mi nombre o conjunta; cuadrar y mover todavía no', async () => {
    const mia = p.cuentas.agregar({ nombre: 'Nu', titularId: USUARIO.id, saldo: 300_000 });
    finanzasPrueba.valor = finanzas({ cuentas: [{ id: 'cta-1', nombre: 'Nu', titularId: USUARIO.id, saldoCuadre: 300_000, fechaCuadre: '2026-10-26', cuadrada: false }] });
    const req = await responder('POST', '/api/cuentas', { id: 'cta-1' }, tick, 201);
    await mia;
    expect(req.request.body).toEqual({ nombre: 'Nu', titular: 'YO', saldo: 300_000 });
    const { cuentas } = await p.cuentas.cuentas();
    expect(cuentas.map((c) => [c.cuenta.nombre, c.titular, c.saldo])).toEqual([['Nu', 'Ana María', 300_000]]);

    const conjunta = p.cuentas.agregar({ nombre: 'Efectivo', titularId: null, saldo: 200_000 });
    const req2 = await responder('POST', '/api/cuentas', { id: 'cta-2' }, tick, 201);
    await conjunta;
    expect(req2.request.body).toMatchObject({ titular: 'CONJUNTA' });

    await expect(p.cuentas.agregar({ nombre: 'Ajena', titularId: 'otro', saldo: 1 })).rejects.toMatchObject({ codigo: 'SOLO_TUYAS' });
    await expect(p.cuentas.cuadrar([{ cuentaId: 'cta-1', saldoBanco: 1 }])).rejects.toMatchObject({ codigo: 'ETAPA_5' });
    await expect(p.cuentas.mover({ desde: 'cta-1', hacia: 'cta-2', monto: 1 })).rejects.toMatchObject({ codigo: 'ETAPA_5' });
  });

  it('restablecer los datos de prueba no toca los reales (steward-ui-shell)', async () => {
    await p.demo!.restablecer();
    expect((await p.ingresos.fijos()).map((f) => f.nombre)).toEqual(['Salario Ana']);
    expect(await p.ingresos.regla()).toMatchObject({ porcentaje: 10 });
  });

  it('los aportes siguen en el dispositivo (Etapa 4) y Diezmo en Hoy va al backend', async () => {
    await p.ingresos.registrarAporte({ usuarioId: USUARIO.id, monto: 500_000, ref: OCT, cuentaId: null, aplicaDiezmo: false });
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.ingresos.find((l) => l.tipo === 'APORTES' && l.usuarioId === USUARIO.id)?.monto).toBe(500_000);

    const agrupar = p.hogar.definirDiezmoEnHoy('AGRUPADO');
    finanzasPrueba.valor = finanzas({ diezmoEnHoy: 'AGRUPADO' });
    const req = await responder('PUT', '/api/hogar/diezmo-en-hoy', null, tick, 204);
    await agrupar;
    expect(req.request.body).toEqual({ modo: 'AGRUPADO' });
  });
});

describe('pantallas con finanzas reales (backend-ingresos-diezmo)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideConectadoPrueba() }));
  afterEach(() => http().verify());

  /** Responde las lecturas del hogar que las pantallas piden al recargarse. */
  async function atenderHogar(a: Awaited<ReturnType<typeof app>>, hogar = hogarApi({ configurado: true })): Promise<void> {
    for (let i = 0; i < 4; i++) {
      http().match((r) => r.method === 'GET' && r.url === '/api/hogar').forEach((r) => r.flush(hogar));
      await a.estable();
    }
  }

  async function entrarA(ruta: string, sesion = sesionApi()) {
    conToken();
    const a = await app(ruta, async (estable) => {
      await responder('GET', '/api/sesion', sesion, estable);
    });
    await atenderHogar(a, hogarApi({ configurado: sesion.hogarConfigurado }));
    return a;
  }

  it('onboarding: pasos 2 a 4 en el backend, y volver al paso 3 edita en lugar de duplicar', async () => {
    const a = await entrarA('/onboarding/2', sesionApi({ hogarConfigurado: false }));
    // Paso 2: diezmo 10 % del bruto (lo que viene marcado).
    a.porTexto('Continuar').click();
    finanzasPrueba.valor = finanzas({ ingresosFijos: [] });
    const regla = await responder('PUT', '/api/regla-diezmo', REGLA, a.estable);
    expect(regla.request.body).toEqual({ activa: true, porcentaje: 10, base: 'BRUTO', aplicaAportes: true });
    expect(a.url()).toBe('/onboarding/3');

    // Paso 3: el salario.
    await a.escribir('NOMBRE', 'Salario Ana');
    await a.escribir('BRUTO', '7000000');
    await a.escribir('ENTRA (NETO)', '6288000');
    await a.escribir('DÍA DE PAGO', '25');
    expect(a.raiz().querySelector('[data-testid="vista-previa-diezmo"]')?.textContent).toContain('$700.000');
    a.porTexto('Continuar').click();
    finanzasPrueba.valor = finanzas();
    const crear = await responder('POST', '/api/ingresos-fijos', SALARIO, a.estable, 201);
    expect(crear.request.body).toEqual({ nombre: 'Salario Ana', bruto: 7_000_000, neto: 6_288_000, diaPago: 25, cuentaId: null });
    expect(a.url()).toBe('/onboarding/4');

    // Volver al 3 y cambiar el neto: PUT del mismo ingreso.
    await a.tocar('Atrás');
    expect(a.url()).toBe('/onboarding/3');
    await a.escribir('ENTRA (NETO)', '6500000');
    a.porTexto('Continuar').click();
    finanzasPrueba.valor = finanzas({ ingresosFijos: [{ ...SALARIO, neto: 6_500_000 }] });
    const editar = await responder('PUT', '/api/ingresos-fijos/ing-1', { ...SALARIO, neto: 6_500_000 }, a.estable);
    expect(editar.request.body).toMatchObject({ neto: 6_500_000 });
    expect(http().match((r) => r.method === 'POST' && r.url === '/api/ingresos-fijos')).toHaveLength(0);

    // Paso 4: una cuenta a su nombre.
    await a.escribir('Saldo Davivienda', '4000000');
    a.porTexto('Continuar').click();
    const cuenta = await responder('POST', '/api/cuentas', { id: 'cta-1' }, a.estable, 201);
    expect(cuenta.request.body).toEqual({ nombre: 'Davivienda', titular: 'YO', saldo: 4_000_000 });
    expect(a.url()).toBe('/onboarding/5');
  });

  it('Hoy: Recibí muestra el diezmo real y Entregado lo quita', async () => {
    finanzasPrueba.valor = finanzas();
    const a = await entrarA('/hoy');
    expect(a.texto()).toContain('Salario Ana');
    a.porTexto('Recibí').click();
    finanzasPrueba.valor = finanzas({ movimientos: [RECIBIDO] });
    await responder('POST', '/api/ingresos-fijos/ing-1/recibido', RECIBIDO, a.estable, 201);
    await atenderHogar(a);
    const tarjeta = a.raiz().querySelector('[data-testid="tarjeta-diezmo"]');
    expect(tarjeta?.textContent).toContain('$700.000');
    expect(tarjeta?.textContent).toContain('10% de Salario Ana');

    a.porTexto('Entregado').click();
    const entrega: MovimientoApi = { ...RECIBIDO, id: 'mov-2', tipo: 'DIEZMO_ENTREGADO', monto: 700_000, ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: ['mov-1'] };
    finanzasPrueba.valor = finanzas({ movimientos: [RECIBIDO, entrega] });
    await responder('POST', '/api/diezmo/entregas', entrega, a.estable, 201);
    await atenderHogar(a);
    expect([...a.raiz().querySelectorAll('[data-testid="tarjeta-diezmo"]')].some((t) => t.textContent?.includes('Salario Ana'))).toBe(false);
  });

  it('Hoy: si ya estaba recibido, muestra el mensaje y el ingreso queda recibido', async () => {
    finanzasPrueba.valor = finanzas();
    const a = await entrarA('/hoy');
    a.porTexto('Recibí').click();
    finanzasPrueba.valor = finanzas({ movimientos: [RECIBIDO] });
    await responder('POST', '/api/ingresos-fijos/ing-1/recibido', { codigo: 'YA_RECIBIDO', mensaje: 'Ese ingreso ya se marcó como recibido este mes' }, a.estable, 409);
    await atenderHogar(a);
    expect(a.texto()).toContain('Ese ingreso ya se marcó como recibido este mes');
    expect(a.texto()).toContain('Fijo · recibido 26 oct');
  });

  it('Ajustes: editar el salario y agregar un ingreso van al backend', async () => {
    finanzasPrueba.valor = finanzas();
    const a = await entrarA('/ajustes');
    await a.tocar(/Salario Ana/);
    await a.escribir('Entra (neto)', '6500000');
    a.porTexto('Guardar').click();
    finanzasPrueba.valor = finanzas({ ingresosFijos: [{ ...SALARIO, neto: 6_500_000 }] });
    const editar = await responder('PUT', '/api/ingresos-fijos/ing-1', SALARIO, a.estable);
    expect(editar.request.body).toMatchObject({ neto: 6_500_000 });
    await atenderHogar(a);
    expect(a.texto()).toContain('$6.500.000');

    await a.tocar('+ Agregar ingreso fijo');
    await a.escribir('Nombre', 'Prima');
    await a.escribir('Entra (neto)', '1000000');
    a.porTexto('Agregar ingreso').click();
    const crear = await responder('POST', '/api/ingresos-fijos', { ...SALARIO, id: 'ing-2', nombre: 'Prima' }, a.estable, 201);
    expect(crear.request.body).toMatchObject({ nombre: 'Prima', neto: 1_000_000, bruto: 1_000_000 });
    await atenderHogar(a);
  });

  it('Cuentas: las reales, y cuadrar y mover avisan que llegan después', async () => {
    finanzasPrueba.valor = finanzas({ cuentas: [{ id: 'cta-1', nombre: 'Nu', titularId: USUARIO.id, saldoCuadre: 300_000, fechaCuadre: '2026-10-26', cuadrada: false }] });
    const a = await entrarA('/cuentas');
    expect(a.raiz().querySelector('[data-cuenta="Nu"]')?.textContent).toContain('Ana María');
    expect(a.raiz().querySelector('[data-cuenta="Davivienda"]')).toBeNull();
    await a.tocar('Cuadrar cuentas');
    expect(a.url()).toBe('/cuentas');
    expect(a.texto()).toContain('llegan en una próxima versión');
  });
});
