import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Fila de lista de los artboards: titulo de 15 px y detalle de 12 px a la izquierda; lo de la derecha se proyecta. */
@Component({
  selector: 'app-fila',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-between gap-3 py-2.5' },
  template: `
    <div class="flex min-w-0 flex-col gap-0.5">
      <span class="truncate text-[15px]" [class.font-semibold]="destacado()">{{ titulo() }}</span>
      @if (detalle()) {
        <span class="text-xs" [class]="tonoDetalle()">{{ detalle() }}</span>
      }
      <ng-content select="[detalle]" />
    </div>
    <div class="flex shrink-0 items-center gap-3">
      <ng-content />
    </div>
  `,
})
export class Fila {
  readonly titulo = input.required<string>();
  readonly detalle = input('');
  readonly destacado = input(false);
  /** Clase de color del detalle ("text-negativo" para "Vence en 4 días"). */
  readonly tonoDetalle = input('text-secundario');
}
