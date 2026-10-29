import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReglaError, type Puertos } from '@steward/domain';

import { GoogleDePrueba, USUARIO, finanzasPrueba, finanzasVacias, hogarApi, http, provideConectadoPrueba, responder } from '../../../../testing/conectado';
import { CLAVE_ESTADO } from '@steward/domain/demo';
import type { FinanzasApi, MovimientoApi, PlanApi } from './api';
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
  cuentaId: null, ingresoFijoId: 'ing-1', bruto: 7_000_000, aplicaDiezmo: true, diezmoDe: [], itemId: null, nota: '', origen: 'NINGUNO',
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
    // Lo de prueba que se guarda (aqui, Restablecer) no lleva lo real.
    await p.demo!.restablecer();
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

  it('los aportes y Diezmo en Hoy van al backend (Etapa 4)', async () => {
    const aportar = p.ingresos.registrarAporte({ usuarioId: USUARIO.id, monto: 500_000, ref: OCT, cuentaId: null, aplicaDiezmo: false });
    const aporte: MovimientoApi = { ...RECIBIDO, id: 'mov-a', tipo: 'APORTE', monto: 500_000, ingresoFijoId: null, bruto: null, aplicaDiezmo: false };
    finanzasPrueba.valor = finanzas({ movimientos: [aporte] });
    const reqAporte = await responder('POST', '/api/aportes', aporte, tick, 201);
    await aportar;
    expect(reqAporte.request.body).toEqual({ usuarioId: USUARIO.id, monto: 500_000, mes: OCT, cuentaId: null, aplicaDiezmo: false });
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.ingresos.find((l) => l.tipo === 'APORTES' && l.usuarioId === USUARIO.id)?.monto).toBe(500_000);

    const agrupar = p.hogar.definirDiezmoEnHoy('AGRUPADO');
    finanzasPrueba.valor = finanzas({ diezmoEnHoy: 'AGRUPADO' });
    const req = await responder('PUT', '/api/hogar/diezmo-en-hoy', null, tick, 204);
    await agrupar;
    expect(req.request.body).toEqual({ modo: 'AGRUPADO' });
  });
});

// --- Plan del mes y registros de Hoy en el backend (backend-plan-mes-hoy, design D5) -----------------------------

const PLAN_OCT: PlanApi = {
  id: 'plan-oct', ref: OCT, estado: 'ACTIVO', escenarioActivoId: 'esc-a',
  escenarios: [{
    id: 'esc-a', letra: 'A', creadoPor: USUARIO.id, nota: '', archivado: false,
    items: [
      { id: 'it-internet', categoriaId: 'cat-1', nombre: 'Internet', monto: 120_000, diaVence: 28, tipo: 'FIJO', cuota: null },
      { id: 'it-mercado', categoriaId: 'cat-3', nombre: 'Mercado', monto: 320_000, diaVence: null, tipo: 'VARIABLE', cuota: null },
    ],
  }],
};

function registro(extra: Partial<MovimientoApi>): MovimientoApi {
  return { ...RECIBIDO, id: 'mov-x', tipo: 'GASTO', monto: 0, ingresoFijoId: null, bruto: null, aplicaDiezmo: false, ...extra };
}

