import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Id, Origen } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { MiembrosHogar } from '../../core/layout/miembros';
import type { Opcion } from '../../shared/components/segmentado';

/** Valor de "Desde" / "¿Dónde quedó?": una cuenta del hogar o "Su cuenta" (fuera de la app). */
export const SU_CUENTA = '__externa__';

/** Lo comun de las tres hojas de Hoy: miembros, cuentas como chips y cerrar volviendo a Hoy. */
export function opcionesDeHoja() {
  const router = inject(Router);
  const miembros = inject(MiembrosHogar);
  const cuentas = consulta(() => null, (p) => p.cuentas.cuentas());

  const personas = computed<Opcion<Id>[]>(() => miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre })));
  const iniciales = computed<Opcion<Id>[]>(() => miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.inicial })));
  const desde = computed<Opcion<string>[]>(() => [
    ...(cuentas.value()?.cuentas ?? []).map((c) => ({ valor: c.cuenta.id, etiqueta: c.cuenta.nombre })),
    { valor: SU_CUENTA, etiqueta: 'Su cuenta' },
  ]);

  return {
    miembros,
    personas,
    iniciales,
    desde,
    cerrar: () => router.navigate(['/hoy']),
    origen(valor: string | null): Origen {
      if (valor === SU_CUENTA) return { tipo: 'EXTERNA' };
      return valor ? { tipo: 'CUENTA', cuentaId: valor } : { tipo: 'NINGUNO' };
    },
  };
}
