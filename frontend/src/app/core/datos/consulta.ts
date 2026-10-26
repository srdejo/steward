import { DestroyRef, Injectable, inject, resource, signal, type ResourceRef } from '@angular/core';
import { ReglaError, type Puertos } from '@steward/domain';

import { PUERTOS } from './puertos';

/** Cuenta las escrituras del adaptador: cada consulta la lee para recargarse sola tras un cambio. */
@Injectable({ providedIn: 'root' })
export class CambiosDeDatos {
  private readonly contador = signal(0);
  readonly version = this.contador.asReadonly();

  constructor() {
    const puertos = inject(PUERTOS);
    const dejar = puertos.suscribir(() => this.contador.update((v) => v + 1));
    inject(DestroyRef).onDestroy(dejar);
  }
}

/**
 * Lectura de un puerto como `resource`: se recarga cuando cambian los parametros o cuando el adaptador avisa
 * de una escritura. Se llama en contexto de inyeccion (campo de un componente).
 */
export function consulta<P, T>(params: () => P, loader: (puertos: Puertos, params: P) => Promise<T>): ResourceRef<T | undefined> {
  const puertos = inject(PUERTOS);
  const cambios = inject(CambiosDeDatos);
  return resource({
    params: () => ({ valor: params(), version: cambios.version() }),
    loader: ({ params: p }) => loader(puertos, p.valor),
  });
}

/** Mensaje para mostrar de un error del adaptador (las reglas traen texto listo; lo demas es tecnico). */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ReglaError) return error.message;
  if (error instanceof Error && error.name === 'ReglaError') return error.message;
  return 'No se pudo guardar. Intenta de nuevo.';
}
