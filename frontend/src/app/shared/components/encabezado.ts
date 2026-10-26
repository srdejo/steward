import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Encabezado de pantalla de los artboards: enlace de vuelta opcional ("‹ Hoy"), rotulo en mayusculas
 * ("HOY · LUN 26", "CIERRE DE MES") y titulo grande. Lo de la derecha se proyecta.
 */
@Component({
  selector: 'app-encabezado',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1' },
  template: `
    @if (volver()) {
      <a [routerLink]="volver()" class="boton-texto -my-2 self-start text-sm font-normal">‹ {{ volverTexto() }}</a>
    }
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 flex-col gap-0.5">
        @if (rotulo()) {
          <span class="rotulo">{{ rotulo() }}</span>
        }
        <h1 class="text-[26px] leading-tight font-bold">{{ titulo() }}</h1>
      </div>
      <ng-content />
    </div>
  `,
})
export class Encabezado {
  readonly titulo = input.required<string>();
  readonly rotulo = input('');
  readonly volver = input<string | null>(null);
  readonly volverTexto = input('Volver');
}
