import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { Puertos } from '@steward/domain';
import { crearAdaptadorDemo, storageEnMemoria, type StorageLike } from '@steward/domain/demo';

/**
 * Los puertos de datos de la app (design D2). Las pantallas solo inyectan este token; cual adaptador lo cumple
 * se decide aqui. Hoy: el de prueba. Con backend: uno HTTP que cumpla `Puertos`, sin tocar las pantallas.
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
