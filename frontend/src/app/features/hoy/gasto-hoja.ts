import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { mesDe, type Id } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { SesionActual } from '../../core/sesion/sesion';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';
import { SU_CUENTA, opcionesDeHoja } from './opciones-hoja';

const NO_PLANEADO = '__no_planeado__';

/** Gasto.dc.html: monto, a que gasto del plan (los variables acumulan) o "No estaba planeado", nota, quien y desde. */
@Component({
  selector: 'app-gasto-hoja',
  imports: [Hoja, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja titulo="Registrar gasto" (cerrar)="hoja.cerrar()">
      <app-monto-input etiqueta="¿Cuánto?" [grande]="true" [(valor)]="monto" />
      <div class="flex flex-col gap-2">
        <app-segmentado etiqueta="¿De cuál gasto del plan?" [chips]="true" [opciones]="opcionesItem()" [valor]="itemElegido()" (valorChange)="itemSeleccionado.set($event)" />
        @if (vistaPrevia(); as v) {
          <p class="text-xs text-secundario" data-testid="vista-previa-gasto">
            {{ v.nombre }}: llevas <app-monto [valor]="v.llevado" [siempreVisible]="true" /> de <app-monto [valor]="v.presupuesto" [siempreVisible]="true" /> con este gasto.
          </p>
        }
      </div>
      <label class="flex flex-col gap-2">
        <span class="rotulo">Nota · Opcional</span>
        <input class="h-12 rounded-xl border border-borde bg-fondo px-3.5 text-[15px] font-medium focus:border-acento focus:outline-none" placeholder="Ej: Plaza del sábado"
          [value]="nota()" (input)="nota.set($any($event.target).value)" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <app-segmentado etiqueta="Pagó" [opciones]="hoja.iniciales()" [(valor)]="quien" />
        <label class="flex flex-col gap-2">
          <span class="rotulo">Desde</span>
          <select class="h-11 rounded-control border border-borde bg-superficie px-3 text-sm font-medium focus:border-acento focus:outline-none" [value]="desde()" (change)="desde.set($any($event.target).value)">
            <option value="">Sin especificar</option>
            @for (o of hoja.desde(); track o.valor) {
              <option [value]="o.valor">{{ o.etiqueta }}</option>
            }
          </select>
        </label>
      </div>
      @if (desde() === suCuenta) {
        <p class="rounded-xl bg-nota px-4 py-3 text-[13px] text-[#3B3D39]">Desde su cuenta, el gasto cuenta como aporte de {{ hoja.miembros.nombreDe(quien()) }}.</p>
      }
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
      <button type="button" class="boton-grande" [disabled]="!monto() || !quien() || !itemElegido() || guardando()" (click)="guardar()">Guardar gasto</button>
    </app-hoja>
  `,
})
export class GastoHoja {
  private readonly puertos = inject(PUERTOS);
  private readonly sesion = inject(SesionActual);
  protected readonly hoja = opcionesDeHoja();
  protected readonly suCuenta = SU_CUENTA;

  /** Query param `?item=` (al tocar un variable en Por pagar). */
  readonly item = input<Id | undefined>();

  private readonly ref = mesDe(this.puertos.hoy());
  private readonly resumen = consulta(() => this.ref, (p, ref) => p.movimientos.resumenMes(ref));

  /** Los variables del plan (acumulan contra su presupuesto), en el orden del plan. */
  private readonly variables = computed(() => {
    const r = this.resumen.value();
    return [...(r?.porPagar ?? []), ...(r?.yaPagado ?? [])].filter((i) => i.item.tipo === 'VARIABLE');
  });
  protected readonly opcionesItem = computed<Opcion<string>[]>(() => [
    ...this.variables().map((i) => ({ valor: i.item.id, etiqueta: i.item.nombre })),
    { valor: NO_PLANEADO, etiqueta: 'No estaba planeado' },
  ]);

  protected readonly itemSeleccionado = signal<string | null>(null);
  protected readonly itemElegido = computed(() => this.itemSeleccionado() ?? this.item() ?? this.variables()[0]?.item.id ?? NO_PLANEADO);
  protected readonly monto = signal<number | null>(null);
  protected readonly nota = signal('');
  protected readonly quien = signal<Id | null>(this.sesion.usuario()?.id ?? null);
  protected readonly desde = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly vistaPrevia = computed(() => {
    const i = this.variables().find((v) => v.item.id === this.itemElegido());
    if (!i) return null;
    return { nombre: i.item.nombre, llevado: i.real + (this.monto() ?? 0), presupuesto: i.plan };
  });

  protected async guardar(): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      const item = this.itemElegido();
      await this.puertos.movimientos.registrarGasto({
        monto: this.monto()!, itemId: item === NO_PLANEADO ? null : item, nota: this.nota(), usuarioId: this.quien()!,
        origen: this.hoja.origen(this.desde() || null), ref: this.ref,
      });
      await this.hoja.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
