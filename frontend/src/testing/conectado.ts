import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { storageEnMemoria } from '@steward/domain/demo';

import { routes } from '../app/app.routes';
import { authInterceptor } from '../app/core/datos/http/auth.interceptor';
import { providePuertosConectados } from '../app/core/datos/puertos';
import { GOOGLE_IDENTITY_LOADER, type GoogleAccountsId } from '../app/core/sesion/google-identity';
import { AHORA } from './demo';

/** Doble de Google Identity Services: guarda el callback para simular que la persona eligio su cuenta. */
export class GoogleDePrueba implements GoogleAccountsId {
  callback: ((r: { credential: string }) => void) | null = null;
  clientId = '';
  botones = 0;

  initialize(options: { client_id: string; callback: (r: { credential: string }) => void }): void {
    this.clientId = options.client_id;
    this.callback = options.callback;
  }

  renderButton(parent: HTMLElement): void {
    this.botones++;
    parent.textContent = 'Botón de Google';
  }

  elegirCuenta(credential = 'id-token-de-google'): void {
    this.callback?.({ credential });
  }
}

/** La app en modo conectado: HTTP de prueba, Google de prueba y los datos de prueba en memoria. */
export function provideConectadoPrueba(google = new GoogleDePrueba()): (EnvironmentProviders | Provider)[] {
  return [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideHttpClientTesting(),
    providePuertosConectados({ storage: storageEnMemoria(), ahora: AHORA }),
    { provide: GOOGLE_IDENTITY_LOADER, useValue: () => Promise.resolve(google) },
  ];
}

export function http(): HttpTestingController {
  return TestBed.inject(HttpTestingController);
}

/**
 * Responde la siguiente peticion a `metodo url` cuando aparezca (las pantallas la hacen tras varios await).
 * `estable` es el del harness, para dejar correr la app entre intentos.
 */
export async function responder(metodo: string, url: string, cuerpo: object | null, estable: () => Promise<void>, status = 200): Promise<TestRequest> {
  for (let i = 0; i < 20; i++) {
    const pendientes = http().match((r) => r.method === metodo && r.url === url);
    if (pendientes.length) {
      const req = pendientes[0]!;
      req.flush(cuerpo, { status, statusText: status >= 400 ? 'Error' : 'OK' });
      await estable();
      return req;
    }
    await estable();
  }
  throw new Error(`No llegó ${metodo} ${url}`);
}

export const USUARIO = { id: 'u-real-1', nombre: 'Ana María', email: 'ana@ejemplo.com', inicial: 'A' };

export function hogarApi(extra: Partial<{ nombre: string; configurado: boolean; invitaciones: unknown[] }> = {}) {
  return {
    id: 'h-1',
    nombre: extra.nombre ?? 'Nuestra casa',
    configurado: extra.configurado ?? false,
    miembros: [{ usuario: USUARIO, unidoEn: '2026-10-26', esActual: true }],
    invitaciones: extra.invitaciones ?? [],
  };
}
