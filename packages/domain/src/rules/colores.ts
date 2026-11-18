// Colores de categoria del sistema "Libreta clara" (spec steward-ui-shell, "Fidelidad al diseño"; rediseno-libreta-clara).
import type { Categoria, TipoCategoria } from '../model';

/** Cada categoria del sistema con el mismo color en todas las pantallas. */
export const COLOR_CATEGORIA: Record<Exclude<TipoCategoria, 'OTRO'>, string> = {
  DIEZMO: '#2C7A70',
  FIJO: '#C2603A',
  VARIABLE: '#8A8D85',
  TARJETA: '#6B5BA8',
  CREDITO: '#6B5BA8',
};

/** El grupo de ingresos del plan, que no es una categoria. */
export const COLOR_INGRESOS = '#2F7A4F';

/**
 * El color con que se ve una categoria: las del sistema toman el de su tipo, aunque el backend o un estado guardado
 * traigan el del diseño anterior; las propias conservan el que se les eligio.
 */
export function colorCategoria(c: Pick<Categoria, 'tipo' | 'sistema' | 'color'>): string {
  return c.sistema && c.tipo !== 'OTRO' ? COLOR_CATEGORIA[c.tipo] : c.color;
}

/** Las categorias con su color de "Libreta clara". */
export function conColoresDelSistema<T extends Pick<Categoria, 'tipo' | 'sistema' | 'color'>>(categorias: T[]): T[] {
  return categorias.map((c) => ({ ...c, color: colorCategoria(c) }));
}
