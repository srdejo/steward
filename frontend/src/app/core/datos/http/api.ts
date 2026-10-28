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

export function usuarioDe(u: UsuarioApi): Usuario {
  return { id: u.id, nombre: u.nombre, email: u.email, inicial: u.inicial };
}
