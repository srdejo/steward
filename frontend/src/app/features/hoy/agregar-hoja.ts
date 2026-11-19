import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { Id } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { Agregar, type TipoAgregar } from './agregar';
import { AporteHoja } from './aporte-hoja';
import { GastoHoja } from './gasto-hoja';
import { MesDeHoy } from './mes-de-hoy';
import { CIERRE_HOJA } from './opciones-hoja';
import { PagarHoja } from './pagar-hoja';

const PESTANAS: { tipo: TipoAgregar; etiqueta: string }[] = [
  { tipo: 'gasto', etiqueta: 'Gasto' },
  { tipo: 'aporte', etiqueta: 'Aporte' },
  { tipo: 'pago', etiqueta: 'Pago' },
];

/**
 * Agregar (artboard "Agregar · gasto, aporte o pago"): una sola hoja con las pestañas Gasto, Aporte y Pago, que monta
 * las hojas de siempre sin su marco (spec steward-hoy, "Agregar desde un solo botón"; design D3 de rediseno-libreta-clara).
 */
@Component({
  selector: 'app-agregar-hoja',
  imports: [Hoja, Monto, AporteHoja, GastoHoja, PagarHoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: CIERRE_HOJA, useFactory: () => { const a = inject(Agregar); return () => a.cerrar(); } }],
  template: `
    <app-hoja titulo="Agregar" (cerrar)="agregar.cerrar()">
      <div role="tablist" aria-label="Qué vas a agregar" class="grid grid-cols-3 gap-1 rounded-control bg-hueco p-1" data-testid="pestanas-agregar">
        @for (p of pestanas; track p.tipo) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="p.tipo === tipoActual()"
            class="h-10 rounded-[9px] text-sm"
            [class]="p.tipo === tipoActual() ? 'bg-superficie font-semibold text-texto' : 'font-medium text-texto-medio'"
            (click)="elegir(p.tipo)"
          >
            {{ p.etiqueta }}
          </button>
        }
      </div>

      @switch (tipoActual()) {
        @case ('gasto') {
          <app-gasto-hoja [incrustada]="true" [item]="itemActual() ?? undefined" />
        }
        @case ('aporte') {
          <app-aporte-hoja [incrustada]="true" />
        }
        @case ('pago') {
          @if (itemActual(); as id) {
            <app-pagar-hoja [incrustada]="true" [itemId]="id" [mes]="id === item() ? mes() : null" />
            <button type="button" class="boton-texto self-start text-sm" (click)="elegido.set(null); itemDeUrl.set(null)">Elegir otro pago</button>
          } @else {
            <div class="flex flex-col gap-2" data-testid="pendientes-agregar">
              <span class="text-[13px] font-semibold text-texto-medio">¿Qué pagaste?</span>
              @for (i of pendientes(); track i.item.id) {
                <button type="button" class="flex min-h-14 items-center gap-3 rounded-[14px] bg-fondo px-3.5 py-2.5 text-left" (click)="elegido.set(i.item.id)">
                  <span class="flex min-w-0 grow flex-col gap-0.5">
                    <span class="text-[15px] font-medium">{{ i.item.nombre }}</span>
                    <span class="text-xs" [class]="i.vencido ? 'font-semibold text-negativo' : 'text-secundario'">{{ i.detalle }}</span>
                  </span>
                  <app-monto class="text-[15px] font-semibold" [valor]="i.pendiente" />
                </button>
              } @empty {
                <p class="text-sm text-secundario">Todo pagado este mes.</p>
              }
            </div>
          }
        }
      }
    </app-hoja>
  `,
})
export class AgregarHoja {
  protected readonly agregar = inject(Agregar);
  protected readonly pestanas = PESTANAS;

  /** Desde la URL (`?agregar=` y `?item=`). */
  readonly tipo = input<TipoAgregar>('gasto');
  readonly item = input<Id | null>(null);
  /** El mes del pago, si viene de Avisos y no es el de Hoy. */
  readonly mes = input<string | null>(null);

  private readonly tipoElegido = signal<TipoAgregar | null>(null);
  protected readonly elegido = signal<Id | null>(null);
  /** El item de la URL solo cuenta en la pestaña con la que se abrio. */
  protected readonly itemDeUrl = signal<Id | null | undefined>(undefined);

  protected readonly tipoActual = computed(() => this.tipoElegido() ?? this.tipo());
  protected readonly itemActual = computed(() => {
    const deUrl = this.itemDeUrl() === undefined ? this.item() : this.itemDeUrl();
    return this.elegido() ?? (this.tipoElegido() === null || this.tipoElegido() === this.tipo() ? deUrl : null);
  });

  private readonly mesHoy = inject(MesDeHoy);
  private readonly resumen = consulta(() => this.mesHoy.ref(), (p, ref) => p.movimientos.resumenMes(ref));
  /** Lo pendiente que se marca como pago: los variables se registran como gasto. */
  protected readonly pendientes = computed(() => (this.resumen.value()?.porPagar ?? []).filter((i) => i.item.tipo !== 'VARIABLE'));

  protected elegir(tipo: TipoAgregar): void {
    this.tipoElegido.set(tipo);
    this.elegido.set(null);
  }
}
