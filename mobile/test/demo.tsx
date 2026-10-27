import type { Puertos } from '@steward/domain';
import { crearAdaptadorDemo, storageEnMemoria } from '@steward/domain/demo';

import { reemplazarPuertos } from '@/data/instancia';

/** Reloj de los artboards: lunes 26 de octubre de 2026 (las mismas cifras que los tests de la PWA). */
export const AHORA = () => new Date(2026, 9, 26, 10, 0, 0);
export const OCT = { anio: 2026, mes: 10 };
export const NOV = { anio: 2026, mes: 11 };

/** Adaptador de prueba con storage en memoria; queda como el de la app (`puertosDeLaApp`). */
export function puertosDePrueba(): Puertos {
  const p = crearAdaptadorDemo({ storage: storageEnMemoria(), ahora: AHORA });
  reemplazarPuertos(p);
  return p;
}

export async function conSesion(): Promise<Puertos> {
  const p = puertosDePrueba();
  await p.sesion.iniciar('GOOGLE');
  return p;
}
