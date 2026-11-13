import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LineaIngreso } from '@steward/domain';

import { Fila } from '../../shared/components/fila';
import { Monto } from '../../shared/components/monto';

/**
 * Lineas de ingreso del mes en Hoy, igual en una columna y en escritorio (spec steward-hoy). Lo recibido y los aportes
 * se abren para corregirlos o borrarlos; una linea por recibir ofrece "Recibí". Los enlaces son relativos a /hoy.
 */
@Component({
  selector: 'app-ingresos-hoy',
  imports: [RouterLink, Fila, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col divide-y divide-divisor' },
  template: `
    @for (l of ingresos(); track l.clave) {
      @if (l.movimientoId || l.tipo === 'APORTES') {
        <!-- Lo recibido y los aportes se abren para corregirlos o borrarlos (design D6 de usabilidad-plan). -->
        <a [routerLink]="l.movimientoId ? ['registro', l.movimientoId] : 'registros'" [queryParams]="l.movimientoId ? null : { aportes: l.usuarioId }" class="block hover:bg-superficie">
          <app-fila [titulo]="l.nombre" [detalle]="l.detalle">
            <app-monto class="text-sm text-positivo" [valor]="l.monto" />
          </app-fila>
        </a>
      } @else {
        <app-fila [titulo]="l.nombre" [detalle]="l.detalle">
          @if (porRecibir(l)) {
            <a [routerLink]="['recibir', l.clave]" class="boton-texto font-semibold">Recibí</a>
          }
          <app-monto class="text-sm" [class.text-positivo]="!porRecibir(l)" [class.text-secundario]="porRecibir(l)" [valor]="l.monto" />
        </app-fila>
      }
    } @empty {
      <p class="py-2.5 text-sm text-secundario">Aún no hay ingresos este mes.</p>
    }
  `,
})
export class IngresosHoy {
  readonly ingresos = input.required<LineaIngreso[]>();

  /** Una linea de la opcion (o, sin plan, un ingreso fijo) que todavia no llega: "Recibí" abre su monto. */
  protected porRecibir(l: LineaIngreso): boolean {
    return !l.recibido && Boolean(l.lineaId || l.ingresoFijoId);
  }
}
