import { ReglaError, type Aviso, type PreferenciasAviso, type Usuario } from '../index';
import type { DispositivoAviso } from '../ports';

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Como llega cada cliente al backend (design D1 de app-movil-conectada): HttpClient en la PWA y fetch en la app. Quien lo
 * implementa agrega la sesion y convierte los errores con `errorDeApi`.
 */
export interface Transporte {
  pedir<T>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown): Promise<T>;
}

/** Token de la sesion: localStorage en la PWA y el Keychain en la app. La lectura es sincrona. */
export interface TokenSesion {
  leer(): string | null;
  guardar(token: string): void;
  borrar(): void;
}

/** Contrato HTTP del backend (backend/README.md). */
export interface ConfigAcceso {
  googleClientId: string | null;
  /** Acceso de desarrollo sin Google: solo en local, donde Google no acepta steward.test como origen. */
  devLogin: boolean;
}

export interface UsuarioApi {
  id: string;
  nombre: string;
  email: string;
  inicial: string;
}

export interface SesionApi {
  token?: string;
  usuario: UsuarioApi;
  tieneHogar: boolean;
  hogarConfigurado: boolean;
}

export interface InvitacionApi {
  id: string;
  email: string;
  estado: 'PENDIENTE' | 'ACEPTADA';
  enviadaEn: string;
  expiraEn: string;
}

export interface HogarApi {
  id: string;
  nombre: string;
  configurado: boolean;
  miembros: { usuario: UsuarioApi; unidoEn: string; esActual: boolean }[];
  invitaciones: InvitacionApi[];
}

export interface InvitacionEnviadaApi {
  invitacion: InvitacionApi;
  /** null al invitar dos veces seguidas: es la misma invitacion y el enlace solo esta en el correo que ya salio. */
  enlace: string | null;
  correoEnviado: boolean;
}

export interface MiInvitacionApi extends InvitacionRecibidaApi {
  id: string;
}

export interface InvitacionRecibidaApi {
  hogar: string;
  invitadoPor: UsuarioApi;
  miembros: UsuarioApi[];
  email: string;
}

export interface MesApi {
  anio: number;
  mes: number;
}

export interface IngresoFijoApi {
  id: string;
  usuarioId: string;
  nombre: string;
  bruto: number;
  neto: number;
  diaPago: number;
  cuentaId: string | null;
  activo: boolean;
}

export interface ReglaDiezmoApi {
  usuarioId: string;
  activa: boolean;
  porcentaje: number;
  base: 'BRUTO' | 'NETO';
  aplicaAportes: boolean;
}

export interface CuentaApi {
  id: string;
  nombre: string;
  titularId: string | null;
  saldoCuadre: number;
  fechaCuadre: string;
  cuadrada: boolean;
  /** Orden del ultimo movimiento incluido en `saldoCuadre` (design D1 de backend-cuentas-creditos). */
  seqCuadre: number;
}

export type OrigenApi = 'CUENTA' | 'EXTERNA' | 'NINGUNO';

export interface MovimientoApi {
  id: string;
  tipo: 'INGRESO_FIJO' | 'DIEZMO_ENTREGADO' | 'APORTE' | 'PAGO' | 'GASTO' | 'AJUSTE_CUADRE' | 'TRANSFERENCIA' | 'ABONO_CREDITO';
  ref: MesApi;
  monto: number;
  fecha: string;
  usuarioId: string;
  creadoPor: string;
  cuentaId: string | null;
  ingresoFijoId: string | null;
  bruto: number | null;
  aplicaDiezmo: boolean;
  diezmoDe: string[];
  itemId: string | null;
  nota: string;
  origen: OrigenApi;
  /** TRANSFERENCIA: la cuenta a la que llega (la de origen va en `cuentaId`). */
  cuentaDestinoId: string | null;
  /** PAGO de la cuota de un credito y ABONO_CREDITO. */
  creditoId: string | null;
  /** INGRESO_FIJO: la linea de ingreso de la opcion que se recibio (design D8 de diezmo-como-gasto). */
  ingresoPlanId: string | null;
  /** PAGO de una cuota y ABONO_CREDITO: cuanto bajo el saldo del credito; null en los de antes de V9. */
  capital?: number | null;
  /** Orden de registro: el saldo estimado suma lo registrado despues del ultimo cuadre. */
  seq: number;
}

