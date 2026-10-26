import { Injectable, computed } from '@angular/core';
import type { Id } from '@steward/domain';

import { consulta } from '../datos/consulta';

/** Miembros del hogar con su variante de avatar (el primero fuerte, los demas suaves). Uso en toda la app. */
@Injectable({ providedIn: 'root' })
export class MiembrosHogar {
  readonly hogar = consulta(() => null, (p) => p.hogar.obtener());

  readonly miembros = computed(() =>
    (this.hogar.value()?.miembros ?? []).map((m, i) => ({ ...m, variante: (i === 0 ? 'fuerte' : 'suave') as 'fuerte' | 'suave' })),
  );

  varianteDe(usuarioId: Id | null): 'fuerte' | 'suave' {
    return this.miembros().find((m) => m.usuario.id === usuarioId)?.variante ?? 'suave';
  }

  inicialDe(usuarioId: Id | null): string {
    return this.miembros().find((m) => m.usuario.id === usuarioId)?.usuario.inicial ?? '?';
  }

  nombreDe(usuarioId: Id | null): string {
    return this.miembros().find((m) => m.usuario.id === usuarioId)?.usuario.nombre ?? '';
  }
}
