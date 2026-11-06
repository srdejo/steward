import type { Puertos } from '@steward/domain';

import { crearPuertosConectados } from './conectado';

let actual: Puertos | null = null;

/** Los puertos ya creados, si los hay. */
export function puertosListos(): Puertos | null {
  return actual;
}

/** Los puertos de la app (uno por proceso), conectados al backend: esperan a leer la sesion del Keychain. */
export async function prepararPuertos(): Promise<Puertos> {
  actual ??= await crearPuertosConectados();
  return actual;
}

/** Para pruebas: un adaptador con storage en memoria y reloj fijo. */
export function reemplazarPuertos(p: Puertos): void {
  actual = p;
}
