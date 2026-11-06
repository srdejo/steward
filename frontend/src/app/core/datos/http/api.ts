import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Api as ApiConectada, errorDeApi, type MetodoHttp, type Transporte } from '@steward/domain/conectado';
import { firstValueFrom } from 'rxjs';

export type * from '@steward/domain/conectado';

/** Convierte los errores HTTP en ReglaError, para que las pantallas los muestren igual que los del adaptador de prueba. */
export function aReglaError(e: unknown): unknown {
  return e instanceof HttpErrorResponse ? errorDeApi(e.status, e.error) : e;
}

/** La PWA llega al backend con HttpClient: el authInterceptor agrega la sesion. */
class TransporteHttp implements Transporte {
  constructor(private readonly http: HttpClient) {}

  async pedir<T>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(metodo, ruta, { body: cuerpo }));
    } catch (e) {
      throw aReglaError(e);
    }
  }
}

@Injectable({ providedIn: 'root' })
export class Api extends ApiConectada {
  constructor() {
    super(new TransporteHttp(inject(HttpClient)));
  }
}
