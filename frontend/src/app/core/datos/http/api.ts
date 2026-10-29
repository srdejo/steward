import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ReglaError, type Usuario } from '@steward/domain';
import { firstValueFrom, type Observable } from 'rxjs';

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
  enlace: string;
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
  /** Orden de registro: el saldo estimado suma lo registrado despues del ultimo cuadre. */
  seq: number;
}

export interface CategoriaApi {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  tipo: 'FIJO' | 'TARJETA' | 'VARIABLE' | 'CREDITO' | 'OTRO';
  sistema: boolean;
}

export interface ItemPlanApi {
  id: string;
  categoriaId: string;
  nombre: string;
  monto: number;
  diaVence: number | null;
  tipo: 'FIJO' | 'VARIABLE' | 'CUOTA' | 'CREDITO';
  cuota: { actual: number; total: number } | null;
  creditoId: string | null;
}

export interface EscenarioApi {
  id: string;
  letra: string;
  creadoPor: string;
  nota: string;
  archivado: boolean;
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

export interface FinanzasApi {
  mes: MesApi;
  diezmoEnHoy: 'SEPARADO' | 'AGRUPADO';
  categorias: CategoriaApi[];
  ingresosFijos: IngresoFijoApi[];
  reglas: ReglaDiezmoApi[];
  cuentas: CuentaApi[];
  /** Desde dos meses antes del mes en curso. */
  planes: PlanApi[];
  /** Los de esos meses, mas los de antes que todavia cuentan en el saldo estimado de una cuenta. */
  movimientos: MovimientoApi[];
  creditos: CreditoApi[];
  /** Desde tres meses antes del mes en curso: el del mes anterior a los planes trae su "Sobrante de {mes}". */
  cierres: CierreApi[];
}

export type ItemPlanRequest = Omit<ItemPlanApi, 'id'>;

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
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  config(): Promise<ConfigAcceso> {
    return this.pedir(this.http.get<ConfigAcceso>('/api/auth/config'));
  }

  /** Acceso de desarrollo (solo local; el backend responde 404 si esta apagado). */
  loginDesarrollo(email: string, nombre: string): Promise<SesionApi> {
    return this.pedir(this.http.post<SesionApi>('/api/auth/dev', { email, nombre }));
  }

  loginGoogle(idToken: string): Promise<SesionApi> {
    return this.pedir(this.http.post<SesionApi>('/api/auth/google', { idToken }));
  }

  sesion(): Promise<SesionApi> {
    return this.pedir(this.http.get<SesionApi>('/api/sesion'));
  }

  perfil(nombre: string): Promise<UsuarioApi> {
    return this.pedir(this.http.patch<UsuarioApi>('/api/perfil', { nombre }));
  }

  hogar(): Promise<HogarApi> {
    return this.pedir(this.http.get<HogarApi>('/api/hogar'));
  }

  crearHogar(nombre: string): Promise<HogarApi> {
    return this.pedir(this.http.post<HogarApi>('/api/hogar', { nombre }));
  }

  renombrarHogar(nombre: string): Promise<HogarApi> {
    return this.pedir(this.http.patch<HogarApi>('/api/hogar', { nombre }));
  }

  completarOnboarding(): Promise<void> {
    return this.pedir(this.http.post<void>('/api/hogar/onboarding-completo', null));
  }

  salir(): Promise<void> {
    return this.pedir(this.http.delete<void>('/api/hogar/miembros/yo'));
  }

  invitar(email: string): Promise<InvitacionEnviadaApi> {
    return this.pedir(this.http.post<InvitacionEnviadaApi>('/api/hogar/invitaciones', { email }));
  }

  reenviar(id: string): Promise<InvitacionEnviadaApi> {
    return this.pedir(this.http.post<InvitacionEnviadaApi>(`/api/hogar/invitaciones/${id}/reenviar`, null));
  }

  enlace(id: string): Promise<InvitacionEnviadaApi> {
    return this.pedir(this.http.post<InvitacionEnviadaApi>(`/api/hogar/invitaciones/${id}/enlace`, null));
  }

  invitacion(token: string): Promise<InvitacionRecibidaApi> {
    return this.pedir(this.http.get<InvitacionRecibidaApi>(`/api/invitaciones/${encodeURIComponent(token)}`));
  }

