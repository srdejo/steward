import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

let siguienteId = 0;

/** Interruptor de los artboards (44 × 26) con su texto: "Aplicar diezmo", "Ocultar montos". */
@Component({
  selector: 'app-interruptor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-between gap-3' },
  template: `
    <div class="flex min-w-0 flex-col gap-0.5">
      <span [id]="id" class="text-sm font-medium">{{ titulo() }}</span>
      @if (detalle()) {
        <span [id]="id + '-detalle'" class="text-xs text-secundario">{{ detalle() }}</span>
      }
    </div>
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="activo()"
      [attr.aria-labelledby]="id"
      [attr.aria-describedby]="detalle() ? id + '-detalle' : null"
      (click)="activo.set(!activo())"
      class="tocable flex h-[26px] w-11 shrink-0 items-center rounded-full p-[3px] transition-colors"
      [class.bg-acento]="activo()"
      [class.bg-control]="!activo()"
      [class.justify-end]="activo()"
    >
      <span class="h-5 w-5 rounded-full bg-white"></span>
    </button>
  `,
})
export class Interruptor {
  protected readonly id = `int-${++siguienteId}`;
  readonly titulo = input.required<string>();
  readonly detalle = input('');
  readonly activo = model(false);
}
