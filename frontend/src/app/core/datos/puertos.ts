import { EnvironmentProviders, InjectionToken, inject, makeEnvironmentProviders } from '@angular/core';
import type { Puertos } from '@steward/domain';
import { crearAdaptadorDemo, storageEnMemoria, type StorageLike } from '@steward/domain/demo';

import { Api } from './http/api';
import { PuertosConectados } from './http/puertos-conectados';
import { TokenSesion } from './http/token-sesion';

/**
 * Los puertos de datos de la app (design D2). Las pantallas solo inyectan este token; cual adaptador lo cumple
 * se decide aqui: el de prueba (modo demo) o el compuesto HTTP + prueba (modo conectado, design D9).
 */
export const PUERTOS = new InjectionToken<Puertos>('PUERTOS');

/** localStorage si existe y responde; si no (modo privado, previews), memoria. */
function storageDelNavegador(): StorageLike {
  try {
    const prueba = '__steward__';
    window.localStorage.setItem(prueba, prueba);
    window.localStorage.removeItem(prueba);
    return window.localStorage;
  } catch {
    return storageEnMemoria();
  }
}

export function providePuertosDemo(opciones: { storage?: StorageLike; ahora?: () => Date } = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: PUERTOS, useFactory: () => crearAdaptadorDemo({ storage: opciones.storage ?? storageDelNavegador(), ahora: opciones.ahora }) },
  ]);
}

/** Modo conectado: requiere provideHttpClient con el authInterceptor. */
export function providePuertosConectados(opciones: { storage?: StorageLike; ahora?: () => Date } = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: PUERTOS,
      useFactory: () =>
        new PuertosConectados({
          api: inject(Api),
          tokens: inject(TokenSesion),
          storage: opciones.storage ?? storageDelNavegador(),
          ahora: opciones.ahora,
        }),
    },
  ]);
}

/** En modo conectado, los puertos compuestos (para el login con Google); en demo, null. */
export function puertosConectados(puertos: Puertos): PuertosConectados | null {
  return puertos instanceof PuertosConectados ? puertos : null;
}
