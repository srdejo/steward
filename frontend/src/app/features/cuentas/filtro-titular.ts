import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import type { FiltroTitular } from '@steward/domain';

import { MiembrosHogar } from '../../core/layout/miembros';

/** Filtro por titular de los artboards (Todas · Daniel · Esposa · Conjuntas). */
@Component({
  selector: 'app-filtro-titular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-1.5', role: 'radiogroup', 'aria-label': 'Filtrar por titular' },
  template: `
    @for (o of opciones(); track o.valor) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="valor() === o.valor"
        (click)="valor.set(o.valor)"
        class="tocable h-8 rounded-full px-3 text-[13px]"
        [class]="valor() === o.valor ? 'bg-acento font-semibold text-white' : 'border border-borde bg-superficie'"
      >
        {{ o.etiqueta }}
      </button>
    }
  `,
})
export class FiltroTitularComponent {
  private readonly miembros = inject(MiembrosHogar);
  readonly valor = model<FiltroTitular>('TODAS');
  protected readonly opciones = computed<{ valor: FiltroTitular; etiqueta: string }[]>(() => [
    { valor: 'TODAS', etiqueta: 'Todas' },
    ...this.miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre })),
    { valor: 'CONJUNTAS', etiqueta: 'Conjuntas' },
  ]);
}
