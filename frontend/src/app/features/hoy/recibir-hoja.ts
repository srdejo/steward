import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { mesDe } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { opcionesDeHoja } from './opciones-hoja';

/**
 * "Recibí" (spec steward-hoy, design D8 de diezmo-como-gasto): el monto de la linea viene lleno para confirmarlo o
 * cambiarlo por lo que llego. La linea del plan no cambia: lo recibido es lo real.
 */
@Component({
  selector: 'app-recibir-hoja',
  imports: [Hoja, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="linea()?.nombre ?? 'Recibí'" antetitulo="Ingreso del mes" (cerrar)="hoja.cerrar()">
      @if (linea(); as l) {
        <span subtitulo class="text-[13px] text-secundario">Plan <app-monto [valor]="l.monto" /></span>
      }
      @if (linea()) {
        <app-monto-input etiqueta="Valor recibido" [grande]="true" [(valor)]="monto" ayuda="Viene lleno con el plan. Si llegó otro valor, cámbialo." />
        <button type="button" class="boton-grande" [disabled]="!monto() || guardando()" (click)="guardar()">Marcar recibido</button>
      } @else if (!resumen.isLoading() && !error()) {
        <p class="text-secundario">Ese ingreso ya se recibió o no está en el plan del mes.</p>
      }
      <!-- Fuera de la linea: si otro miembro ya lo recibio, la linea queda recibida y el mensaje se sigue viendo. -->
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    </app-hoja>
  `,
})
export class RecibirHoja {
  private readonly puertos = inject(PUERTOS);
  protected readonly hoja = opcionesDeHoja();

  /** Parametro de la ruta (`/hoy/recibir/:clave`): la clave de la linea de ingreso en Hoy. */
  readonly clave = input.required<string>();

  private readonly ref = mesDe(this.puertos.hoy());
  protected readonly resumen = consulta(() => this.ref, (p, ref) => p.movimientos.resumenMes(ref));
  protected readonly linea = computed(() => this.resumen.value()?.ingresos.find((l) => l.clave === this.clave() && !l.recibido && (l.lineaId || l.ingresoFijoId)) ?? null);

  protected readonly monto = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const l = this.linea();
      if (l && this.monto() === null) this.monto.set(l.monto);
    });
  }

  protected async guardar(): Promise<void> {
    const l = this.linea();
    if (!l) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.puertos.ingresos.marcarRecibido(
        l.lineaId ? { ref: this.ref, lineaId: l.lineaId, monto: this.monto()! } : { ref: this.ref, ingresoFijoId: l.ingresoFijoId!, monto: this.monto()! },
      );
      await this.hoja.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
