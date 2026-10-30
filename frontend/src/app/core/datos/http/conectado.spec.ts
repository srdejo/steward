import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReglaError, type Puertos } from '@steward/domain';

import { GoogleDePrueba, USUARIO, finanzasPrueba, finanzasVacias, hogarApi, http, provideConectadoPrueba, responder } from '../../../../testing/conectado';
import { CLAVE_ESTADO } from '@steward/domain/demo';
import type { CreditoApi, FinanzasApi, IngresoPlanApi, ItemPlanApi, MovimientoApi, PlanApi } from './api';
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

  it('modo conectado en Ajustes: hogar real, sin aviso ni sección de datos de prueba (backend-plan-anual)', async () => {
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
    expect(a.texto()).not.toContain('Datos de prueba');
    expect(a.texto()).not.toContain('Restablecer datos de prueba');
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
  cuentaDestinoId: null, creditoId: null, ingresoPlanId: null, seq: 1,
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
    // Lo real nunca se guarda en el dispositivo.
    expect(localStorage.getItem(CLAVE_ESTADO) ?? '').not.toContain('Salario Ana');
  });

  it('Recibí una línea del plan con otro monto, en el backend, sin obligación de diezmo (diezmo-como-gasto)', async () => {
    const plan: PlanApi = { ...PLAN_OCT, escenarios: [{ ...PLAN_OCT.escenarios[0]!, ingresos: [LINEA_SALARIO], items: [...PLAN_OCT.escenarios[0]!.items, DIEZMO_SALARIO] }] };
    finanzasPrueba.valor = finanzas({ planes: [plan] });
    const relee = p.cuentas.agregar({ nombre: 'Otra', titularId: null, saldo: 0 });
    await responder('POST', '/api/cuentas', { id: 'cta-x' }, tick, 201);
    await relee;
    const antes = await p.movimientos.resumenMes(OCT);
    expect(antes.ingresos.find((l) => l.lineaId === 'lin-1')).toMatchObject({ nombre: 'Salario Ana', monto: 6_288_000, recibido: false });
    expect(antes.porPagar.map((i) => i.item.nombre)).toContain('Diezmo · Salario Ana');

    const recibir = p.ingresos.marcarRecibido({ ref: OCT, lineaId: 'lin-1', monto: 6_350_000 });
    const recibido: MovimientoApi = { ...RECIBIDO, monto: 6_350_000, ingresoPlanId: 'lin-1', aplicaDiezmo: false };
    finanzasPrueba.valor = finanzas({ planes: [plan], movimientos: [recibido] });
    const req = await responder('POST', '/api/planes/plan-oct/escenarios/esc-a/ingresos/lin-1/recibido', recibido, tick, 201);
    await recibir;
    expect(req.request.body).toEqual({ monto: 6_350_000 });
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.ingresos.find((l) => l.lineaId === 'lin-1')).toMatchObject({ monto: 6_350_000, recibido: true });
    expect(r.libre).toBe(antes.libre + 62_000);
    // El diezmo sigue como item por pagar: no hay tarjeta ni obligacion.
    expect(r.porPagar.find((i) => i.item.nombre === 'Diezmo · Salario Ana')?.plan).toBe(700_000);
  });

  it('líneas de ingreso de una opción: agregar, editar y quitar en el backend (diezmo-como-gasto)', async () => {
    const agregar = p.plan.guardarIngreso('plan-oct', 'esc-a', { nombre: 'Venta bicicleta', monto: 400_000, usuarioId: null, tipo: 'OTRO', ingresoFijoId: null, bruto: 400_000 }, true);
    const r1 = await responder('POST', '/api/planes/plan-oct/escenarios/esc-a/ingresos', { id: 'lin-2', nombre: 'Venta bicicleta', monto: 400_000, usuarioId: null, tipo: 'OTRO', ingresoFijoId: null }, tick, 201);
    await agregar;
    expect(r1.request.body).toEqual({ nombre: 'Venta bicicleta', monto: 400_000, usuarioId: null, bruto: 400_000, aplicarDiezmo: true });
    const editar = p.plan.guardarIngreso('plan-oct', 'esc-a', { ...LINEA_SALARIO, monto: 7_000_000, bruto: 7_500_000 });
    const r2 = await responder('PUT', '/api/planes/plan-oct/escenarios/esc-a/ingresos/lin-1', { ...LINEA_SALARIO, monto: 7_000_000 }, tick);
    await editar;
    expect(r2.request.body).toEqual({ nombre: 'Salario Ana', monto: 7_000_000, usuarioId: USUARIO.id, bruto: 7_500_000 });
    const quitar = p.plan.quitarIngreso('plan-oct', 'esc-a', 'lin-2');
    await responder('DELETE', '/api/planes/plan-oct/escenarios/esc-a/ingresos/lin-2', null, tick, 204);
    await quitar;
  });

  it('borrar y corregir un registro, volver a calcular y borrar un plan van al backend (usabilidad-plan)', async () => {
    const corregir = p.movimientos.corregirRegistro({ movimientoId: 'mov-1', monto: 120_000, origen: { tipo: 'CUENTA', cuentaId: 'cta-1' } });
    const r1 = await responder('PATCH', '/api/registros/mov-1', RECIBIDO, tick);
    await corregir;
    expect(r1.request.body).toEqual({ monto: 120_000, origen: { tipo: 'CUENTA', cuentaId: 'cta-1' } });
    const borrar = p.movimientos.borrarRegistro('mov-1');
    await responder('DELETE', '/api/registros/mov-1', null, tick, 204);
    await borrar;
    const recalcular = p.plan.recalcularDiezmo('plan-oct', 'esc-a', 'it-diezmo');
    await responder('POST', '/api/planes/plan-oct/escenarios/esc-a/items/it-diezmo/recalcular', DIEZMO_SALARIO, tick);
    await recalcular;
    const conteo = p.plan.conteoBorrado(OCT);
    await responder('GET', '/api/meses/2026-10/borrado', { pagos: 1, gastos: 2, ingresos: 0, cerrado: false }, tick);
    expect(await conteo).toEqual({ pagos: 1, gastos: 2, ingresos: 0, cerrado: false });
    const plan = p.plan.borrarPlan(OCT);
    await responder('DELETE', '/api/meses/2026-10', null, tick, 204);
    await plan;
    const empezar = p.hogar.empezarDeNuevo();
    await responder('POST', '/api/hogar/empezar-de-nuevo', null, tick, 204);
    await empezar;
  });

  it('YA_RECIBIDO: llega el mensaje y el ingreso queda como recibido', async () => {
    // Se captura ya: el rechazo llega antes de que el test lo espere.
    const recibir = p.ingresos.marcarRecibido({ ref: OCT, ingresoFijoId: 'ing-1' }).catch((e: unknown) => e);
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

  it('cuentas: agregar a mi nombre o conjunta, cuadrar y mover (backend-cuentas-creditos)', async () => {
    const mia = p.cuentas.agregar({ nombre: 'Nu', titularId: USUARIO.id, saldo: 300_000 });
    finanzasPrueba.valor = finanzas({ cuentas: [{ id: 'cta-1', nombre: 'Nu', titularId: USUARIO.id, saldoCuadre: 300_000, fechaCuadre: '2026-10-26', cuadrada: false, seqCuadre: 0 }] });
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

    const cuadrar = p.cuentas.cuadrar([{ cuentaId: 'cta-1', saldoBanco: 250_000 }]);
    const req3 = await responder('POST', '/api/cuentas/cuadre', [], tick);
    await cuadrar;
    expect(req3.request.body).toEqual({ saldos: [{ cuentaId: 'cta-1', saldoBanco: 250_000 }] });

    const mover = p.cuentas.mover({ desde: 'cta-1', hacia: 'cta-2', monto: 50_000 });
    const req4 = await responder('POST', '/api/transferencias', registro({ tipo: 'TRANSFERENCIA' }), tick, 201);
    await mover;
    expect(req4.request.body).toEqual({ desde: 'cta-1', hacia: 'cta-2', monto: 50_000 });
    await expect(p.cuentas.mover({ desde: 'cta-1', hacia: 'cta-1', monto: 1 })).rejects.toMatchObject({ codigo: 'MISMA_CUENTA' });
  });

  it('el saldo estimado usa el orden real y el último cuadre, aunque lo registrado sea de un mes viejo', async () => {
    finanzasPrueba.valor = finanzas({
      cuentas: [{ id: 'cta-1', nombre: 'Nu', titularId: USUARIO.id, saldoCuadre: 300_000, fechaCuadre: '2026-10-20', cuadrada: true, seqCuadre: 5 }],
      movimientos: [
        registro({ id: 'antes', monto: 40_000, origen: 'CUENTA', cuentaId: 'cta-1', seq: 4 }),
        registro({ id: 'junio', monto: 25_000, origen: 'CUENTA', cuentaId: 'cta-1', seq: 7, ref: { anio: 2026, mes: 6 } }),
      ],
    });
    // Cualquier escritura relee las finanzas.
    const relee = p.cuentas.agregar({ nombre: 'Otra', titularId: null, saldo: 0 });
    await responder('POST', '/api/cuentas', { id: 'cta-2' }, tick, 201);
    await relee;
    const { cuentas } = await p.cuentas.cuentas();
    expect(cuentas.map((c) => [c.cuenta.nombre, c.saldo])).toEqual([['Nu', 275_000]]);
  });

  it('créditos reales: los de prueba no se ven; agregar, saldo y abono van al backend', async () => {
    expect(await p.cuentas.creditos()).toEqual([]);
    const datos = { nombre: 'Libre inversión', entidad: 'Bancolombia', saldo: 14_250_000, totalOriginal: 20_000_000, cuota: 500_000, tasaEM: 1.6, diaPago: 15 };
    const agregar = p.cuentas.agregarCredito(datos);
    const credito = { ...datos, id: 'cred-1', saldoActualizadoEn: '2026-10-26', pagos: [{ fecha: '2026-10-26', monto: 500_000, tipo: 'CUOTA' as const }] };
    finanzasPrueba.valor = finanzas({ creditos: [credito] });
    const req = await responder('POST', '/api/creditos', credito, tick, 201);
    await agregar;
    expect(req.request.body).toEqual(datos);
    const [vista] = await p.cuentas.creditos();
    expect(vista).toMatchObject({ porcentajePagado: 29, credito: { nombre: 'Libre inversión', pagos: [{ tipo: 'CUOTA', monto: 500_000 }] } });

    const saldo = p.cuentas.actualizarSaldo('cred-1', 13_900_000);
    const req2 = await responder('PUT', '/api/creditos/cred-1/saldo', credito, tick);
    await saldo;
    expect(req2.request.body).toEqual({ saldo: 13_900_000 });

    const abono = p.cuentas.registrarAbono('cred-1', 1_000_000, { tipo: 'EXTERNA' });
    const req3 = await responder('POST', '/api/creditos/cred-1/abonos', registro({ tipo: 'ABONO_CREDITO' }), tick, 201);
    await abono;
    expect(req3.request.body).toEqual({ monto: 1_000_000, usuarioId: USUARIO.id, origen: { tipo: 'EXTERNA' } });
  });

  it('en modo conectado no hay datos de prueba que restablecer (steward-ui-shell)', async () => {
    expect(p.demo).toBeNull();
    expect((await p.ingresos.fijos()).map((f) => f.nombre)).toEqual(['Salario Ana']);
  });

  it('los aportes van al backend (Etapa 4)', async () => {
    const aportar = p.ingresos.registrarAporte({ usuarioId: USUARIO.id, monto: 500_000, ref: OCT, cuentaId: null, aplicaDiezmo: false });
    const aporte: MovimientoApi = { ...RECIBIDO, id: 'mov-a', tipo: 'APORTE', monto: 500_000, ingresoFijoId: null, bruto: null, aplicaDiezmo: false };
    finanzasPrueba.valor = finanzas({ movimientos: [aporte] });
    const reqAporte = await responder('POST', '/api/aportes', aporte, tick, 201);
    await aportar;
    expect(reqAporte.request.body).toEqual({ usuarioId: USUARIO.id, monto: 500_000, mes: OCT, cuentaId: null, aplicaDiezmo: false });
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.ingresos.find((l) => l.tipo === 'APORTES' && l.usuarioId === USUARIO.id)?.monto).toBe(500_000);
  });
});

