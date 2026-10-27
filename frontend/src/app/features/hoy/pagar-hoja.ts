import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { fechaEnMes, formatFechaCorta, mesDe, nombreMes, type Id } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { SesionActual } from '../../core/sesion/sesion';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado } from '../../shared/components/segmentado';
import { SU_CUENTA, opcionesDeHoja } from './opciones-hoja';

/**
 * Pagar.dc.html: valor prellenado con el plan, quien pago y desde donde. Desde "Su cuenta" el pago cuenta
 * ademas como aporte de quien pago. Si ya estaba pagado avisa "Ya lo pagó X el dd mmm" (spec steward-hoy).
 */
@Component({
  selector: 'app-pagar-hoja',
  imports: [Hoja, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="ejecucion()?.item?.nombre ?? 'Marcar pago'" [antetitulo]="ejecucion()?.categoriaNombre ?? ''" [colorAntetitulo]="categoria()?.color ?? null" (cerrar)="hoja.cerrar()">
      @if (ejecucion(); as e) {
        <span subtitulo class="text-[13px] text-secundario">Plan <app-monto [valor]="e.plan" />{{ vence() }}</span>
      }
      @if (ejecucion(); as e) {

        @if (yaPagado(); as aviso) {
          <p role="status" class="rounded-xl bg-aviso-suave px-4 py-3.5 text-sm text-aviso" data-testid="ya-pagado">{{ aviso }}</p>
          <button type="button" class="boton-grande" (click)="hoja.cerrar()">Entendido</button>
        } @else {
          <app-monto-input etiqueta="Valor pagado" [grande]="true" [(valor)]="monto" ayuda="Viene lleno con el plan. Si pagas otro valor, la diferencia se ve en el mes." />
          <app-segmentado etiqueta="Pagado por" [opciones]="hoja.personas()" [(valor)]="quien" />
          <app-segmentado etiqueta="Desde · Opcional" [chips]="true" [opcional]="true" [opciones]="hoja.desde()" [(valor)]="desde" />
          @if (desde() === suCuenta) {
            <p class="flex gap-3 rounded-xl bg-nota px-4 py-3.5 text-[13px] leading-[1.45] text-[#3B3D39]" data-testid="aviso-su-cuenta">
              Su cuenta no está en la app, así que este pago cuenta como <b>aporte de {{ hoja.miembros.nombreDe(quien()) }}</b> en {{ mesNombre }}. No tiene que registrar nada más.
            </p>
          }
          @if (error()) {
            <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
          }
          <button type="button" class="boton-grande" [disabled]="!monto() || !quien() || guardando()" (click)="guardar(e.item.id)">Marcar pagado</button>
        }
      } @else if (!resumen.isLoading()) {
        <p class="text-secundario">Ese gasto no está en el plan del mes.</p>
      }
    </app-hoja>
  `,
})
export class PagarHoja {
  private readonly puertos = inject(PUERTOS);
  private readonly sesion = inject(SesionActual);
  protected readonly hoja = opcionesDeHoja();
  protected readonly suCuenta = SU_CUENTA;

  /** Parametro de la ruta (`/hoy/pagar/:itemId`). */
  readonly itemId = input.required<Id>();

  private readonly ref = mesDe(this.puertos.hoy());
  protected readonly mesNombre = nombreMes(this.ref.mes);
  protected readonly resumen = consulta(() => this.ref, (p, ref) => p.movimientos.resumenMes(ref));
  private readonly categorias = consulta(() => null, (p) => p.hogar.categorias());

  protected readonly ejecucion = computed(() => {
    const r = this.resumen.value();
    return [...(r?.porPagar ?? []), ...(r?.yaPagado ?? [])].find((i) => i.item.id === this.itemId()) ?? null;
  });
  protected readonly categoria = computed(() => this.categorias.value()?.find((c) => c.id === this.ejecucion()?.item.categoriaId) ?? null);
  protected readonly vence = computed(() => {
    const dia = this.ejecucion()?.item.diaVence;
    return dia ? ` · vence ${formatFechaCorta(fechaEnMes(this.ref, dia))}` : '';
  });
  protected readonly yaPagado = computed(() => {
    const e = this.ejecucion();
    if (!e?.pagado || e.item.tipo === 'VARIABLE') return null;
    const pago = e.pagos[0]!;
    return `Ya lo pagó ${this.hoja.miembros.nombreDe(pago.usuarioId)} el ${formatFechaCorta(pago.fecha)}`;
  });

  protected readonly monto = signal<number | null>(null);
  protected readonly quien = signal<Id | null>(this.sesion.usuario()?.id ?? null);
  protected readonly desde = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Prellenado con el plan en cuanto se conoce el item.
    effect(() => {
      const e = this.ejecucion();
      if (e && this.monto() === null && !e.pagado) this.monto.set(e.plan);
    });
  }

  protected async guardar(itemId: Id): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.puertos.movimientos.marcarPago({ itemId, ref: this.ref, monto: this.monto()!, usuarioId: this.quien()!, origen: this.hoja.origen(this.desde()) });
      await this.hoja.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
