import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { mesDe, nombreMesCapital, sumarMeses, type Id, type MesRef } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { SesionActual } from '../../core/sesion/sesion';
import { Hoja } from '../../shared/components/hoja';
import { Interruptor } from '../../shared/components/interruptor';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';
import { MesDeHoy } from './mes-de-hoy';
import { SU_CUENTA, opcionesDeHoja } from './opciones-hoja';

/** Aporte.dc.html: quien · cuanto · para que mes. Suma al "Te queda libre" del mes elegido al instante. */
@Component({
  selector: 'app-aporte-hoja',
  imports: [Hoja, Interruptor, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja titulo="Nuevo aporte" (cerrar)="hoja.cerrar()">
      <app-segmentado etiqueta="¿Quién?" [opciones]="hoja.personas()" [(valor)]="quien" />
      <app-monto-input etiqueta="¿Cuánto?" [grande]="true" [(valor)]="monto" />
      <app-segmentado etiqueta="¿Para qué mes?" [opciones]="meses" [(valor)]="mes" />
      <app-segmentado etiqueta="¿Dónde quedó? · Opcional" [chips]="true" [opcional]="true" [opciones]="hoja.desde()" [(valor)]="cuenta" />
      <div class="rounded-xl bg-nota px-4 py-3.5">
        <app-interruptor titulo="Aplicar diezmo" detalle="Por defecto según quién aporta" [(activo)]="diezmo" />
      </div>
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
      <div class="flex flex-col gap-2.5">
        @if (monto()) {
          <p class="text-center text-[13px] text-secundario" data-testid="efecto-aporte">
            {{ nombreMes() }} pasa a tener <app-monto class="font-semibold text-acento" [valor]="monto()!" [siempreVisible]="true" /> más en ingresos
          </p>
        }
        <button type="button" class="boton-grande" [disabled]="!quien() || !monto() || guardando()" (click)="guardar()">Guardar aporte</button>
      </div>
    </app-hoja>
  `,
})
export class AporteHoja {
  private readonly puertos = inject(PUERTOS);
  private readonly sesion = inject(SesionActual);
  protected readonly hoja = opcionesDeHoja();

  private readonly actual = mesDe(this.puertos.hoy());
  private readonly siguiente = sumarMeses(this.actual, 1);
  protected readonly meses: Opcion<string>[] = [this.actual, this.siguiente].map((m) => ({ valor: `${m.anio}-${m.mes}`, etiqueta: nombreMesCapital(m.mes) }));

  protected readonly quien = signal<Id | null>(this.sesion.usuario()?.id ?? null);
  protected readonly monto = signal<number | null>(null);
  /** Empieza en el mes que se esta viendo; aqui el mes se ve y se cambia. */
  protected readonly mes = signal<string | null>(`${inject(MesDeHoy).ref().anio}-${inject(MesDeHoy).ref().mes}`);
  protected readonly cuenta = signal<string | null>(null);
  protected readonly diezmo = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  private readonly regla = consulta(() => null, (p) => p.ingresos.regla());
  protected readonly nombreMes = computed(() => this.meses.find((m) => m.valor === this.mes())?.etiqueta ?? '');

  constructor() {
    // "Por defecto según quién aporta": la regla de quien registra, si diezma de sus aportes.
    effect(() => {
      const regla = this.regla.value();
      this.diezmo.set(this.quien() === this.sesion.usuario()?.id && Boolean(regla?.activa && regla.aplicaAportes));
    });
  }

  protected async guardar(): Promise<void> {
    const [anio, mes] = this.mes()!.split('-').map(Number);
    const ref: MesRef = { anio: anio!, mes: mes! };
    this.guardando.set(true);
    this.error.set('');
    try {
      const cuenta = this.cuenta();
      await this.puertos.ingresos.registrarAporte({ usuarioId: this.quien()!, monto: this.monto()!, ref, cuentaId: cuenta && cuenta !== SU_CUENTA ? cuenta : null, aplicaDiezmo: this.diezmo() });
      await this.hoja.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