export interface CategoriaApi {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  tipo: 'DIEZMO' | 'FIJO' | 'TARJETA' | 'VARIABLE' | 'CREDITO' | 'OTRO';
  sistema: boolean;
}

export interface ItemPlanApi {
  id: string;
  categoriaId: string;
  nombre: string;
  monto: number;
  diaVence: number | null;
  tipo: 'FIJO' | 'VARIABLE' | 'CUOTA' | 'CREDITO' | 'DIEZMO';
  cuota: { actual: number; total: number } | null;
  creditoId: string | null;
  /** DIEZMO: el ingreso fijo o el aporte que lo origina (design D1 de diezmo-como-gasto). */
  ingresoFijoId: string | null;
  aporteId: string | null;
  /** DIEZMO: la linea de la opcion de la que sale y si su monto se cambio a mano (design D1 de usabilidad-plan). */
  ingresoPlanId?: string | null;
  ajustadoAMano?: boolean;
  /** La tarjeta de la que es la linea (design D1 de tarjetas-y-creditos). */
  tarjetaId?: string | null;
}

/** Linea de ingreso de una opcion (design D8 de diezmo-como-gasto). */
export interface IngresoPlanApi {
  id: string;
  nombre: string;
  monto: number;
  usuarioId: string | null;
  tipo: 'FIJO' | 'EXTRA' | 'OTRO';
  ingresoFijoId: string | null;
  bruto?: number;
}

export interface EscenarioApi {
  id: string;
  letra: string;
  creadoPor: string;
  nota: string;
  archivado: boolean;
  ingresos: IngresoPlanApi[];
  items: ItemPlanApi[];
}

export interface PlanApi {
  id: string;
  ref: MesApi;
  /** El efectivo: un Borrador con opcion elegida se lee Activo al llegar su mes. */
  estado: 'BORRADOR' | 'ACTIVO' | 'CERRADO';
  escenarioActivoId: string | null;
  escenarios: EscenarioApi[];
}

/**
 * Lo que la PWA superpone a sus datos de prueba (design D5 de backend-ingresos-diezmo y de backend-plan-mes-hoy, D2 de
 * backend-cuentas-creditos).
 */
export interface CreditoApi {
  id: string;
  nombre: string;
  entidad: string;
  saldo: number;
  saldoActualizadoEn: string;
  cuota: number;
  tasaEM: number;
  diaPago: number;
  totalOriginal: number;
  /** Los ultimos, del mas reciente al mas antiguo. */
  pagos: { fecha: string; monto: number; tipo: 'CUOTA' | 'ABONO' }[];
  /** Como baja el saldo (design D3 de tarjetas-y-creditos); sin el campo, TASA. */
  metodo?: 'TASA' | 'PLAN' | 'MANUAL';
  numeroCuotas?: number | null;
  cuotasPagadas?: number;
  valorFinanciado?: number | null;
  /** `"YYYY-MM"` (design D5 de credito-primera-cuota); sin el campo, null. */
  primeraCuota?: string | null;
}

/** Tarjeta de credito (spec steward-tarjetas): `pagoMonto` es el fijo o, si se paga completa, el estimado. */
export interface TarjetaApi {
  id: string;
  nombre: string;
  diaCorte: number;
  diaPago: number;
  uso: string;
  pagoTipo: 'COMPLETA' | 'FIJO';
  pagoMonto: number;
}

/** Al crear: `itemId` enlaza un item de Creditos del mes en curso en lugar de crear otro. */
export type TarjetaRequest = Omit<TarjetaApi, 'id'> & { itemId?: string | null };

export interface MetodoCreditoRequest {
  metodo: 'TASA' | 'PLAN' | 'MANUAL';
  saldo: number;
  cuota: number;
  tasaEM: number;
  numeroCuotas: number | null;
  cuotasPagadas: number;
  valorFinanciado: number | null;
  /** `"YYYY-MM"`; sin el campo, el backend conserva la que habia. */
  primeraCuota?: string;
}

