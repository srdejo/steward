import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { fechaEnMes, formatFechaCorta, nombreMes, parseClaveMes, type Id } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { SesionActual } from '../../core/sesion/sesion';
import { DatosPago } from '../../shared/components/datos-pago';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado } from '../../shared/components/segmentado';
import { MesDeHoy } from './mes-de-hoy';
import { SU_CUENTA, opcionesDeHoja } from './opciones-hoja';

/**
 * Pagar.dc.html: valor prellenado con el plan, quien pago y desde donde. Desde "Su cuenta" el pago cuenta
 * ademas como aporte de quien pago. Si ya estaba pagado avisa "Ya lo pagó X el dd mmm" (spec steward-hoy).
 */
@Component({
  selector: 'app-pagar-hoja',
  imports: [NgTemplateOutlet, RouterLink, DatosPago, Hoja, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #cuerpo>
      @if (mesHoy.aviso(); as aviso) {
        <p class="rounded-xl bg-acento-suave px-4 py-2.5 text-[13px] font-medium text-acento" data-testid="aviso-mes">{{ aviso }}</p>
      }
      @if (ejecucion(); as e) {

        @if (yaPagado(); as aviso) {
          <p role="status" class="rounded-xl bg-aviso-suave px-4 py-3.5 text-sm text-aviso" data-testid="ya-pagado">{{ aviso }}</p>
          <button type="button" class="boton-grande" (click)="hoja.cerrar()">Entendido</button>
          <a [routerLink]="['/hoy/registro', e.pagos[0]!.id]" class="boton-texto self-center">Abrir ese pago</a>
        } @else {
          <app-datos-pago [enlace]="e.item.enlacePago" [codigo]="e.item.codigoPago" />
          <app-monto-input etiqueta="Valor pagado" [grande]="true" [(valor)]="monto" ayuda="Viene lleno con el plan. Si pagas otro valor, la diferencia se ve en el mes." />
          <app-segmentado etiqueta="Pagado por" [opciones]="hoja.personas()" [(valor)]="quien" />
          <app-segmentado etiqueta="Desde · Opcional" [chips]="true" [opcional]="true" [opciones]="hoja.desde()" [(valor)]="desde" />
          @if (desde() === suCuenta) {
            <p class="flex gap-3 rounded-xl bg-nota px-4 py-3.5 text-[13px] leading-[1.45] text-[#4A4E48]" data-testid="aviso-su-cuenta">
              Su cuenta no está en la app, así que este pago cuenta como <b>aporte de {{ hoja.miembros.nombreDe(quien()) }}</b> en {{ mesNombre() }}. No tiene que registrar nada más.
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
    </ng-template>
    @if (incrustada()) {
      <div class="flex flex-col gap-[22px]">
        @if (ejecucion(); as e) {
          <div class="flex flex-col gap-0.5" data-testid="pago-elegido">
            <span class="text-[17px] font-semibold">{{ e.item.nombre }}</span>
            <span class="text-[13px] text-secundario">{{ e.categoriaNombre }} · Plan <app-monto [valor]="e.plan" />{{ vence() }}</span>
          </div>
        }
        <ng-container [ngTemplateOutlet]="cuerpo" />
      </div>
    } @else {
      <app-hoja [titulo]="ejecucion()?.item?.nombre ?? 'Marcar pago'" [antetitulo]="ejecucion()?.categoriaNombre ?? ''" [colorAntetitulo]="categoria()?.color ?? null" (cerrar)="hoja.cerrar()">
        @if (ejecucion(); as e) {
          <span subtitulo class="text-[13px] text-secundario">Plan <app-monto [valor]="e.plan" />{{ vence() }}</span>
        }
        <ng-container [ngTemplateOutlet]="cuerpo" />
      </app-hoja>
    }
  `,
})
export class PagarHoja {
  private readonly puertos = inject(PUERTOS);
  private readonly sesion = inject(SesionActual);
  protected readonly hoja = opcionesDeHoja();
  protected readonly suCuenta = SU_CUENTA;

  /** Parametro de la ruta (`/hoy/pagar/:itemId`), o el item elegido en Agregar. */
  readonly itemId = input.required<Id>();
  /** Dentro de Agregar: sin su propio marco de hoja; Agregar la abre y la cierra (design D3 de rediseno-libreta-clara). */
  readonly incrustada = input(false);
  /** El mes del pago (`2026-11`), cuando se marca desde Avisos un pago de otro mes que el de Hoy (avisos-pagos). */
  readonly mes = input<string | null>(null);

  protected readonly mesHoy = inject(MesDeHoy);
  private readonly ref = computed(() => parseClaveMes(this.mes() ?? '') ?? this.mesHoy.ref());
  protected readonly mesNombre = computed(() => nombreMes(this.ref().mes));
  protected readonly resumen = consulta(() => this.ref(), (p, ref) => p.movimientos.resumenMes(ref));
  private readonly categorias = consulta(() => null, (p) => p.hogar.categorias());

  protected readonly ejecucion = computed(() => {
    const r = this.resumen.value();
    return [...(r?.porPagar ?? []), ...(r?.yaPagado ?? [])].find((i) => i.item.id === this.itemId()) ?? null;
  });
  protected readonly categoria = computed(() => this.categorias.value()?.find((c) => c.id === this.ejecucion()?.item.categoriaId) ?? null);
  protected readonly vence = computed(() => {
    const dia = this.ejecucion()?.item.diaVence;
    return dia ? ` · vence ${formatFechaCorta(fechaEnMes(this.ref(), dia))}` : '';
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
      await this.puertos.movimientos.marcarPago({ itemId, ref: this.ref(), monto: this.monto()!, usuarioId: this.quien()!, origen: this.hoja.origen(this.desde()) });
      await this.hoja.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
