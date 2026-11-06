import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { formatFechaCorta, puedeQuitarCuenta, type Id } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { SesionActual } from '../../core/sesion/sesion';
import { Encabezado } from '../../shared/components/encabezado';
import { Fila } from '../../shared/components/fila';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';

/** De donde sale el saldo de una cuenta: su ultimo cuadre y lo registrado despues (spec steward-cuentas). */
@Component({
  selector: 'app-cuenta-page',
  imports: [RouterLink, RouterOutlet, Encabezado, Fila, Hoja, Monto],
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
      @if (eliminable()) {
        <button type="button" class="flex min-h-11 items-center justify-center text-sm font-medium text-negativo" (click)="confirmando.set(true)">Eliminar cuenta</button>
      }
      @if (confirmando()) {
        <app-hoja [titulo]="'Eliminar ' + c.cuenta.nombre" (cerrar)="cerrar()">
          <p class="text-[15px] text-secundario">
            El total del hogar baja en <app-monto [valor]="c.saldo" />. Lo que registraron con esta cuenta queda en el historial, sin cuenta. No se puede deshacer.
          </p>
          @if (error()) {
            <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
          }
          <button type="button" class="boton-grande bg-negativo" [disabled]="ocupado()" (click)="eliminar(c.cuenta.id)">Eliminar cuenta</button>
        </app-hoja>
      }
    } @else if (!cuentas.isLoading()) {
      <app-encabezado titulo="Cuenta no encontrada" volver="/cuentas" volverTexto="Cuentas" />
    }
    <router-outlet />
  `,
})
export class CuentaPage {
  private readonly puertos = inject(PUERTOS);
  private readonly sesion = inject(SesionActual);
  private readonly router = inject(Router);

  /** Parametro de la ruta (`/cuentas/cuenta/:id`). */
  readonly id = input.required<Id>();

  protected readonly cuentas = consulta(() => null, (p) => p.cuentas.cuentas());
  protected readonly vista = computed(() => this.cuentas.value()?.cuentas.find((c) => c.cuenta.id === this.id()) ?? null);
  protected readonly movimientos = consulta(() => this.id(), (p, id) => p.cuentas.movimientos(id));
  /** Solo las propias o las conjuntas (spec steward-cuentas, "Eliminar una cuenta"). */
  protected readonly eliminable = computed(() => {
    const c = this.vista();
    const usuario = this.sesion.usuario();
    return !!c && !!usuario && puedeQuitarCuenta(c.cuenta, usuario.id);
  });
  protected readonly confirmando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected cerrar(): void {
    this.confirmando.set(false);
    this.error.set('');
  }

  protected async eliminar(cuentaId: Id): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    try {
      await this.puertos.cuentas.eliminar(cuentaId);
      this.confirmando.set(false);
      await this.router.navigateByUrl('/cuentas');
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
