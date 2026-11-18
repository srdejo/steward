import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Id } from '@steward/domain';

export type TipoAgregar = 'gasto' | 'aporte' | 'pago';

/** Los parametros de la URL que abren Agregar sobre cualquier pantalla. */
export const PARAM_AGREGAR = 'agregar';
export const PARAM_ITEM = 'item';

/**
 * Abre y cierra la hoja Agregar sobre la pantalla actual (spec steward-hoy, "Agregar desde un solo botón"; design D3 de
 * rediseno-libreta-clara). Se abre con `?agregar=gasto|aporte|pago&item=<id>` en la URL actual, y al cerrarse esos
 * parametros se quitan: guardar deja al usuario donde estaba.
 */
@Injectable({ providedIn: 'root' })
export class Agregar {
  private readonly router = inject(Router);

  abrir(tipo: TipoAgregar = 'gasto', item: Id | null = null): Promise<boolean> {
    const arbol = this.router.parseUrl(this.router.url);
    const params: Record<string, string> = { ...arbol.queryParams, [PARAM_AGREGAR]: tipo };
    delete params[PARAM_ITEM];
    if (item) params[PARAM_ITEM] = item;
    arbol.queryParams = params;
    return this.router.navigateByUrl(arbol);
  }

  cerrar(): Promise<boolean> {
    const arbol = this.router.parseUrl(this.router.url);
    const { [PARAM_AGREGAR]: _a, [PARAM_ITEM]: _i, ...resto } = arbol.queryParams;
    arbol.queryParams = resto;
    return this.router.navigateByUrl(arbol);
  }
}

/** Valida el tipo que viene en la URL. */
export function tipoAgregar(valor: unknown): TipoAgregar | null {
  return valor === 'gasto' || valor === 'aporte' || valor === 'pago' ? valor : null;
}
