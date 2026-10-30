import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { formatFechaCorta, type Id, type Origen } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado } from '../../shared/components/segmentado';
import { SU_CUENTA, opcionesDeHoja } from './opciones-hoja';

function mismoOrigen(a: Origen, b: Origen): boolean {
  return a.tipo === b.tipo && (a.tipo !== 'CUENTA' || (b.tipo === 'CUENTA' && a.cuentaId === b.cuentaId));
}

/**
 * Un pago, gasto, ingreso recibido o aporte, para corregirlo o borrarlo (design D6 de usabilidad-plan). Es hija de Hoy y del
 * detalle de una cuenta: al cerrar vuelve a la pantalla de atras.
 */
@Component({
  selector: 'app-registro-hoja',
  imports: [Hoja, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="vista.value()?.titulo ?? 'Registro'" (cerrar)="cerrar()">
      <span subtitulo class="text-[13px] text-secundario">
        @if (vista.value(); as v) {
          {{ fecha(v.movimiento.fecha) }} · {{ hoja.miembros.nombreDe(v.movimiento.usuarioId) }}
        }
      </span>
      @if (vista.value(); as v) {
        @if (borrando()) {
          <p class="text-[15px] font-medium">¿Borrar este registro?</p>
          <ul class="flex flex-col gap-1.5 rounded-xl bg-nota px-4 py-3.5 text-[13px] text-[#3B3D39]" data-testid="efecto-borrar">
            @for (a of v.avisos; track a) {
              <li>{{ a }}</li>
            }
          </ul>
          @if (error()) {
            <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
          }
          <button type="button" class="boton-grande bg-negativo" [disabled]="guardando()" (click)="borrar()">Sí, borrar</button>
        } @else {
          @if (v.esCuota) {
            <p class="rounded-xl bg-nota px-4 py-3.5 text-[13px] text-[#3B3D39]" data-testid="aviso-cuota">Para cambiar el monto de una cuota, borra el pago y márcalo otra vez.</p>
          } @else {
            <app-monto-input etiqueta="Monto" [grande]="true" [(valor)]="monto" />
          }
          <app-segmentado etiqueta="Cuenta · Opcional" [chips]="true" [opcional]="true" [opciones]="hoja.desde()" [(valor)]="desde" />
          @if (v.movimiento.tipo === 'GASTO') {
            <label class="flex flex-col gap-2">
              <span class="rotulo">Nota · Opcional</span>
              <input class="campo" maxlength="120" [value]="nota()" (input)="nota.set($any($event.target).value)" />
            </label>
          }
          @if (error()) {
            <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
          }
          <button type="button" class="boton-grande" [disabled]="!monto() || guardando()" (click)="guardar()">Guardar</button>
          <button type="button" class="boton-texto self-center font-normal text-negativo" (click)="borrando.set(true)">Borrar este registro</button>
        }
      } @else if (!vista.isLoading()) {
        <p class="text-secundario">Ese registro ya no está.</p>
      }
    </app-hoja>
  `,
})
export class RegistroHoja {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly hoja = opcionesDeHoja();

  /** Parametro de la ruta (`registro/:registroId`). */
  readonly registroId = input.required<Id>();

  protected readonly vista = consulta(() => this.registroId(), (p, id) => p.movimientos.registro(id));
  protected readonly monto = signal<number | null>(null);
  protected readonly desde = signal<string | null>(null);
  protected readonly nota = signal('');
  protected readonly borrando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  private prellenado = false;

  constructor() {
    effect(() => {
      const m = this.vista.value()?.movimiento;
      if (!m || this.prellenado) return;
      this.prellenado = true;
      this.monto.set(m.monto);
      this.nota.set(m.nota);
      this.desde.set(m.origen.tipo === 'CUENTA' ? m.origen.cuentaId : m.origen.tipo === 'EXTERNA' ? SU_CUENTA : null);
    });
  }

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected cerrar(): Promise<boolean> {
    return this.router.navigate(['../..'], { relativeTo: this.ruta });
  }

  /** Solo lo que cambio. */
  protected guardar(): Promise<void> {
    const v = this.vista.value()!;
    const m = v.movimiento;
    const origen = this.hoja.origen(this.desde());
    return this.ejecutar(() =>
      this.puertos.movimientos.corregirRegistro({
        movimientoId: m.id,
        monto: !v.esCuota && this.monto() !== m.monto ? this.monto()! : undefined,
        origen: mismoOrigen(origen, m.origen) ? undefined : origen,
        nota: m.tipo === 'GASTO' && this.nota() !== m.nota ? this.nota() : undefined,
      }),
    );
  }

  protected borrar(): Promise<void> {
    return this.ejecutar(() => this.puertos.movimientos.borrarRegistro(this.vista.value()!.movimiento.id));
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await accion();
      await this.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