  /** Invitaciones pendientes para el correo de la sesion (quien entra sin el enlace). */
  misInvitaciones(): Promise<MiInvitacionApi[]> {
    return this.pedir(this.http.get<MiInvitacionApi[]>('/api/mis-invitaciones'));
  }

  aceptarMia(id: string, nombre: string, diezmoAportes: boolean): Promise<SesionApi> {
    return this.pedir(this.http.post<SesionApi>(`/api/mis-invitaciones/${encodeURIComponent(id)}/aceptar`, { nombre, diezmoAportes }));
  }

  aceptar(token: string, nombre: string, diezmoAportes: boolean): Promise<SesionApi> {
    return this.pedir(this.http.post<SesionApi>(`/api/invitaciones/${encodeURIComponent(token)}/aceptar`, { nombre, diezmoAportes }));
  }

  // --- Finanzas (spec steward-finanzas) ---

  finanzas(): Promise<FinanzasApi> {
    return this.pedir(this.http.get<FinanzasApi>('/api/finanzas'));
  }

  guardarRegla(regla: Omit<ReglaDiezmoApi, 'usuarioId'>): Promise<ReglaDiezmoApi> {
    return this.pedir(this.http.put<ReglaDiezmoApi>('/api/regla-diezmo', regla));
  }

  crearIngreso(datos: IngresoFijoRequest): Promise<IngresoFijoApi> {
    return this.pedir(this.http.post<IngresoFijoApi>('/api/ingresos-fijos', datos));
  }

  editarIngreso(id: string, datos: IngresoFijoRequest): Promise<IngresoFijoApi> {
    return this.pedir(this.http.put<IngresoFijoApi>(`/api/ingresos-fijos/${encodeURIComponent(id)}`, datos));
  }

  quitarIngreso(id: string): Promise<void> {
    return this.pedir(this.http.delete<void>(`/api/ingresos-fijos/${encodeURIComponent(id)}`));
  }

  recibido(ingresoId: string): Promise<MovimientoApi> {
    return this.pedir(this.http.post<MovimientoApi>(`/api/ingresos-fijos/${encodeURIComponent(ingresoId)}/recibido`, null));
  }

  entregarDiezmo(obligaciones: string[], cuentaId: string | null): Promise<MovimientoApi> {
    return this.pedir(this.http.post<MovimientoApi>('/api/diezmo/entregas', { obligaciones, cuentaId }));
  }

  definirDiezmoEnHoy(modo: 'SEPARADO' | 'AGRUPADO'): Promise<void> {
    return this.pedir(this.http.put<void>('/api/hogar/diezmo-en-hoy', { modo }));
  }

  crearCuenta(nombre: string, titular: 'YO' | 'CONJUNTA', saldo: number): Promise<CuentaApi> {
    return this.pedir(this.http.post<CuentaApi>('/api/cuentas', { nombre, titular, saldo }));
  }

  // --- Plan del mes y registros de Hoy (spec steward-plan-mes y steward-finanzas) ---

  crearCategoria(nombre: string): Promise<CategoriaApi> {
    return this.pedir(this.http.post<CategoriaApi>('/api/categorias', { nombre }));
  }

  renombrarCategoria(id: string, nombre: string): Promise<CategoriaApi> {
    return this.pedir(this.http.patch<CategoriaApi>(`/api/categorias/${encodeURIComponent(id)}`, { nombre }));
  }

  crearPlan(ref: MesApi, modo: 'COPIAR' | 'FIJOS' | 'CERO'): Promise<PlanApi> {
    return this.pedir(this.http.post<PlanApi>('/api/planes', { anio: ref.anio, mes: ref.mes, modo }));
  }

  usarOpcion(planId: string, escenarioId: string): Promise<PlanApi> {
    return this.pedir(this.http.post<PlanApi>(`/api/planes/${encodeURIComponent(planId)}/usar`, { escenarioId }));
  }

  crearItem(planId: string, escenarioId: string, item: ItemPlanRequest): Promise<ItemPlanApi> {
    return this.pedir(this.http.post<ItemPlanApi>(`${rutaItems(planId, escenarioId)}`, item));
  }

  editarItem(planId: string, escenarioId: string, itemId: string, item: ItemPlanRequest): Promise<ItemPlanApi> {
    return this.pedir(this.http.put<ItemPlanApi>(`${rutaItems(planId, escenarioId)}/${encodeURIComponent(itemId)}`, item));
  }

