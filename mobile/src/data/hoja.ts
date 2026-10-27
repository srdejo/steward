import type { Id, Origen } from '@steward/domain';

import type { Opcion } from '@/ui';
import { useMiembros } from './miembros';
import { useConsulta } from './puertos';

/** Valor de "Desde" / "¿Dónde quedó?": una cuenta del hogar o "Su cuenta" (fuera de la app). */
export const SU_CUENTA = '__externa__';

/** Lo comun de las hojas de Hoy: personas, cuentas como chips y el origen del dinero. */
export function useOpcionesHoja() {
  const miembros = useMiembros();
  const cuentas = useConsulta(['cuentas', 'TODAS'], (p) => p.cuentas.cuentas());
  const personas: Opcion<Id>[] = miembros.miembros.map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre }));
  const iniciales: Opcion<Id>[] = miembros.miembros.map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.inicial }));
  const desde: Opcion<string>[] = [...(cuentas.data?.cuentas ?? []).map((c) => ({ valor: c.cuenta.id, etiqueta: c.cuenta.nombre })), { valor: SU_CUENTA, etiqueta: 'Su cuenta' }];
  return {
    miembros,
    personas,
    iniciales,
    desde,
    origen(valor: string | null): Origen {
      if (valor === SU_CUENTA) return { tipo: 'EXTERNA' };
      return valor ? { tipo: 'CUENTA', cuentaId: valor } : { tipo: 'NINGUNO' };
    },
  };
}
