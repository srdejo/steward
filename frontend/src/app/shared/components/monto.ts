import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MONTO_OCULTO, formatCop, type Pesos } from '@steward/domain';

import { SEGURIDAD_DISPONIBLE, SesionActual } from '../../core/sesion/sesion';

/**
 * Un monto en COP con fuente monoespaciada. Con "Ocultar montos" se ve `$••••` hasta que se toca
 * (spec steward-ajustes: seguridad y privacidad).
 */
@Component({
  selector: 'app-monto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'monto' },
  template: `
    @if (oculto()) {
      <button type="button" class="tocable cursor-pointer" (click)="revelado.set(true)" aria-label="Mostrar monto">{{ textoOculto }}</button>
    } @else {
      {{ texto() }}
    }
  `,
})
export class Monto {
  private readonly preferencias = inject(SesionActual).preferencias;
  readonly valor = input.required<Pesos>();
  /** Positivos con `+` (ingresos extra). */
  readonly signo = input(false);
  /** Monto que no se oculta nunca (por ejemplo dentro de un campo que se esta escribiendo). */
  readonly siempreVisible = input(false);

  protected readonly revelado = signal(false);
  protected readonly textoOculto = MONTO_OCULTO;
  protected readonly texto = computed(() => formatCop(this.valor(), { signo: this.signo() }));
  protected readonly oculto = computed(() => SEGURIDAD_DISPONIBLE && this.preferencias().ocultarMontos && !this.revelado() && !this.siempreVisible());
}
