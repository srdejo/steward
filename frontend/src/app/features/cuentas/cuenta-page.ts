import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { formatFechaCorta, type Id } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { Encabezado } from '../../shared/components/encabezado';
import { Fila } from '../../shared/components/fila';
import { Monto } from '../../shared/components/monto';

/** De donde sale el saldo de una cuenta: su ultimo cuadre y lo registrado despues (spec steward-cuentas). */
@Component({
  selector: 'app-cuenta-page',
  imports: [RouterLink, RouterOutlet, Encabezado, Fila, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4 px-5 pt-6 pb-4' },
  template: `
    @if (vista(); as c) {
      <app-encabezado [titulo]="c.cuenta.nombre" [rotulo]="c.titular" volver="/cuentas" volverTexto="Cuentas" />
      <div class="flex flex-col divide-y divide-divisor">
        @for (m of movimientos.value() ?? []; track m.movimiento.id) {
          @if (m.corregible) {
            <a [routerLink]="['registro', m.movimiento.id]" class="block hover:bg-superficie">
              <app-fila [titulo]="m.descripcion" [detalle]="fecha(m.movimiento.fecha)">
                <app-monto class="text-sm" [valor]="m.efecto" [signo]="true" />
              </app-fila>
            </a>
          } @else {
            <app-fila [titulo]="m.descripcion" [detalle]="fecha(m.movimiento.fecha)">
              <app-monto class="text-sm" [valor]="m.efecto" [signo]="true" />
            </app-fila>
          }
        }
        <app-fila [titulo]="'Cuadre ' + fecha(c.cuenta.fechaCuadre)" data-testid="ultimo-cuadre">
          <app-monto class="text-sm" [valor]="c.cuenta.saldoCuadre" />
        </app-fila>
      </div>
      <div class="flex items-center justify-between border-t border-divisor pt-3">
        <span class="rotulo">Saldo estimado</span>
        <span class="monto text-lg font-semibold" data-testid="saldo-cuenta">≈ <app-monto [valor]="c.saldo" /></span>
      </div>
    } @else if (!cuentas.isLoading()) {
      <app-encabezado titulo="Cuenta no encontrada" volver="/cuentas" volverTexto="Cuentas" />
    }
    <router-outlet />
  `,
})
export class CuentaPage {
  /** Parametro de la ruta (`/cuentas/cuenta/:id`). */
  readonly id = input.required<Id>();

  protected readonly cuentas = consulta(() => null, (p) => p.cuentas.cuentas());
  protected readonly vista = computed(() => this.cuentas.value()?.cuentas.find((c) => c.cuenta.id === this.id()) ?? null);
  protected readonly movimientos = consulta(() => this.id(), (p, id) => p.cuentas.movimientos(id));

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }
}
