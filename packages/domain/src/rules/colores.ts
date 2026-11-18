// Colores de categoria de "Libreta clara" (spec steward-ajustes, "Categorías"; rediseno-libreta-clara y color-categorias).
import type { Categoria, TipoCategoria } from '../model';

/** El color inicial de cada categoria del sistema. */
export const COLOR_CATEGORIA: Record<Exclude<TipoCategoria, 'OTRO'>, string> = {
  DIEZMO: '#2C7A70',
  FIJO: '#C2603A',
  VARIABLE: '#8A8D85',
  TARJETA: '#6B5BA8',
  CREDITO: '#6B5BA8',
};

/** El grupo de ingresos del plan, que no es una categoria. */
export const COLOR_INGRESOS = '#2F7A4F';

/** El color de una categoria nueva si no se elige otro. */
export const COLOR_NUEVA = '#8A8D85';

/** Los colores que se pueden elegir para una categoria, con su nombre para lectores de pantalla (design D1 y D4). */
export const PALETA_CATEGORIAS: readonly { color: string; nombre: string }[] = [
  { color: '#C2603A', nombre: 'Terracota' },
  { color: '#8A8D85', nombre: 'Gris' },
  { color: '#6B5BA8', nombre: 'Morado' },
  { color: '#3F6E9E', nombre: 'Azul' },
  { color: '#2C7A70', nombre: 'Verde azulado' },
  { color: '#A87A1E', nombre: 'Ocre' },
  { color: '#9A4F7E', nombre: 'Ciruela' },
  { color: '#5E7D32', nombre: 'Oliva' },
  { color: '#55687A', nombre: 'Pizarra' },
  { color: '#8A6446', nombre: 'Café' },
];

/** El color de la paleta, en su forma canonica, o null si no esta en ella (sin importar mayusculas). */
export function colorDePaleta(color: string): string | null {
  const c = color.trim().toUpperCase();
  return PALETA_CATEGORIAS.find((p) => p.color === c)?.color ?? null;
}

/** Colores del diseño anterior que pasan a los de Libreta clara, por tipo (design D3); 'OTRO' son las propias. */
const VIEJOS: Record<TipoCategoria, Record<string, string>> = {
  DIEZMO: { '#0F766E': '#2C7A70' },
  FIJO: { '#E2551B': '#C2603A' },
  VARIABLE: { '#8D8F88': '#8A8D85' },
  TARJETA: { '#7C4DDB': '#6B5BA8' },
  CREDITO: { '#2E6B45': '#6B5BA8', '#7C4DDB': '#6B5BA8' },
  OTRO: { '#8D8F88': '#8A8D85', '#1E5A4C': '#3F6E9E' },
};

/** Las categorias con los colores del diseño anterior pasados a Libreta clara; los que eligio el hogar no cambian. */
export function migrarColores<T extends Pick<Categoria, 'tipo' | 'sistema' | 'color'>>(categorias: T[]): T[] {
  return categorias.map((c) => {
    const tabla = c.sistema || c.tipo === 'OTRO' ? VIEJOS[c.tipo] : {};
    const nuevo = tabla[c.color.toUpperCase()];
    return nuevo ? { ...c, color: nuevo } : c;
  });
}
