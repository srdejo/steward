import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatFechaCorta, type Id } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Fila } from '../../shared/components/fila';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MesDeHoy } from './mes-de-hoy';

/** Los gastos de un variable o los aportes de una persona en el mes; cada uno abre su hoja (design D6 de usabilidad-plan). */
@Component({
  selector: 'app-registros-hoja',
  imports: [RouterLink, Fila, Hoja, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja titulo="Registros del mes" (cerrar)="cerrar()">
      <div class="flex flex-col divide-y divide-divisor">
        @for (r of lista.value() ?? []; track r.movimiento.id) {
          <a [routerLink]="['/hoy/registro', r.movimiento.id]" class="block hover:bg-fondo">
            <app-fila [titulo]="r.movimiento.nota || r.titulo" [detalle]="fecha(r.movimiento.fecha) + ' · ' + miembros.nombreDe(r.movimiento.usuarioId)">
              <app-monto class="text-sm" [valor]="r.movimiento.monto" />
            </app-fila>
          </a>
        } @empty {
          <p class="py-2.5 text-sm text-secundario">No hay registros.</p>
        }
      </div>
    </app-hoja>
  `,
})
export class RegistrosHoja {
  private readonly router = inject(Router);
  protected readonly miembros = inject(MiembrosHogar);

  /** Query params: `?item=` o `?aportes=`. */
  readonly item = input<Id | undefined>();
  readonly aportes = input<Id | undefined>();

  private readonly ref = inject(MesDeHoy).ref();
  protected readonly lista = consulta(
    () => ({ itemId: this.item(), aportesDe: this.aportes() }),
    (p, filtro) => p.movimientos.registros(this.ref, filtro),
  );

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected cerrar(): Promise<boolean> {
    return this.router.navigate(['/hoy']);
  }
}