  quitarItem(planId: string, escenarioId: string, itemId: string): Promise<void> {
    return this.pedir(this.http.delete<void>(`${rutaItems(planId, escenarioId)}/${encodeURIComponent(itemId)}`));
  }

  pagar(datos: { itemId: string; monto: number; usuarioId: string; origen: OrigenRequest }): Promise<MovimientoApi> {
    return this.pedir(this.http.post<MovimientoApi>('/api/pagos', datos));
  }

  gastar(datos: { itemId: string | null; monto: number; nota: string; usuarioId: string; origen: OrigenRequest }): Promise<MovimientoApi> {
    return this.pedir(this.http.post<MovimientoApi>('/api/gastos', datos));
  }

  aportar(datos: { usuarioId: string; monto: number; mes: MesApi; cuentaId: string | null; aplicaDiezmo: boolean }): Promise<MovimientoApi> {
    return this.pedir(this.http.post<MovimientoApi>('/api/aportes', datos));
  }

  duplicarOpcion(planId: string, desde: string): Promise<PlanApi> {
    return this.pedir(this.http.post<PlanApi>(`/api/planes/${encodeURIComponent(planId)}/escenarios`, { desde }));
  }

  quitarOpcion(planId: string, escenarioId: string): Promise<void> {
    return this.pedir(this.http.delete<void>(`/api/planes/${encodeURIComponent(planId)}/escenarios/${encodeURIComponent(escenarioId)}`));
  }

  probarAbono(creditoId: string, ref: MesApi, abono: number): Promise<{ planId: string; escenarioId: string }> {
    return this.pedir(this.http.post<{ planId: string; escenarioId: string }>(`/api/creditos/${encodeURIComponent(creditoId)}/probar`, { ...ref, abono }));
  }

  cerrarMes(datos: Omit<CierreApi, 'ref' | 'cerradoPor' | 'cerradoEn'> & MesApi & { ultimoSeq: number }): Promise<CierreApi> {
    return this.pedir(this.http.post<CierreApi>('/api/cierres', datos));
  }

  cuadrar(saldos: { cuentaId: string; saldoBanco: number }[]): Promise<CuentaApi[]> {
    return this.pedir(this.http.post<CuentaApi[]>('/api/cuentas/cuadre', { saldos }));
  }

  transferir(datos: { desde: string; hacia: string; monto: number }): Promise<MovimientoApi> {
    return this.pedir(this.http.post<MovimientoApi>('/api/transferencias', datos));
  }

  crearCredito(datos: Omit<CreditoApi, 'id' | 'saldoActualizadoEn' | 'pagos'>): Promise<CreditoApi> {
    return this.pedir(this.http.post<CreditoApi>('/api/creditos', datos));
  }

  actualizarSaldoCredito(id: string, saldo: number): Promise<CreditoApi> {
    return this.pedir(this.http.put<CreditoApi>(`/api/creditos/${encodeURIComponent(id)}/saldo`, { saldo }));
  }

  abonar(id: string, datos: { monto: number; usuarioId: string; origen: OrigenRequest }): Promise<MovimientoApi> {
    return this.pedir(this.http.post<MovimientoApi>(`/api/creditos/${encodeURIComponent(id)}/abonos`, datos));
  }

  private async pedir<T>(peticion: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion);
    } catch (e) {
      throw aReglaError(e);
    }
  }
}

export function aReglaError(e: unknown): unknown {
  if (!(e instanceof HttpErrorResponse)) return e;
  const cuerpo = (e.error ?? {}) as { codigo?: string; mensaje?: string; campos?: Record<string, string> };
  if (e.status === 0) return new ReglaError('SIN_CONEXION', 'No hay conexión con el servidor. Intenta de nuevo.');
  const primerCampo = cuerpo.campos ? Object.values(cuerpo.campos)[0] : undefined;
  return new ReglaError(cuerpo.codigo ?? `HTTP_${e.status}`, primerCampo ?? cuerpo.mensaje ?? 'Algo salió mal. Intenta de nuevo.', {
    status: e.status,
    campos: cuerpo.campos ?? {},
  });
}

function rutaItems(planId: string, escenarioId: string): string {
  return `/api/planes/${encodeURIComponent(planId)}/escenarios/${encodeURIComponent(escenarioId)}/items`;
}

export function usuarioDe(u: UsuarioApi): Usuario {
  return { id: u.id, nombre: u.nombre, email: u.email, inicial: u.inicial };
}
