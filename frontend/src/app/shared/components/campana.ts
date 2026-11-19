import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { pendientesAvisos } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { Icono } from './icono';

/**
 * La campana de Hoy y de la barra superior (spec steward-avisos, "Campana en Hoy"): abre Avisos y, con avisos vencidos o
 * de los proximos 7 dias, muestra su numero.
 */
@Component({
  selector: 'app-campana',
  imports: [RouterLink, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/avisos" class="relative flex size-11 items-center justify-center rounded-control text-texto hover:bg-fondo" [attr.aria-label]="etiqueta()" data-testid="campana">
      <app-icono nombre="campana" [tamano]="22" />
      @if (pendientes()) {
        <span class="absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-superficie bg-negativo px-1 text-[11px] font-bold text-white" aria-hidden="true" data-testid="insignia-avisos">{{ pendientes() }}</span>
      }
    </a>
  `,
})
export class Campana {
  private readonly avisos = consulta(() => null, (p) => p.avisos.proximos());
  protected readonly pendientes = computed(() => pendientesAvisos(this.avisos.value() ?? []));
  protected readonly etiqueta = computed(() => (this.pendientes() ? `Avisos · ${this.pendientes()} pendientes` : 'Avisos'));
}