// --- Plan del mes y registros de Hoy en el backend (backend-plan-mes-hoy, design D5) -----------------------------

const PLAN_OCT: PlanApi = {
  id: 'plan-oct', ref: OCT, estado: 'ACTIVO', escenarioActivoId: 'esc-a',
  escenarios: [{
    id: 'esc-a', letra: 'A', creadoPor: USUARIO.id, nota: '', archivado: false, ingresos: [],
    items: [
      { id: 'it-internet', categoriaId: 'cat-1', nombre: 'Internet', monto: 120_000, diaVence: 28, tipo: 'FIJO', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null },
      { id: 'it-mercado', categoriaId: 'cat-3', nombre: 'Mercado', monto: 320_000, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null },
    ],
  }],
};

/** La linea del salario y su diezmo, como nacen con el mes (design D2 y D8 de diezmo-como-gasto). */
const LINEA_SALARIO: IngresoPlanApi = { id: 'lin-1', nombre: 'Salario Ana', monto: 6_288_000, usuarioId: USUARIO.id, tipo: 'FIJO', ingresoFijoId: 'ing-1' };
const DIEZMO_SALARIO: ItemPlanApi = {
  id: 'it-diezmo', categoriaId: 'cat-0', nombre: 'Diezmo · Salario Ana', monto: 700_000, diaVence: 25, tipo: 'DIEZMO', cuota: null, creditoId: null,
  ingresoFijoId: 'ing-1', aporteId: null,
};