/** La foto del cierre que guardo el backend (design D1 de backend-cierre-mes). */
export interface CierreApi {
  ref: MesApi;
  filas: { nombre: string; plan: number | null; real: number }[];
  sinRegistrar: number;
  sobrante: number;
  aAhorro: number;
  aSiguiente: number;
  cerradoPor: string;
  cerradoEn: string;
}

/** El plan anual: solo las celdas tocadas; las demas valen cero (design D5 de backend-plan-anual). */
export interface EventoAnualApi {
  id: string;
  nombre: string;
  mes: number;
  monto: number;
  tipo: 'INGRESO' | 'GASTO';
  usuarioId: string | null;
  categoriaId?: string | null;
  /** De `mes` a 12 (anual-evento-rango); el backend tambien responde `enAdelante` para la app 2.2.3. */
  hasta?: number;
  enAdelante?: boolean;
}

/** Una opcion del año: sus celdas tocadas, sus eventos y su mes base (design D2 de anual-opciones-y-meses). */
export interface OpcionAnualApi {
  id: string;
  letra: string;
  creadoPor: string;
  nota: string;
  celdas: { categoriaId: string; mes: number; monto: number }[];
  eventos: EventoAnualApi[];
  base?: { anio: number; mes: number } | null;
  /** El mes base editable (anual-mes-base-editable); null o sin el campo si la opcion no tiene. */
  mesBase?: { origen: { anio: number; mes: number } | null; items: ItemPlanApi[] } | null;
}

/** La fuente de un mes base: un mes con plan, solo fijos o desde cero. */
export type FuenteBaseApi = { tipo: 'MES'; anio: number; mes: number } | { tipo: 'FIJOS' } | { tipo: 'CERO' };

export interface AnualApi {
  anio: number;
  estado: 'BORRADOR' | 'CREADO';
  opciones: OpcionAnualApi[];
  opcionEnUso?: string | null;
}

export interface ProyeccionApi {
  usuarioId: string;
  anio: number;
  mes: number;
  monto: number;
}

export interface FinanzasApi {
  mes: MesApi;
  categorias: CategoriaApi[];
  ingresosFijos: IngresoFijoApi[];
  reglas: ReglaDiezmoApi[];
  cuentas: CuentaApi[];
  /** Desde dos meses antes del mes en curso. */
  planes: PlanApi[];
  /** Los de esos meses, mas los de antes que todavia cuentan en el saldo estimado de una cuenta. */
  movimientos: MovimientoApi[];
  creditos: CreditoApi[];
  /** Sin el campo (backend de antes de V12): ninguna. */
  tarjetas?: TarjetaApi[];
  /** Desde tres meses antes del mes en curso: el del mes anterior a los planes trae su "Sobrante de {mes}". */
  cierres: CierreApi[];
  /** Desde el año del primer mes que se lee. */
  anuales: AnualApi[];
  proyecciones: ProyeccionApi[];
}

/** El ingreso o el aporte de un diezmo los pone el backend y los conserva al editar. */
export type ItemPlanRequest = Omit<ItemPlanApi, 'id' | 'ingresoFijoId' | 'aporteId' | 'ingresoPlanId' | 'ajustadoAMano'>;

export interface IngresoPlanRequest {
  nombre: string;
  monto: number;
  usuarioId: string | null;
  bruto?: number;
  /** Solo al agregar: nace su item de diezmo enlazado. */
  aplicarDiezmo?: boolean;
}

export interface OrigenRequest {
  tipo: OrigenApi;
  cuentaId?: string;
}

export interface IngresoFijoRequest {
  nombre: string;
  bruto: number;
  neto: number;
  diaPago: number;
  cuentaId: string | null;
}

/**
 * Cliente del backend. Convierte los errores HTTP en ReglaError con el `codigo` y el `mensaje` de la API, para que
 * las pantallas los muestren igual que los del adaptador de prueba.
 */
