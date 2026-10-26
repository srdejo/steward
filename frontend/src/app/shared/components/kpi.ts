import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Pesos } from '@steward/domain';

import { Monto } from './monto';

/** Cifra pequeña con su rotulo ("Plan $5.390.000", "Vs. plan −$62.000"). */
@Component({
  selector: 'app-kpi',
  imports: [Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-col gap-0.5' },
  template: `
    <span class="text-[11px] text-secundario">{{ etiqueta() }}</span>
    <app-monto class="text-[13px]" [class]="tono()" [valor]="valor()" />
  `,
})
export class Kpi {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<Pesos>();
  readonly tono = input('');
}