const CREDITO: CreditoApi = {
  id: 'cred-1', nombre: 'Libre inversión', entidad: 'Bancolombia', saldo: 14_250_000, saldoActualizadoEn: '2026-10-26', cuota: 500_000,
  tasaEM: 1.6, diaPago: 15, totalOriginal: 20_000_000, pagos: [],
};

function registro(extra: Partial<MovimientoApi>): MovimientoApi {
  return { ...RECIBIDO, id: 'mov-x', tipo: 'GASTO', monto: 0, ingresoFijoId: null, bruto: null, aplicaDiezmo: false, seq: 2, ...extra };
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
    expect(r.plan).toBe(440_000); // solo los items: el diezmo es un item mas (diezmo-como-gasto)
    expect(r.noPlaneados).toHaveLength(0);
    expect((await p.hogar.categorias()).map((c) => c.nombre)).toEqual(['Diezmo', 'Gastos fijos', 'Tarjetas y cuotas', 'Variables', 'Créditos']);
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

    const item = { categoriaId: 'cat-1', nombre: 'Luz', monto: 50_000, diaVence: 10, tipo: 'FIJO' as const, cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false };
    const agregar = p.plan.guardarItem('plan-oct', 'esc-a', item);
    const r2 = await responder('POST', '/api/planes/plan-oct/escenarios/esc-a/items', { ...item, id: 'it-luz' }, tick, 201);
    await agregar;
    expect(r2.request.body).toEqual({ categoriaId: 'cat-1', nombre: 'Luz', monto: 50_000, diaVence: 10, tipo: 'FIJO', cuota: null, creditoId: null });

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

  it('el plan anual real: crear, celda, evento, aporte proyectado y crear meses (backend-plan-anual)', async () => {
    // Sin anual real, el de prueba (2027) no se ve.
    expect(await p.plan.anual(2027)).toBeNull();
    const crear = p.plan.crearAnual(2027);
    const vacio = { anio: 2027, estado: 'BORRADOR' as const, celdas: [], eventos: [] };
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], anuales: [vacio] });
    const r1 = await responder('POST', '/api/anuales', vacio, tick, 201);
    await crear;
    expect(r1.request.body).toEqual({ anio: 2027 });
    const r = (await p.plan.anual(2027))!;
    expect(r.gastos.map((g) => g.nombre)).toEqual(['Gastos fijos', 'Tarjetas y cuotas', 'Variables', 'Créditos']);
    expect(r.ingresos.filter((i) => i.tenue).map((i) => i.nombre)).toEqual(['Aportes Ana María']);

    const celda = p.plan.editarMontoAnual(2027, 'cat-1', 1, 800_000);
    const conCelda = { ...vacio, celdas: [{ categoriaId: 'cat-1', mes: 1, monto: 800_000 }] };
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], anuales: [conCelda] });
    const r2 = await responder('PUT', '/api/anuales/2027/celdas', null, tick, 204);
    await celda;
    expect(r2.request.body).toEqual({ categoriaId: 'cat-1', mes: 1, monto: 800_000 });
    expect((await p.plan.anual(2027))!.gastos[0]!.valores[0]).toBe(800_000);

    const evento = p.plan.agregarEvento(2027, { nombre: 'SOAT', mes: 3, monto: 1_200_000, tipo: 'GASTO', usuarioId: null });
    const r3 = await responder('POST', '/api/anuales/2027/eventos', {}, tick, 201);
    await evento;
    expect(r3.request.body).toEqual({ nombre: 'SOAT', mes: 3, monto: 1_200_000, tipo: 'GASTO', usuarioId: null });

    const proy = p.plan.editarProyeccion(USUARIO.id, { anio: 2027, mes: 1 }, 2_000_000);
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], anuales: [conCelda], proyecciones: [{ usuarioId: USUARIO.id, anio: 2027, mes: 1, monto: 2_000_000 }] });
    const r4 = await responder('PUT', '/api/anuales/2027/proyecciones', null, tick, 204);
    await proy;
    expect(r4.request.body).toEqual({ usuarioId: USUARIO.id, mes: 1, monto: 2_000_000 });
    expect((await p.plan.anual(2027))!.ingresos.find((i) => i.tenue)!.valores[0]).toBe(2_000_000);

    const meses = p.plan.crearMesesDesdeAnual(2027);
    await responder('POST', '/api/anuales/2027/crear-meses', [{ anio: 2027, mes: 1 }], tick);
    await meses;
  });

  it('cerrar octubre manda la foto del dominio con el último registro del mes (backend-cierre-mes)', async () => {
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [registro({ id: 'mov-g', monto: 85_000, nota: 'Farmacia', seq: 7 }), registro({ id: 'nov', seq: 9, ref: { anio: 2026, mes: 11 }, tipo: 'APORTE', monto: 1 })] });
    const relee = p.cuentas.agregar({ nombre: 'Otra', titularId: null, saldo: 0 });
    await responder('POST', '/api/cuentas', { id: 'cta-x' }, tick, 201);
    await relee;
    const vista = await p.cierre.vista(OCT);
    expect(vista.cerrado).toBe(false);

    const cerrar = p.cierre.cerrar(OCT, { aAhorro: Math.max(0, vista.sobrante), aSiguiente: 0 });
    finanzasPrueba.valor = { ...finanzasPrueba.valor, planes: [{ ...PLAN_OCT, estado: 'CERRADO' }], cierres: [{
      ref: OCT, filas: vista.filas, sinRegistrar: 0, sobrante: vista.sobrante, aAhorro: Math.max(0, vista.sobrante), aSiguiente: 0, cerradoPor: USUARIO.id, cerradoEn: '2026-10-31',
    }] };
    const req = await responder('POST', '/api/cierres', finanzasPrueba.valor.cierres[0]!, tick, 201);
    await cerrar;
    expect(req.request.body).toMatchObject({ anio: 2026, mes: 10, ultimoSeq: 7, sinRegistrar: 0, sobrante: vista.sobrante, filas: vista.filas });
    expect((await p.cierre.vista(OCT)).cerrado).toBe(true);
    // Pagar en el mes cerrado lo rechaza el backend.
    const pagar = p.movimientos.marcarPago({ itemId: 'it-internet', ref: OCT, monto: 1, usuarioId: USUARIO.id, origen: { tipo: 'NINGUNO' } }).catch((e: unknown) => e);
    await responder('POST', '/api/pagos', { codigo: 'MES_CERRADO', mensaje: 'El mes está cerrado' }, tick, 409);
    expect(await pagar).toMatchObject({ codigo: 'MES_CERRADO' });
  });

  it('un cierre desactualizado relee antes de propagar el error', async () => {
    const cerrar = p.cierre.cerrar(OCT, { aAhorro: 0, aSiguiente: 0 }).catch((e: unknown) => e);
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [registro({ id: 'mov-g', monto: 85_000, seq: 3 })] });
    await responder('POST', '/api/cierres', { codigo: 'CIERRE_DESACTUALIZADO', mensaje: 'Alguien registró algo en octubre; revisa el cierre otra vez' }, tick, 409);
    expect(await cerrar).toMatchObject({ codigo: 'CIERRE_DESACTUALIZADO' });
    expect((await p.cierre.vista(OCT)).filas.find((x) => x.nombre === 'No estaba planeado')?.real).toBe(85_000);
  });

  it('un mes cerrado: su foto, y el sobrante en el mes siguiente (superposición)', async () => {
    finanzasPrueba.valor = finanzas({
      planes: [{ ...PLAN_OCT, estado: 'CERRADO' }],
      cierres: [{ ref: OCT, filas: [{ nombre: 'Ingresos', plan: 1, real: 2 }], sinRegistrar: 0, sobrante: 3_166_000, aAhorro: 2_000_000, aSiguiente: 1_166_000, cerradoPor: USUARIO.id, cerradoEn: '2026-10-31' }],
    });
    const relee = p.cuentas.agregar({ nombre: 'Otra', titularId: null, saldo: 0 });
    await responder('POST', '/api/cuentas', { id: 'cta-x' }, tick, 201);
    await relee;
    expect(await p.cierre.vista(OCT)).toMatchObject({ cerrado: true, sobrante: 3_166_000, aSiguiente: 1_166_000, filas: [{ nombre: 'Ingresos', plan: 1, real: 2 }] });
    expect(await p.plan.loQueTrae({ anio: 2026, mes: 11 })).toContainEqual(expect.objectContaining({ nombre: 'Sobrante de octubre', monto: 1_166_000 }));
  });

  it('un aporte con diezmo: su ítem llega en el plan leído (diezmo-como-gasto)', async () => {
    const aportar = p.ingresos.registrarAporte({ usuarioId: USUARIO.id, monto: 2_000_000, ref: OCT, cuentaId: null, aplicaDiezmo: true });
    const aporte = registro({ id: 'mov-a', tipo: 'APORTE', monto: 2_000_000, aplicaDiezmo: true });
    const item: ItemPlanApi = { ...DIEZMO_SALARIO, id: 'it-aporte', nombre: 'Diezmo · aporte 26 oct', monto: 200_000, diaVence: null, ingresoFijoId: null, aporteId: 'mov-a' };
    finanzasPrueba.valor = finanzas({ planes: [{ ...PLAN_OCT, escenarios: [{ ...PLAN_OCT.escenarios[0]!, items: [...PLAN_OCT.escenarios[0]!.items, item] }] }], movimientos: [aporte] });
    const req = await responder('POST', '/api/aportes', aporte, tick, 201);
    await aportar;
    expect(req.request.body).toMatchObject({ aplicaDiezmo: true });
    const r = await p.movimientos.resumenMes(OCT);
    expect(r.porPagar.find((i) => i.item.aporteId === 'mov-a')).toMatchObject({ plan: 200_000, item: { tipo: 'DIEZMO', nombre: 'Diezmo · aporte 26 oct' } });
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

  it('Hoy: Recibí abre el monto, lo registra en el backend y no aparece tarjeta de diezmo', async () => {
    finanzasPrueba.valor = finanzas();
    const a = await entrarA('/hoy');
    expect(a.texto()).toContain('Salario Ana');
    a.porTexto('Recibí').click();
    await atenderHogar(a);
    await a.escribir('Valor recibido', '6350000');
    a.porTexto('Marcar recibido').click();
    finanzasPrueba.valor = finanzas({ movimientos: [{ ...RECIBIDO, monto: 6_350_000 }] });
    const req = await responder('POST', '/api/ingresos-fijos/ing-1/recibido', { ...RECIBIDO, monto: 6_350_000 }, a.estable, 201);
    expect(req.request.body).toEqual({ monto: 6_350_000 });
    await atenderHogar(a);
    expect(a.url()).toBe('/hoy');
    expect(a.texto()).toContain('Fijo · recibido 26 oct');
    expect(a.texto()).not.toContain('Disponible para diezmar');
  });

  it('Hoy: si ya estaba recibido, muestra el mensaje y el ingreso queda recibido', async () => {
    finanzasPrueba.valor = finanzas();
    const a = await entrarA('/hoy');
    a.porTexto('Recibí').click();
    await atenderHogar(a);
    a.porTexto('Marcar recibido').click();
    finanzasPrueba.valor = finanzas({ movimientos: [RECIBIDO] });
    await responder('POST', '/api/ingresos-fijos/ing-1/recibido', { codigo: 'YA_RECIBIDO', mensaje: 'Ese ingreso ya se marcó como recibido este mes' }, a.estable, 409);
    await atenderHogar(a);
    expect(a.texto()).toContain('Ese ingreso ya se marcó como recibido este mes');
    await a.ir('/hoy');
    await atenderHogar(a);
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

  it('Cuentas: las reales, sin créditos de prueba, y cuadrar va al backend', async () => {
    finanzasPrueba.valor = finanzas({ cuentas: [{ id: 'cta-1', nombre: 'Nu', titularId: USUARIO.id, saldoCuadre: 300_000, fechaCuadre: '2026-10-26', cuadrada: false, seqCuadre: 0 }] });
    const a = await entrarA('/cuentas');
    expect(a.raiz().querySelector('[data-cuenta="Nu"]')?.textContent).toContain('Ana María');
    expect(a.raiz().querySelector('[data-cuenta="Davivienda"]')).toBeNull();
    expect(a.texto()).toContain('Sin créditos.');
    await a.tocar('Cuadrar cuentas');
    expect(a.url()).toBe('/cuentas/cuadrar');
    await atenderHogar(a);
    await a.escribir('[data-cuenta="Nu"] input', '250000');
    a.porTexto('Guardar saldos').click();
    finanzasPrueba.valor = finanzas({
      cuentas: [{ id: 'cta-1', nombre: 'Nu', titularId: USUARIO.id, saldoCuadre: 250_000, fechaCuadre: '2026-10-26', cuadrada: true, seqCuadre: 3 }],
      movimientos: [registro({ id: 'aj', tipo: 'AJUSTE_CUADRE', monto: 50_000, origen: 'CUENTA', cuentaId: 'cta-1', nota: 'Gastos sin registrar', seq: 3 })],
    });
    const req = await responder('POST', '/api/cuentas/cuadre', [], a.estable);
    expect(req.request.body).toEqual({ saldos: [{ cuentaId: 'cta-1', saldoBanco: 250_000 }] });
    await atenderHogar(a);
    expect(a.url()).toBe('/cuentas');
    expect(a.raiz().querySelector('[data-cuenta="Nu"]')?.textContent?.replace(/\s+/g, ' ')).toContain('cuadrada hoy $250.000');
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

  it('avisos: Cerrar un mes futuro y Crear meses desde el anual', async () => {
    finanzasPrueba.valor = finanzas({ planes: [{ ...PLAN_OCT, estado: 'BORRADOR', escenarioActivoId: null }], creditos: [CREDITO] });
    const a = await entrarA('/planear/2026-10/comparar');
    expect(a.texto()).not.toContain('llega en una próxima versión');

    // Un mes futuro no se cierra (backend-cierre-mes).
    await a.ir('/planear/2026-11/cierre');
    await atenderHogar(a);
    expect(a.raiz().querySelector('[data-testid="cierre-futuro"]')?.textContent).toContain('Noviembre se cierra cuando llegue.');
    expect(() => a.porTexto('Cerrar noviembre')).toThrow();

  });

  it('recorrido de la Etapa 8: crear el anual, llenar una celda y el aporte proyectado (backend-plan-anual)', async () => {
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT] });
    const a = await entrarA('/planear/anual/2027');
    expect(a.texto()).toContain('No hay plan anual para 2027.');
    a.porTexto('Crear plan anual 2027').click();
    const vacio = { anio: 2027, estado: 'BORRADOR' as const, celdas: [], eventos: [] };
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], anuales: [vacio] });
    await responder('POST', '/api/anuales', vacio, a.estable, 201);
    await atenderHogar(a);
    expect(a.texto()).toContain('Plan anual 2027');
    expect(a.texto()).not.toContain('Datos de prueba');

    await a.tocar(/.*/, '[aria-label="Gastos fijos · Enero"]');
    await a.escribir('Monto del mes', '800000');
    a.porTexto('Guardar').click();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], anuales: [{ ...vacio, celdas: [{ categoriaId: 'cat-1', mes: 1, monto: 800_000 }] }] });
    const r1 = await responder('PUT', '/api/anuales/2027/celdas', null, a.estable, 204);
    expect(r1.request.body).toEqual({ categoriaId: 'cat-1', mes: 1, monto: 800_000 });
    await atenderHogar(a);

    await a.tocar(/.*/, '[aria-label="Aportes Ana María · Enero"]');
    await a.escribir('Aporte que esperas', '2000000');
    a.porTexto('Guardar').click();
    finanzasPrueba.valor = finanzas({
      planes: [PLAN_OCT], anuales: [{ ...vacio, celdas: [{ categoriaId: 'cat-1', mes: 1, monto: 800_000 }] }],
      proyecciones: [{ usuarioId: USUARIO.id, anio: 2027, mes: 1, monto: 2_000_000 }],
    });
    const r2 = await responder('PUT', '/api/anuales/2027/proyecciones', null, a.estable, 204);
    expect(r2.request.body).toEqual({ usuarioId: USUARIO.id, mes: 1, monto: 2_000_000 });
    await atenderHogar(a);

    a.porTexto('Crear meses desde este plan').click();
    await responder('POST', '/api/anuales/2027/crear-meses', [], a.estable);
    await atenderHogar(a);
  });

  it('recorrido de la Etapa 7: duplicar, quitar, probar un abono, comparar y usar (backend-opciones-mes)', async () => {
    const NOV = { anio: 2026, mes: 11 };
    const a0 = { ...PLAN_OCT.escenarios[0]!, id: 'nov-a', items: PLAN_OCT.escenarios[0]!.items.map((i) => ({ ...i, id: 'nov-' + i.id })) };
    const copia = (id: string, letra: string, extra: typeof a0.items = []) => ({ ...a0, id, letra, items: [...a0.items.map((i) => ({ ...i, id: id + i.id })), ...extra] });
    const nov = (escenarios: (typeof a0)[], activo: string | null = null): PlanApi => ({ id: 'plan-nov', ref: NOV, estado: 'BORRADOR', escenarioActivoId: activo, escenarios });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT, nov([a0])], creditos: [CREDITO] });
    const a = await entrarA('/planear/2026-11');
    expect(a.texto()).not.toContain('Quitar opción');

    // + Duplicar dos veces: B y C.
    a.porTexto('+ Duplicar').click();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT, nov([a0, copia('nov-b', 'B')])], creditos: [CREDITO] });
    const d1 = await responder('POST', '/api/planes/plan-nov/escenarios', finanzasPrueba.valor.planes[1]!, a.estable, 201);
    expect(d1.request.body).toEqual({ desde: 'nov-a' });
    await atenderHogar(a);
    a.porTexto('+ Duplicar').click();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT, nov([a0, copia('nov-b', 'B'), copia('nov-c', 'C')])], creditos: [CREDITO] });
    await responder('POST', '/api/planes/plan-nov/escenarios', finanzasPrueba.valor.planes[1]!, a.estable, 201);
    await atenderHogar(a);
    expect(a.porTexto(/Opción C/, '[role="tab"]').getAttribute('aria-selected')).toBe('true');

    // Quitar la C, con su confirmación.
    await a.tocar('Quitar opción');
    expect(a.texto()).toContain('¿Quitar la Opción C?');
    a.porTexto('Quitar opción C').click();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT, nov([a0, copia('nov-b', 'B')])], creditos: [CREDITO] });
    await responder('DELETE', '/api/planes/plan-nov/escenarios/nov-c', null, a.estable, 204);
    await atenderHogar(a);
    expect(() => a.porTexto(/Opción C/, '[role="tab"]')).toThrow();

    // Probar un abono como opción de noviembre desde el crédito: la nueva C.
    await a.ir('/cuentas/credito/cred-1');
    await atenderHogar(a);
    await a.escribir('Abono', '2000000');
    a.porTexto(/Probarlo como opción de noviembre/).click();
    const abono = { id: 'it-abono', categoriaId: 'cat-4', nombre: 'Abono extra libre inversión', monto: 2_000_000, diaVence: 15, tipo: 'CREDITO' as const, cuota: null, creditoId: 'cred-1', ingresoFijoId: null, aporteId: null };
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT, nov([a0, copia('nov-b', 'B'), copia('nov-c', 'C', [abono])])], creditos: [CREDITO] });
    const pr = await responder('POST', '/api/creditos/cred-1/probar', { planId: 'plan-nov', escenarioId: 'nov-c' }, a.estable, 201);
    expect(pr.request.body).toEqual({ anio: 2026, mes: 11, abono: 2_000_000 });
    await atenderHogar(a);
    expect(a.url()).toBe('/planear/2026-11');

    // Comparar: solo Créditos cambia; usar la C.
    const c = await TestBed.inject(PUERTOS).plan.comparar(NOV);
    expect(c.letras).toEqual(['A', 'B', 'C']);
    expect(c.filas.map((x) => x.nombre)).toEqual(['Créditos']);
    await a.ir('/planear/2026-11/comparar');
    await atenderHogar(a);
    a.porTexto('Usar C').click();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT, nov([{ ...a0, archivado: true }, { ...copia('nov-b', 'B'), archivado: true }, copia('nov-c', 'C', [abono])], 'nov-c')], creditos: [CREDITO] });
    const us = await responder('POST', '/api/planes/plan-nov/usar', finanzasPrueba.valor.planes[1]!, a.estable);
    expect(us.request.body).toEqual({ escenarioId: 'nov-c' });
    await atenderHogar(a);
    expect((await TestBed.inject(PUERTOS).plan.mes(NOV)).opciones.map((o) => o.escenario.letra)).toEqual(['C']);
  });

  it('un mes que ya no está en Borrador: el mensaje del backend', async () => {
    finanzasPrueba.valor = finanzas({ planes: [{ ...PLAN_OCT, estado: 'BORRADOR', escenarioActivoId: null }] });
    const a = await entrarA('/planear/2026-10');
    a.porTexto('+ Duplicar').click();
    await responder('POST', '/api/planes/plan-oct/escenarios', { codigo: 'MES_NO_BORRADOR', mensaje: 'Octubre ya está en curso; su plan no gana opciones' }, a.estable, 409);
    await atenderHogar(a);
    expect(a.texto()).toContain('Octubre ya está en curso; su plan no gana opciones');
  });

  it('recorrido de la Etapa 5: crédito con su cuota, pagarla, abonar y cuadrar (backend-cuentas-creditos)', async () => {
    const DAVIVIENDA = { id: 'cta-d', nombre: 'Davivienda', titularId: USUARIO.id, saldoCuadre: 4_000_000, fechaCuadre: '2026-10-01', cuadrada: false, seqCuadre: 0 };
    const CUOTA = { id: 'it-cuota', categoriaId: 'cat-4', nombre: 'Cuota libre inversión', monto: 500_000, diaVence: 15, tipo: 'CREDITO' as const, cuota: null, creditoId: 'cred-1', ingresoFijoId: null, aporteId: null };
    const conCuota: PlanApi = { ...PLAN_OCT, escenarios: [{ ...PLAN_OCT.escenarios[0]!, items: [...PLAN_OCT.escenarios[0]!.items, CUOTA] }] };
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], cuentas: [DAVIVIENDA] });
    const a = await entrarA('/cuentas');

    // + Agregar crédito: su cuota entra a la Opción A de octubre.
    await a.tocar('+ Agregar', '[aria-label="Agregar crédito"]');
    await a.escribir('Nombre', 'Libre inversión');
    await a.escribir('Entidad', 'Bancolombia');
    await a.escribir('Saldo', '14250000');
    await a.escribir('Total original', '20000000');
    await a.escribir('Cuota', '500000');
    await a.escribir('Tasa (% EM)', '1,6');
    await a.escribir('Día de pago', '15');
    a.porTexto('Agregar crédito').click();
    finanzasPrueba.valor = finanzas({ planes: [conCuota], cuentas: [DAVIVIENDA], creditos: [CREDITO] });
    const crear = await responder('POST', '/api/creditos', CREDITO, a.estable, 201);
    expect(crear.request.body).toMatchObject({ nombre: 'Libre inversión', tasaEM: 1.6, diaPago: 15, totalOriginal: 20_000_000 });
    await atenderHogar(a);
    expect(a.texto()).toContain('Libre inversión Cuota $500.000 · 1,6% EM');
    await a.ir('/hoy');
    await atenderHogar(a);
    expect(a.texto()).toContain('Cuota libre inversión');

    // Pagarla desde Davivienda: el crédito baja en la parte de capital y la cuenta en la cuota.
    const pagar = TestBed.inject(PUERTOS).movimientos.marcarPago({
      itemId: 'it-cuota', ref: OCT, monto: 500_000, usuarioId: USUARIO.id, origen: { tipo: 'CUENTA', cuentaId: 'cta-d' },
    });
    const pago = registro({ id: 'mov-c', tipo: 'PAGO', monto: 500_000, itemId: 'it-cuota', origen: 'CUENTA', cuentaId: 'cta-d', creditoId: 'cred-1', seq: 1 });
    const conPago = { ...CREDITO, saldo: 13_978_000, pagos: [{ fecha: '2026-10-26', monto: 500_000, tipo: 'CUOTA' as const }] };
    finanzasPrueba.valor = finanzas({ planes: [conCuota], cuentas: [DAVIVIENDA], creditos: [conPago], movimientos: [pago] });
    await responder('POST', '/api/pagos', pago, a.estable, 201);
    await pagar;
    await a.ir('/cuentas');
    await atenderHogar(a);
    expect(a.texto()).toContain('$13.978.000');
    expect(a.raiz().querySelector('[data-cuenta="Davivienda"]')?.textContent?.replace(/\s+/g, ' ')).toContain('≈ $3.500.000');

    // Abono desde Davivienda.
    await a.ir('/cuentas/credito/cred-1');
    await atenderHogar(a);
    await a.tocar('Registrar abono');
    await a.escribir('¿Cuánto abonaste?', '1000000');
    await a.tocar('Davivienda', 'app-hoja [role="radio"]');
    a.porTexto('Guardar').click();
    const abono = registro({ id: 'mov-ab', tipo: 'ABONO_CREDITO', monto: 1_000_000, origen: 'CUENTA', cuentaId: 'cta-d', creditoId: 'cred-1', seq: 2 });
    const conAbono = { ...conPago, saldo: 12_978_000, pagos: [{ fecha: '2026-10-26', monto: 1_000_000, tipo: 'ABONO' as const }, ...conPago.pagos] };
    finanzasPrueba.valor = finanzas({ planes: [conCuota], cuentas: [DAVIVIENDA], creditos: [conAbono], movimientos: [pago, abono] });
    const req = await responder('POST', '/api/creditos/cred-1/abonos', abono, a.estable, 201);
    expect(req.request.body).toEqual({ monto: 1_000_000, usuarioId: USUARIO.id, origen: { tipo: 'CUENTA', cuentaId: 'cta-d' } });
    await atenderHogar(a);
    expect(a.texto()).toContain('$12.978.000');
    expect(a.texto()).toContain('Abono · 26 oct $1.000.000');

    // Cuadrar Davivienda (estima $2.500.000) en $2.450.000: $50.000 sin registrar en el Cierre.
    await a.ir('/cuentas/cuadrar');
    await atenderHogar(a);
    await a.escribir('[data-cuenta="Davivienda"] input', '2450000');
    expect(a.raiz().querySelector('[data-testid="sin-registrar"]')!.textContent!.trim()).toBe('$50.000');
    a.porTexto('Guardar saldos').click();
    const ajuste = registro({ id: 'mov-aj', tipo: 'AJUSTE_CUADRE', monto: 50_000, origen: 'CUENTA', cuentaId: 'cta-d', nota: 'Gastos sin registrar', seq: 3 });
    finanzasPrueba.valor = finanzas({
      planes: [conCuota], creditos: [conAbono], movimientos: [pago, abono, ajuste],
      cuentas: [{ ...DAVIVIENDA, saldoCuadre: 2_450_000, fechaCuadre: '2026-10-26', cuadrada: true, seqCuadre: 3 }],
    });
    await responder('POST', '/api/cuentas/cuadre', [], a.estable);
    await atenderHogar(a);
    expect(a.raiz().querySelector('[data-cuenta="Davivienda"]')?.textContent?.replace(/\s+/g, ' ')).toContain('cuadrada hoy $2.450.000');
    await a.ir('/planear/2026-10/cierre');
    await atenderHogar(a);
    expect(a.texto().replace(/\s+/g, ' ')).toContain('Sin registrar de cuadrar cuentas — 50.000');
  });

  it('recorrido de la Etapa 6: cerrar octubre, octubre en solo lectura y el sobrante en noviembre (backend-cierre-mes)', async () => {
    const aporte = registro({ id: 'mov-a', tipo: 'APORTE', monto: 500_000, seq: 4 });
    const pago = registro({ id: 'mov-p', tipo: 'PAGO', monto: 120_000, itemId: 'it-internet', seq: 5 });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [aporte, pago] });
    const a = await entrarA('/planear/2026-10/cierre');
    const sobrante = (await TestBed.inject(PUERTOS).cierre.vista(OCT)).sobrante;
    expect(sobrante).toBeGreaterThan(0);

    // Alguien registró algo mientras tanto: el mensaje, las cifras nuevas y el mes sigue abierto.
    a.porTexto('Cerrar octubre').click();
    const gasto = registro({ id: 'mov-g', monto: 85_000, nota: 'Farmacia', seq: 6 });
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT], movimientos: [aporte, pago, gasto] });
    const r1 = await responder('POST', '/api/cierres', { codigo: 'CIERRE_DESACTUALIZADO', mensaje: 'Alguien registró algo en octubre; revisa el cierre otra vez' }, a.estable, 409);
    expect(r1.request.body).toMatchObject({ ultimoSeq: 5 });
    await atenderHogar(a);
    expect(a.texto()).toContain('Alguien registró algo en octubre; revisa el cierre otra vez');
    expect(a.texto()).toContain('No estaba planeado');
    // El reparto se vuelve a proponer con el sobrante nuevo.
    expect(a.raiz().querySelector('[data-testid="aviso-reparto"]')).toBeNull();

    // Repartir: todo a noviembre.
    const nuevo = (await TestBed.inject(PUERTOS).cierre.vista(OCT)).sobrante;
    await a.escribir('A ahorro', '0');
    await a.escribir('Pasar a noviembre', String(nuevo));
    a.porTexto('Cerrar octubre').click();
    const v = await TestBed.inject(PUERTOS).cierre.vista(OCT);
    finanzasPrueba.valor = finanzas({
      planes: [{ ...PLAN_OCT, estado: 'CERRADO' }], movimientos: [aporte, pago, gasto],
      cierres: [{ ref: OCT, filas: v.filas, sinRegistrar: 0, sobrante: nuevo, aAhorro: 0, aSiguiente: nuevo, cerradoPor: USUARIO.id, cerradoEn: '2026-10-26' }],
    });
    const r2 = await responder('POST', '/api/cierres', finanzasPrueba.valor.cierres[0]!, a.estable, 201);
    expect(r2.request.body).toMatchObject({ ultimoSeq: 6, aAhorro: 0, aSiguiente: nuevo });
    await atenderHogar(a);
    expect(a.url()).toBe('/planear/2026-11');
    expect(a.texto()).toContain('Sobrante de octubre');

    await a.ir('/planear/2026-10/cierre');
    await atenderHogar(a);
    expect(a.texto()).toContain('El mes está cerrado: queda en solo lectura.');
    const pagar = TestBed.inject(PUERTOS).movimientos.marcarPago({ itemId: 'it-mercado', ref: OCT, monto: 1, usuarioId: USUARIO.id, origen: { tipo: 'NINGUNO' } }).catch((e: unknown) => e);
    await responder('POST', '/api/pagos', { codigo: 'MES_CERRADO', mensaje: 'El mes está cerrado' }, a.estable, 409);
    expect(await pagar).toMatchObject({ codigo: 'MES_CERRADO' });
    await atenderHogar(a);
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

    await a.tocar('+ Gasto');
    await a.escribir('Nombre', 'Internet');
    await a.escribir('Monto', '120000');
    a.porTexto('Guardar').click();
    finanzasPrueba.valor = finanzas({ planes: [{ ...vacio, escenarios: [{ ...vacio.escenarios[0]!, items: [{ ...PLAN_OCT.escenarios[0]!.items[0]!, monto: 0 }] }] }] });
    const item = await responder('POST', '/api/planes/plan-oct/escenarios/esc-a/items', { id: 'it-internet' }, a.estable, 201);
    expect(item.request.body).toMatchObject({ categoriaId: 'cat-1', nombre: 'Internet', monto: 120_000, tipo: 'FIJO' });
    await atenderHogar(a);

    a.porTexto('Usar opción A').click();
    finanzasPrueba.valor = finanzas({ planes: [PLAN_OCT] });
    const usar = await responder('POST', '/api/planes/plan-oct/usar', PLAN_OCT, a.estable);
    expect(usar.request.body).toEqual({ escenarioId: 'esc-a' });
    await atenderHogar(a);
    expect(a.url()).toBe('/planear');
  });

  it('criterio de cierre: pago bajo el plan, aporte y gasto no planeado cuadran en Hoy', async () => {
    // Un plan del backend nace con su linea de ingreso y su diezmo (diezmo-como-gasto).
    const OCT_CON_LINEA: PlanApi = { ...PLAN_OCT, escenarios: [{ ...PLAN_OCT.escenarios[0]!, ingresos: [LINEA_SALARIO], items: [...PLAN_OCT.escenarios[0]!.items, DIEZMO_SALARIO] }] };
    finanzasPrueba.valor = finanzas({ planes: [OCT_CON_LINEA] });
    const a = await entrarA('/hoy');
    const libre = () => a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim();
    // Ingresos $6.288.000 (salario por recibir); comprometido: Internet $120.000 + Mercado $320.000 + el item de diezmo $700.000.
    expect(libre()).toBe('$5.148.000');

    // Daniel paga Internet por $100.000 (plan $120.000) desde la hoja de pago.
    await a.ir('/hoy/pagar/it-internet');
    await atenderHogar(a);
    await a.escribir('Valor pagado', '100000');
    a.porTexto('Marcar pagado').click();
    const pago = registro({ id: 'mov-p', tipo: 'PAGO', monto: 100_000, itemId: 'it-internet', origen: 'NINGUNO' });
    finanzasPrueba.valor = finanzas({ planes: [OCT_CON_LINEA], movimientos: [pago] });
    await responder('POST', '/api/pagos', pago, a.estable, 201);
    await atenderHogar(a);

    // Un aporte de $500.000 y un gasto no planeado de $85.000.
    const p = TestBed.inject(PUERTOS);
    const aporte = registro({ id: 'mov-a', tipo: 'APORTE', monto: 500_000 });
    const aportar = p.ingresos.registrarAporte({ usuarioId: USUARIO.id, monto: 500_000, ref: OCT, cuentaId: null, aplicaDiezmo: false });
    finanzasPrueba.valor = finanzas({ planes: [OCT_CON_LINEA], movimientos: [pago, aporte] });
    await responder('POST', '/api/aportes', aporte, a.estable, 201);
    await aportar;
    const gasto = registro({ id: 'mov-g', tipo: 'GASTO', monto: 85_000, nota: 'Farmacia' });
    const gastar = p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: 'Farmacia', usuarioId: USUARIO.id, origen: { tipo: 'NINGUNO' }, ref: OCT });
    finanzasPrueba.valor = finanzas({ planes: [OCT_CON_LINEA], movimientos: [pago, aporte, gasto] });
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
    await a.tocar('+ Gasto');
    const opciones = [...a.raiz().querySelectorAll('app-hoja select option')].map((o) => o.textContent?.trim());
    expect(opciones).toContain('Educación');
  });
});