export class Api {
  constructor(private readonly t: Transporte) {}

  config(): Promise<ConfigAcceso> {
    return this.t.pedir<ConfigAcceso>('GET', '/api/auth/config');
  }

  /** Acceso de desarrollo (solo local; el backend responde 404 si esta apagado). */
  loginDesarrollo(email: string, nombre: string): Promise<SesionApi> {
    return this.t.pedir<SesionApi>('POST', '/api/auth/dev', { email, nombre });
  }

  loginGoogle(idToken: string): Promise<SesionApi> {
    return this.t.pedir<SesionApi>('POST', '/api/auth/google', { idToken });
  }

  loginApple(identityToken: string, nombre?: string): Promise<SesionApi> {
    return this.t.pedir<SesionApi>('POST', '/api/auth/apple', { identityToken, nombre });
  }

  eliminarCuenta(appleAuthorizationCode?: string): Promise<void> {
    return this.t.pedir<void>('POST', '/api/cuenta/eliminar', { appleAuthorizationCode });
  }

  sesion(): Promise<SesionApi> {
    return this.t.pedir<SesionApi>('GET', '/api/sesion');
  }

  perfil(nombre: string): Promise<UsuarioApi> {
    return this.t.pedir<UsuarioApi>('PATCH', '/api/perfil', { nombre });
  }

  hogar(): Promise<HogarApi> {
    return this.t.pedir<HogarApi>('GET', '/api/hogar');
  }

  crearHogar(nombre: string): Promise<HogarApi> {
    return this.t.pedir<HogarApi>('POST', '/api/hogar', { nombre });
  }

  renombrarHogar(nombre: string): Promise<HogarApi> {
    return this.t.pedir<HogarApi>('PATCH', '/api/hogar', { nombre });
  }

  completarOnboarding(): Promise<void> {
    return this.t.pedir<void>('POST', '/api/hogar/onboarding-completo', null);
  }

  salir(): Promise<void> {
    return this.t.pedir<void>('DELETE', '/api/hogar/miembros/yo');
  }

  invitar(email: string): Promise<InvitacionEnviadaApi> {
    return this.t.pedir<InvitacionEnviadaApi>('POST', '/api/hogar/invitaciones', { email });
  }

  reenviar(id: string): Promise<InvitacionEnviadaApi> {
    return this.t.pedir<InvitacionEnviadaApi>('POST', `/api/hogar/invitaciones/${id}/reenviar`, null);
  }

  enlace(id: string): Promise<InvitacionEnviadaApi> {
    return this.t.pedir<InvitacionEnviadaApi>('POST', `/api/hogar/invitaciones/${id}/enlace`, null);
  }

  invitacion(token: string): Promise<InvitacionRecibidaApi> {
    return this.t.pedir<InvitacionRecibidaApi>('GET', `/api/invitaciones/${encodeURIComponent(token)}`);
  }

  /** Invitaciones pendientes para el correo de la sesion (quien entra sin el enlace). */
  misInvitaciones(): Promise<MiInvitacionApi[]> {
    return this.t.pedir<MiInvitacionApi[]>('GET', '/api/mis-invitaciones');
  }

  aceptarMia(id: string, nombre: string, diezmoAportes: boolean): Promise<SesionApi> {
    return this.t.pedir<SesionApi>('POST', `/api/mis-invitaciones/${encodeURIComponent(id)}/aceptar`, { nombre, diezmoAportes });
  }

  aceptar(token: string, nombre: string, diezmoAportes: boolean): Promise<SesionApi> {
    return this.t.pedir<SesionApi>('POST', `/api/invitaciones/${encodeURIComponent(token)}/aceptar`, { nombre, diezmoAportes });
  }

  // --- Finanzas (spec steward-finanzas) ---

  finanzas(): Promise<FinanzasApi> {
    return this.t.pedir<FinanzasApi>('GET', '/api/finanzas');
  }

  guardarRegla(regla: Omit<ReglaDiezmoApi, 'usuarioId'>): Promise<ReglaDiezmoApi> {
    return this.t.pedir<ReglaDiezmoApi>('PUT', '/api/regla-diezmo', regla);
  }

