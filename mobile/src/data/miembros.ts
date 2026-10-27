import type { Id } from '@steward/domain';

import { useConsulta } from './puertos';

/** Miembros del hogar con su variante de avatar (el primero fuerte, los demas suaves), como en la PWA. */
export function useMiembros() {
  const hogar = useConsulta(['hogar'], (p) => p.hogar.obtener());
  const miembros = (hogar.data?.miembros ?? []).map((m, i) => ({ ...m, variante: (i === 0 ? 'fuerte' : 'suave') as 'fuerte' | 'suave' }));
  const buscar = (id: Id | null) => miembros.find((m) => m.usuario.id === id);
  return {
    hogar: hogar.data,
    miembros,
    varianteDe: (id: Id | null) => buscar(id)?.variante ?? 'suave',
    inicialDe: (id: Id | null) => buscar(id)?.usuario.inicial ?? '?',
    nombreDe: (id: Id | null) => buscar(id)?.usuario.nombre ?? '',
  };
}