describe('plan del mes y registros en el backend (steward-plan-mes, design D5)', () => {
  let p: Puertos;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideConectadoPrueba() });
    p = TestBed.inject(PUERTOS);
    conToken();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT] });
    const sesion = p.sesion.actual();
    await responder('GET', '/api/sesion', sesionApi(), tick);
    await sesion;
  });
  afterEach(() => http().verify());

  it('el plan real reemplaza al de prueba y lo registrado de prueba no se ve', async () => {
    const r = await p.movimientos.resumenMes(OCT);
    expect([...r.porPagar, ...r.yaPagado].map((i) => i.item.nombre).sort()).toEqual(['Internet', 'Mercado']);
    expect(r.plan).toBe(440_000 + 700_000); // los items + el diezmo calculado del salario
    expect(r.noPlaneados).toHaveLength(0);
    expect((await p.hogar.categorias()).map((c) => c.nombre)).toEqual(['Gastos fijos', 'Tarjetas y cuotas', 'Variables', 'Créditos']);
    expect(await p.cierre.vista(OCT)).toMatchObject({ cerrado: false });
  });

  it('el aporte de otro miembro lleva su nombre en cuanto se lee el hogar', async () => {
    const otro = { id: 'u-esposa', nombre: 'Esposa', email: 'esposa@ejemplo.com', inicial: 'E' };
    // Las finanzas ya traen el aporte de Esposa (las releyo, por ejemplo, el registro de un pago).
    const pagar = p.movimientos.marcarPago({ itemId: 'it-internet', ref: OCT, monto: 120_000, usuarioId: USUARIO.id, origen: { tipo: 'NINGUNO' } });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [registro({ id: 'mov-a', tipo: 'APORTE', monto: 500_000, usuarioId: otro.id })] });
    await responder('POST', '/api/pagos', registro({}), tick, 201);
    await pagar;
    const aviso = vi.fn();
    p.suscribir(aviso);

    const vista = p.hogar.obtener();
    await responder('GET', '/api/hogar', { ...hogarApi(), miembros: [...hogarApi().miembros, { usuario: otro, unidoEn: '2026-10-27', esActual: false }] }, tick);
    await vista;
    expect(aviso).toHaveBeenCalled();
    expect((await p.movimientos.resumenMes(OCT)).ingresos.find((l) => l.tipo === 'APORTES')?.nombre).toBe('Aportes Esposa');
  });

  it('un pago desde "Su cuenta" cuenta como aporte de quien pagó', async () => {
    const pagar = p.movimientos.marcarPago({ itemId: 'it-internet', ref: OCT, monto: 100_000, usuarioId: USUARIO.id, origen: { tipo: 'EXTERNA' } });
    const pago = registro({ id: 'mov-p', tipo: 'PAGO', monto: 100_000, itemId: 'it-internet', origen: 'EXTERNA' });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [pago] });
    const req = await responder('POST', '/api/pagos', pago, tick, 201);
    await pagar;
    expect(req.request.body).toEqual({ itemId: 'it-internet', monto: 100_000, usuarioId: USUARIO.id, origen: { tipo: 'EXTERNA' } });
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.yaPagado.map((i) => i.item.nombre)).toEqual(['Internet']);
    expect(r.vsPlan).toBe(-20_000);
    expect(r.ingresos.find((l) => l.tipo === 'APORTES')).toMatchObject({ monto: 100_000, detalle: '1 pago directo' });
    expect(localStorage.getItem(CLAVE_ESTADO) ?? '').not.toContain('it-internet');
  });

  it('YA_PAGADO: relee y propaga el mensaje con quién pagó', async () => {
    const pagar = p.movimientos.marcarPago({ itemId: 'it-internet', ref: OCT, monto: 120_000, usuarioId: USUARIO.id, origen: { tipo: 'NINGUNO' } })
      .catch((e: unknown) => e);
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [registro({ tipo: 'PAGO', monto: 120_000, itemId: 'it-internet', usuarioId: 'u-otro' })] });
    await responder('POST', '/api/pagos', { codigo: 'YA_PAGADO', mensaje: 'Ya lo pagó Esposa el 26 oct' }, tick, 409);
    expect(await pagar).toMatchObject({ codigo: 'YA_PAGADO', message: 'Ya lo pagó Esposa el 26 oct' });
    expect((await p.movimientos.resumenMes(OCT)).yaPagado.map((i) => i.item.nombre)).toEqual(['Internet']);
  });

  it('gasto no planeado, con su origen y nota', async () => {
    const gastar = p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: 'Farmacia', usuarioId: USUARIO.id, origen: { tipo: 'CUENTA', cuentaId: 'cta-1' }, ref: OCT });
    const req = await responder('POST', '/api/gastos', registro({ monto: 85_000, nota: 'Farmacia' }), tick, 201);
    await gastar;
    expect(req.request.body).toEqual({ itemId: null, monto: 85_000, nota: 'Farmacia', usuarioId: USUARIO.id, origen: { tipo: 'CUENTA', cuentaId: 'cta-1' } });
  });

  it('crear el mes, editar la Opción A, usarla, y las categorías', async () => {
    const crear = p.plan.crearMes({ anio: 2026, mes: 11 }, 'COPIAR');
    const r1 = await responder('POST', '/api/planes', PLAN_OCT, tick, 201);
    await crear;
    expect(r1.request.body).toEqual({ anio: 2026, mes: 11, modo: 'COPIAR' });

    const item = { categoriaId: 'cat-1', nombre: 'Luz', monto: 50_000, diaVence: 10, tipo: 'FIJO' as const, cuota: null, creditoId: null };
    const agregar = p.plan.guardarItem('plan-oct', 'esc-a', item);
    const r2 = await responder('POST', '/api/planes/plan-oct/escenarios/esc-a/items', { ...item, id: 'it-luz' }, tick, 201);
    await agregar;
    expect(r2.request.body).toEqual({ categoriaId: 'cat-1', nombre: 'Luz', monto: 50_000, diaVence: 10, tipo: 'FIJO', cuota: null });

    const editar = p.plan.guardarItem('plan-oct', 'esc-a', { ...item, id: 'it-luz', monto: 60_000 });
    await responder('PUT', '/api/planes/plan-oct/escenarios/esc-a/items/it-luz', item, tick);
    await editar;
    const quitar = p.plan.quitarItem('plan-oct', 'esc-a', 'it-luz');
    await responder('DELETE', '/api/planes/plan-oct/escenarios/esc-a/items/it-luz', null, tick, 204);
    await quitar;
    const usar = p.plan.usar('plan-oct', 'esc-a');
    const r3 = await responder('POST', '/api/planes/plan-oct/usar', PLAN_OCT, tick);
    await usar;
    expect(r3.request.body).toEqual({ escenarioId: 'esc-a' });

    const nueva = p.hogar.guardarCategoria({ nombre: 'Educación' });
    await responder('POST', '/api/categorias', { id: 'cat-5' }, tick, 201);
    await nueva;
    const renombrar = p.hogar.guardarCategoria({ id: 'cat-5', nombre: 'Colegio' });
    const r4 = await responder('PATCH', '/api/categorias/cat-5', { id: 'cat-5' }, tick);
    await renombrar;
    expect(r4.request.body).toEqual({ nombre: 'Colegio' });
  });

  it('lo que llega en otras etapas avisa sin cambiar nada', async () => {
    await expect(p.plan.duplicar('plan-oct', 'esc-a')).rejects.toMatchObject({ codigo: 'ETAPA_7' });
    await expect(p.plan.crearMesesDesdeAnual(2027)).rejects.toMatchObject({ codigo: 'ETAPA_8' });
    await expect(p.cierre.cerrar(OCT, { aAhorro: 0, aSiguiente: 0 })).rejects.toMatchObject({ codigo: 'ETAPA_6' });
    await expect(p.cuentas.probarComoOpcion('cred-1', { anio: 2026, mes: 11 }, 1)).rejects.toMatchObject({ codigo: 'ETAPA_7' });
    expect((await p.plan.mes(OCT)).opciones).toHaveLength(1);
  });

  it('el diezmo de un aporte se entrega en el backend, junto con el del salario', async () => {
    // Ya no hay obligaciones de prueba: todas van al backend en una sola entrega.
    const entregar = p.ingresos.entregarDiezmo(['mov-1', 'mov-a'], OCT, null);
    const req = await responder('POST', '/api/diezmo/entregas', registro({ tipo: 'DIEZMO_ENTREGADO' }), tick, 201);
    await entregar;
    expect(req.request.body).toEqual({ obligaciones: ['mov-1', 'mov-a'], cuentaId: null });
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

describe('pantallas con el plan real (backend-plan-mes-hoy)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideConectadoPrueba() }));
  afterEach(() => http().verify());

  async function atenderHogar(a: Awaited<ReturnType<typeof app>>): Promise<void> {
    for (let i = 0; i < 4; i++) {
      http().match((r) => r.method === 'GET' && r.url === '/api/hogar').forEach((r) => r.flush(hogarApi({ configurado: true })));
      http().match((r) => r.method === 'GET' && r.url === '/api/sesion').forEach((r) => r.flush(sesionApi()));
      await a.estable();
    }
  }

  async function entrarA(ruta: string) {
    conToken();
    const a = await app(ruta, async (estable) => {
      await responder('GET', '/api/sesion', sesionApi(), estable);
    });
    await atenderHogar(a);
    return a;
  }

  it('avisos: Duplicar, Comparar, Cerrar, Crear meses y Probarlo como opción', async () => {
    finanzasPrueba.valor = finanzas({ planes: [{ ...PLAN_OCT, estado: 'BORRADOR', escenarioActivoId: null }] });
    const a = await entrarA('/planear/2026-10');
    await a.tocar('+ Duplicar');
    expect(a.texto()).toContain('Varias opciones por mes llegan en una próxima versión.');

    await a.ir('/planear/2026-10/comparar');
    await atenderHogar(a);
    expect(a.texto()).toContain('Comparar varias opciones llega en una próxima versión');

    await a.ir('/planear/2026-10/cierre');
    await atenderHogar(a);
    await a.tocar('Cerrar octubre');
    expect(a.texto()).toContain('Cerrar el mes llega en una próxima versión.');

    await a.ir('/planear/anual/2027');
    await atenderHogar(a);
    await a.tocar('Crear meses desde este plan');
    expect(a.texto()).toContain('Crear los meses desde el plan anual llega en una próxima versión.');

    await a.ir('/cuentas/credito/cred-libre');
    await atenderHogar(a);
    await a.escribir('Abono', '2000000');
    await a.tocar(/Probarlo como opción/);
    expect(a.texto()).toContain('Probar un abono como opción llega en una próxima versión.');
  });

  it('Hoy sin plan → Mes sin plan → Desde cero → agregar un gasto → Usar opción A', async () => {
    finanzasPrueba.valor = finanzas();
    const a = await entrarA('/hoy');
    expect(a.texto()).toContain('Este mes no tiene plan');
    await a.tocar(/^Planear octubre/i);
    await atenderHogar(a);
    expect(a.url()).toBe('/planear/2026-10');

    a.porTexto(/Empezar desde cero/).click();
    const vacio: PlanApi = { ...PLAN_OCT, estado: 'BORRADOR', escenarioActivoId: null, escenarios: [{ ...PLAN_OCT.escenarios[0]!, items: [] }] };
    finanzasPrueba.valor = finanzas({ planes: [vacio] });
    const crear = await responder('POST', '/api/planes', vacio, a.estable, 201);
    expect(crear.request.body).toEqual({ anio: 2026, mes: 10, modo: 'CERO' });
    await atenderHogar(a);

    await a.escribir('Nombre del gasto', 'Internet');
    a.porTexto('+ Agregar').click();
    finanzasPrueba.valor = finanzas({ planes: [{ ...vacio, escenarios: [{ ...vacio.escenarios[0]!, items: [{ ...PLAN_OCT.escenarios[0]!.items[0]!, monto: 0 }] }] }] });
    const item = await responder('POST', '/api/planes/plan-oct/escenarios/esc-a/items', { id: 'it-internet' }, a.estable, 201);
    expect(item.request.body).toMatchObject({ categoriaId: 'cat-1', nombre: 'Internet', monto: 0, tipo: 'FIJO' });
    await atenderHogar(a);

    a.porTexto('Usar opción A').click();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT] });
    const usar = await responder('POST', '/api/planes/plan-oct/usar', PLAN_OCT, a.estable);
    expect(usar.request.body).toEqual({ escenarioId: 'esc-a' });
    await atenderHogar(a);
    expect(a.url()).toBe('/planear');
  });

  it('criterio de cierre: pago bajo el plan, aporte y gasto no planeado cuadran en Hoy', async () => {
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT] });
    const a = await entrarA('/hoy');
    const libre = () => a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim();
    // Ingresos $6.288.000 (salario por recibir); comprometido: Internet $120.000 + Mercado $320.000 + diezmo $700.000.
    expect(libre()).toBe('$5.148.000');

    // Daniel paga Internet por $100.000 (plan $120.000) desde la hoja de pago.
    await a.ir('/hoy/pagar/it-internet');
    await atenderHogar(a);
    await a.escribir('Valor pagado', '100000');
    a.porTexto('Marcar pagado').click();
    const pago = registro({ id: 'mov-p', tipo: 'PAGO', monto: 100_000, itemId: 'it-internet', origen: 'NINGUNO' });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [pago] });
    await responder('POST', '/api/pagos', pago, a.estable, 201);
    await atenderHogar(a);

    // Un aporte de $500.000 y un gasto no planeado de $85.000.
    const p = TestBed.inject(PUERTOS);
    const aporte = registro({ id: 'mov-a', tipo: 'APORTE', monto: 500_000 });
    const aportar = p.ingresos.registrarAporte({ usuarioId: USUARIO.id, monto: 500_000, ref: OCT, cuentaId: null, aplicaDiezmo: false });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [pago, aporte] });
    await responder('POST', '/api/aportes', aporte, a.estable, 201);
    await aportar;
    const gasto = registro({ id: 'mov-g', tipo: 'GASTO', monto: 85_000, nota: 'Farmacia' });
    const gastar = p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: 'Farmacia', usuarioId: USUARIO.id, origen: { tipo: 'NINGUNO' }, ref: OCT });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [pago, aporte, gasto] });
    await responder('POST', '/api/gastos', gasto, a.estable, 201);
    await gastar;

    await a.ir('/hoy');
    await atenderHogar(a);
    // Vs. plan: −$20.000 por Internet y +$85.000 por el gasto; libre: +$500.000 del aporte y −$85.000 del gasto.
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.vsPlan).toBe(65_000);
    expect(libre()).toBe('$5.563.000');
  });

  it('lo pagó el otro miembro hace un momento: aviso e Internet en Ya pagado', async () => {
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT] });
    const a = await entrarA('/hoy/pagar/it-internet');
    a.porTexto('Marcar pagado').click();
    // El otro miembro (aqui, la misma cuenta desde otro dispositivo) lo pago el 26 oct.
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [registro({ tipo: 'PAGO', monto: 120_000, itemId: 'it-internet' })] });
    await responder('POST', '/api/pagos', { codigo: 'YA_PAGADO', mensaje: 'Ya lo pagó Ana María el 26 oct' }, a.estable, 409);
    await atenderHogar(a);
    expect(a.raiz().querySelector('[data-testid="ya-pagado"]')?.textContent).toContain('Ya lo pagó Ana María el 26 oct');
    const r = await TestBed.inject(PUERTOS).movimientos.resumenMes(OCT);
    expect(r.yaPagado.map((i) => i.item.nombre)).toEqual(['Internet']);
  });

  it('una categoría nueva queda disponible al agregar un gasto', async () => {
    finanzasPrueba.valor = finanzas({ planes: [{ ...PLAN_OCT, estado: 'BORRADOR', escenarioActivoId: null }] });
    const a = await entrarA('/ajustes');
    await a.tocar('+ Nueva');
    await a.escribir('Nombre', 'Educación');
    a.porTexto('Crear categoría').click();
    finanzasPrueba.valor = { ...finanzasPrueba.valor, categorias: [...finanzasPrueba.valor.categorias, { id: 'cat-5', nombre: 'Educación', color: '#8D8F88', orden: 5, tipo: 'OTRO', sistema: false }] };
    const req = await responder('POST', '/api/categorias', { id: 'cat-5' }, a.estable, 201);
    expect(req.request.body).toEqual({ nombre: 'Educación' });
    await a.ir('/planear/2026-10');
    await atenderHogar(a);
    const opciones = [...a.raiz().querySelectorAll('select[aria-label="Categoría del gasto"] option')].map((o) => o.textContent?.trim());
    expect(opciones).toContain('Educación');
  });
});