  crearIngreso(datos: IngresoFijoRequest): Promise<IngresoFijoApi> {
    return this.t.pedir<IngresoFijoApi>('POST', '/api/ingresos-fijos', datos);
  }

  editarIngreso(id: string, datos: IngresoFijoRequest): Promise<IngresoFijoApi> {
    return this.t.pedir<IngresoFijoApi>('PUT', `/api/ingresos-fijos/${encodeURIComponent(id)}`, datos);
  }

  quitarIngreso(id: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/ingresos-fijos/${encodeURIComponent(id)}`);
  }

  /** "Recibi" un ingreso fijo en un mes sin plan; sin monto, su neto. */
  recibido(ingresoId: string, monto?: number, mes?: MesApi): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('POST', `/api/ingresos-fijos/${encodeURIComponent(ingresoId)}/recibido`, monto === undefined && !mes ? null : { monto, mes });
  }

  /** "Recibi" una linea de ingreso de la opcion principal del mes en curso; sin monto, el de la linea. */
  recibirLinea(planId: string, escenarioId: string, lineaId: string, monto?: number): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('POST', `${rutaIngresos(planId, escenarioId)}/${encodeURIComponent(lineaId)}/recibido`, monto === undefined ? null : { monto });
  }

  crearCuenta(nombre: string, titular: 'YO' | 'CONJUNTA', saldo: number): Promise<CuentaApi> {
    return this.t.pedir<CuentaApi>('POST', '/api/cuentas', { nombre, titular, saldo });
  }

  /** "Eliminar crédito" (credito-escritorio-y-eliminar). */
  eliminarCredito(id: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/creditos/${encodeURIComponent(id)}`);
  }

  quitarCuenta(id: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/cuentas/${encodeURIComponent(id)}`);
  }

  // --- Plan del mes y registros de Hoy (spec steward-plan-mes y steward-finanzas) ---

  crearCategoria(nombre: string, color?: string): Promise<CategoriaApi> {
    return this.t.pedir<CategoriaApi>('POST', '/api/categorias', color ? { nombre, color } : { nombre });
  }

  /** Nombre, color o los dos (color-categorias, design D2). */
  editarCategoria(id: string, datos: { nombre?: string; color?: string }): Promise<CategoriaApi> {
    return this.t.pedir<CategoriaApi>('PATCH', `/api/categorias/${encodeURIComponent(id)}`, datos);
  }

  // --- Avisos (spec steward-avisos, "API de avisos") ---

  avisosProximos(): Promise<Aviso[]> {
    return this.t.pedir<Aviso[]>('GET', '/api/avisos/proximos');
  }

  avisosPreferencias(): Promise<PreferenciasAviso> {
    return this.t.pedir<PreferenciasAviso>('GET', '/api/avisos/preferencias');
  }

  guardarAvisosPreferencias(p: PreferenciasAviso): Promise<PreferenciasAviso> {
    return this.t.pedir<PreferenciasAviso>('PUT', '/api/avisos/preferencias', p);
  }

  registrarDispositivo(d: DispositivoAviso): Promise<void> {
    return this.t.pedir<void>('POST', '/api/avisos/dispositivos', d);
  }

  quitarDispositivo(token: string): Promise<void> {
    return this.t.pedir<void>('POST', '/api/avisos/dispositivos/quitar', { token });
  }

  probarAviso(): Promise<void> {
    return this.t.pedir<void>('POST', '/api/avisos/prueba');
  }

  responderAccionAviso(accion: string, que: 'PAGADO' | 'MANANA'): Promise<void> {
    return this.t.pedir<void>('POST', '/api/avisos/accion', { accion, que });
  }

  clavePushWeb(): Promise<{ clave: string | null }> {
    return this.t.pedir<{ clave: string | null }>('GET', '/api/avisos/clave-web');
  }

  crearPlan(ref: MesApi, modo: 'COPIAR' | 'FIJOS' | 'CERO'): Promise<PlanApi> {
    return this.t.pedir<PlanApi>('POST', '/api/planes', { anio: ref.anio, mes: ref.mes, modo });
  }

  usarOpcion(planId: string, escenarioId: string): Promise<PlanApi> {
    return this.t.pedir<PlanApi>('POST', `/api/planes/${encodeURIComponent(planId)}/usar`, { escenarioId });
  }

  crearItem(planId: string, escenarioId: string, item: ItemPlanRequest): Promise<ItemPlanApi> {
    return this.t.pedir<ItemPlanApi>('POST', `${rutaItems(planId, escenarioId)}`, item);
  }

  editarItem(planId: string, escenarioId: string, itemId: string, item: ItemPlanRequest): Promise<ItemPlanApi> {
    return this.t.pedir<ItemPlanApi>('PUT', `${rutaItems(planId, escenarioId)}/${encodeURIComponent(itemId)}`, item);
  }

  quitarItem(planId: string, escenarioId: string, itemId: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `${rutaItems(planId, escenarioId)}/${encodeURIComponent(itemId)}`);
  }

  crearIngresoPlan(planId: string, escenarioId: string, linea: IngresoPlanRequest): Promise<IngresoPlanApi> {
    return this.t.pedir<IngresoPlanApi>('POST', rutaIngresos(planId, escenarioId), linea);
  }

  editarIngresoPlan(planId: string, escenarioId: string, lineaId: string, linea: IngresoPlanRequest): Promise<IngresoPlanApi> {
    return this.t.pedir<IngresoPlanApi>('PUT', `${rutaIngresos(planId, escenarioId)}/${encodeURIComponent(lineaId)}`, linea);
  }

  quitarIngresoPlan(planId: string, escenarioId: string, lineaId: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `${rutaIngresos(planId, escenarioId)}/${encodeURIComponent(lineaId)}`);
  }

  pagar(datos: { itemId: string; monto: number; usuarioId: string; origen: OrigenRequest; mes?: MesApi }): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('POST', '/api/pagos', datos);
  }

  gastar(datos: { itemId: string | null; monto: number; nota: string; usuarioId: string; origen: OrigenRequest; mes?: MesApi }): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('POST', '/api/gastos', datos);
  }

  aportar(datos: { usuarioId: string; monto: number; mes: MesApi; cuentaId: string | null; aplicaDiezmo: boolean }): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('POST', '/api/aportes', datos);
  }

  crearAnual(anio: number): Promise<AnualApi> {
    return this.t.pedir<AnualApi>('POST', '/api/anuales', { anio });
  }

  ponerCelda(anio: number, categoriaId: string, mes: number, monto: number, opcionId?: string | null): Promise<void> {
    return this.t.pedir<void>('PUT', `/api/anuales/${anio}/celdas`, { categoriaId, mes, monto, opcionId: opcionId ?? null });
  }

  agregarEvento(anio: number, evento: Omit<EventoAnualApi, 'id'>, opcionId?: string | null): Promise<unknown> {
    return this.t.pedir('POST', `/api/anuales/${anio}/eventos`, { ...evento, opcionId: opcionId ?? null });
  }

  editarEvento(anio: number, eventoId: string, evento: Omit<EventoAnualApi, 'id'>): Promise<unknown> {
    return this.t.pedir('PUT', `/api/anuales/${anio}/eventos/${encodeURIComponent(eventoId)}`, evento);
  }

  borrarAnual(anio: number): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/anuales/${anio}`);
  }

  quitarEvento(anio: number, eventoId: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/anuales/${anio}/eventos/${encodeURIComponent(eventoId)}`);
  }

  /** "Replicar en los 12 meses": crea el anual si no existe. */
  replicar(anio: number, base: { tipo: 'MES'; anio: number; mes: number } | { tipo: 'FIJOS' } | { tipo: 'CERO' }, opcionId?: string | null): Promise<AnualApi> {
    return this.t.pedir<AnualApi>('POST', `/api/anuales/${anio}/replicar`, { ...base, opcionId: opcionId ?? null });
  }

  /** "+ Duplicar Opción X" del año (design D2 de anual-opciones-y-meses). */
  duplicarOpcionAnual(anio: number, desdeId: string): Promise<OpcionAnualApi> {
    return this.t.pedir<OpcionAnualApi>('POST', `/api/anuales/${anio}/opciones`, { desdeId });
  }

  /** "+ Nueva opción desde un mes base". */
  nuevaOpcionAnual(anio: number, desde: FuenteBaseApi): Promise<OpcionAnualApi> {
    return this.t.pedir<OpcionAnualApi>('POST', `/api/anuales/${anio}/opciones`, { desde });
  }

  copiarMesBase(anio: number, opcionId: string, desde: FuenteBaseApi): Promise<unknown> {
    return this.t.pedir('PUT', `/api/anuales/${anio}/opciones/${encodeURIComponent(opcionId)}/base`, { desde });
  }

  crearItemBase(anio: number, opcionId: string, item: ItemPlanRequest): Promise<unknown> {
    return this.t.pedir('POST', `/api/anuales/${anio}/opciones/${encodeURIComponent(opcionId)}/base/items`, item);
  }

  editarItemBase(anio: number, opcionId: string, itemId: string, item: ItemPlanRequest): Promise<unknown> {
    return this.t.pedir('PUT', `/api/anuales/${anio}/opciones/${encodeURIComponent(opcionId)}/base/items/${encodeURIComponent(itemId)}`, item);
  }

  quitarItemBase(anio: number, opcionId: string, itemId: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/anuales/${anio}/opciones/${encodeURIComponent(opcionId)}/base/items/${encodeURIComponent(itemId)}`);
  }

  usarMesBase(anio: number, opcionId: string): Promise<unknown> {
    return this.t.pedir('POST', `/api/anuales/${anio}/opciones/${encodeURIComponent(opcionId)}/base/usar`, null);
  }

  quitarOpcionAnual(anio: number, opcionId: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/anuales/${anio}/opciones/${encodeURIComponent(opcionId)}`);
  }

  /** "Meses con la Opción X": crea los meses sin plan y actualiza los de `actualizar`. Sin opcion, la en uso o la A. */
  mesesDesdeAnual(anio: number, opcionId: string | null, actualizar: number[]): Promise<{ anio: number; mes: number; accion: 'CREADO' | 'ACTUALIZADO' }[]> {
    return this.t.pedir('POST', `/api/anuales/${anio}/meses`, { opcionId, actualizar });
  }

  ponerProyeccion(anio: number, usuarioId: string, mes: number, monto: number): Promise<void> {
    return this.t.pedir<void>('PUT', `/api/anuales/${anio}/proyecciones`, { usuarioId, mes, monto });
  }


  duplicarOpcion(planId: string, desde: string): Promise<PlanApi> {
    return this.t.pedir<PlanApi>('POST', `/api/planes/${encodeURIComponent(planId)}/escenarios`, { desde });
  }

  quitarOpcion(planId: string, escenarioId: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/planes/${encodeURIComponent(planId)}/escenarios/${encodeURIComponent(escenarioId)}`);
  }

  probarAbono(creditoId: string, ref: MesApi, abono: number): Promise<{ planId: string; escenarioId: string }> {
    return this.t.pedir<{ planId: string; escenarioId: string }>('POST', `/api/creditos/${encodeURIComponent(creditoId)}/probar`, { ...ref, abono });
  }

  cerrarMes(datos: Omit<CierreApi, 'ref' | 'cerradoPor' | 'cerradoEn'> & MesApi & { ultimoSeq: number }): Promise<CierreApi> {
    return this.t.pedir<CierreApi>('POST', '/api/cierres', datos);
  }

  cuadrar(saldos: { cuentaId: string; saldoBanco: number }[]): Promise<CuentaApi[]> {
    return this.t.pedir<CuentaApi[]>('POST', '/api/cuentas/cuadre', { saldos });
  }

  transferir(datos: { desde: string; hacia: string; monto: number }): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('POST', '/api/transferencias', datos);
  }

  crearCredito(datos: Omit<CreditoApi, 'id' | 'saldoActualizadoEn' | 'pagos'>): Promise<CreditoApi> {
    return this.t.pedir<CreditoApi>('POST', '/api/creditos', datos);
  }

  cambiarMetodoCredito(id: string, datos: MetodoCreditoRequest): Promise<CreditoApi> {
    return this.t.pedir<CreditoApi>('PUT', `/api/creditos/${encodeURIComponent(id)}/metodo`, datos);
  }

  crearTarjeta(datos: TarjetaRequest): Promise<TarjetaApi> {
    return this.t.pedir<TarjetaApi>('POST', '/api/tarjetas', datos);
  }

  editarTarjeta(id: string, datos: Omit<TarjetaApi, 'id'>): Promise<TarjetaApi> {
    return this.t.pedir<TarjetaApi>('PUT', `/api/tarjetas/${encodeURIComponent(id)}`, datos);
  }

  quitarTarjeta(id: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/tarjetas/${encodeURIComponent(id)}`);
  }

  actualizarSaldoCredito(id: string, saldo: number): Promise<CreditoApi> {
    return this.t.pedir<CreditoApi>('PUT', `/api/creditos/${encodeURIComponent(id)}/saldo`, { saldo });
  }

  abonar(id: string, datos: { monto: number; usuarioId: string; origen: OrigenRequest }): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('POST', `/api/creditos/${encodeURIComponent(id)}/abonos`, datos);
  }

  recalcularDiezmo(planId: string, escenarioId: string, itemId: string): Promise<ItemPlanApi> {
    return this.t.pedir<ItemPlanApi>('POST', `${rutaItems(planId, escenarioId)}/${encodeURIComponent(itemId)}/recalcular`, {});
  }

  /** {@code mes} como 2026-10. */
  conteoBorrado(mes: string): Promise<{ pagos: number; gastos: number; ingresos: number; cerrado: boolean }> {
    return this.t.pedir<{ pagos: number; gastos: number; ingresos: number; cerrado: boolean }>('GET', `/api/meses/${encodeURIComponent(mes)}/borrado`);
  }

  borrarPlan(mes: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/meses/${encodeURIComponent(mes)}`);
  }

  empezarDeNuevo(): Promise<void> {
    return this.t.pedir<void>('POST', '/api/hogar/empezar-de-nuevo', {});
  }

  corregirRegistro(id: string, datos: { monto?: number; origen?: OrigenRequest; nota?: string }): Promise<MovimientoApi> {
    return this.t.pedir<MovimientoApi>('PATCH', `/api/registros/${encodeURIComponent(id)}`, datos);
  }

  borrarRegistro(id: string): Promise<void> {
    return this.t.pedir<void>('DELETE', `/api/registros/${encodeURIComponent(id)}`);
  }
}

