import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Pesos } from '@steward/domain';

import { Monto } from './monto';

/** Cifra pequeña con su rotulo ("Falta pagar $2.715.000", "Vs. plan −$62.000"). Con `enfasis`, rotulo y cifra en negrita y el tono solo en el rotulo (Main.dc.html). */
@Component({
  selector: 'app-kpi',
  imports: [Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-col gap-0.5' },
  template: `
    <span class="text-[11px]" [class]="enfasis() ? 'font-semibold ' + (tono() || 'text-secundario') : 'text-secundario'">{{ etiqueta() }}</span>
    <app-monto [class]="enfasis() ? 'text-sm font-semibold' : 'text-[13px] ' + tono()" [valor]="valor()" />
  `,
})
export class Kpi {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<Pesos>();
  readonly tono = input('');
  readonly enfasis = input(false);
}
