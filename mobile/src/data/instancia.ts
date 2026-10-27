import type { Puertos } from '@steward/domain';

import { crearPuertosDemo } from './puertos';

let actual: Puertos | null = null;

/** Los puertos de la app (uno por proceso). Con backend, aqui se crea el adaptador HTTP en lugar del demo. */
export function puertosDeLaApp(): Puertos {
  actual ??= crearPuertosDemo();
  return actual;
}

/** Para pruebas: un adaptador con storage en memoria y reloj fijo. */
export function reemplazarPuertos(p: Puertos): void {
  actual = p;
}