/** El error del backend como ReglaError, con su `codigo` y su `mensaje`; status 0 es sin conexion. */
export function errorDeApi(status: number, error: unknown): ReglaError {
  const cuerpo = (error ?? {}) as { codigo?: string; mensaje?: string; campos?: Record<string, string> };
  if (status === 0) return new ReglaError('SIN_CONEXION', 'No hay conexión con el servidor. Intenta de nuevo.');
  const primerCampo = cuerpo.campos ? Object.values(cuerpo.campos)[0] : undefined;
  return new ReglaError(cuerpo.codigo ?? `HTTP_${status}`, primerCampo ?? cuerpo.mensaje ?? 'Algo salió mal. Intenta de nuevo.', {
    status,
    campos: cuerpo.campos ?? {},
  });
}

function rutaItems(planId: string, escenarioId: string): string {
  return `/api/planes/${encodeURIComponent(planId)}/escenarios/${encodeURIComponent(escenarioId)}/items`;
}

export function usuarioDe(u: UsuarioApi): Usuario {
  return { id: u.id, nombre: u.nombre, email: u.email, inicial: u.inicial };
}

function rutaIngresos(planId: string, escenarioId: string): string {
  return `/api/planes/${encodeURIComponent(planId)}/escenarios/${encodeURIComponent(escenarioId)}/ingresos`;
}
