import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { claveMes, formatFechaCorta, formatTasa, mesDe, nombreMes, sumarMeses } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado } from '../../shared/components/segmentado';
import { opcionesDeHoja } from '../hoy/opciones-hoja';

/** Abono que muestra el simulador al abrir (el de la Opción C de los artboards). */
const ABONO_INICIAL = 1_500_000;

/**
 * Credito.dc.html: saldo, avance, cuota, tasa y dia de pago, el simulador "¿Y si abonas extra?" con
 * "Probarlo como opción" (crea un escenario en el mes siguiente) y los ultimos pagos.
 */
@Component({
  selector: 'app-credito-page',
  imports: [RouterLink, Hoja, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5 px-5 pt-6 pb-4' },
  template: `
    <a routerLink="/cuentas" class="boton-texto -my-2 self-start text-sm font-normal">‹ Cuentas</a>

    @if (vista.value(); as v) {
      <div class="flex flex-col gap-1.5">
        <span class="rotulo">Crédito · {{ v.credito.entidad }}</span>
        <h1 class="text-[26px] font-bold">{{ v.credito.nombre }}</h1>
        <app-monto class="text-[30px] font-semibold" [valor]="v.credito.saldo" />
        <span class="text-[13px] text-secundario">Saldo actualizado el {{ fecha(v.credito.saldoActualizadoEn) }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex h-2 rounded bg-borde" role="progressbar" [attr.aria-valuenow]="v.porcentajePagado" aria-valuemin="0" aria-valuemax="100" aria-label="Pagado del crédito">
          <span class="rounded bg-acento" [style.width.%]="v.porcentajePagado"></span>
        </div>
        <div class="flex justify-between text-xs text-secundario">
          <span>Pagado {{ v.porcentajePagado }}% de <app-monto [valor]="v.credito.totalOriginal" /></span>
          @if (v.cuotasRestantes !== null) {
            <span>Faltan {{ v.cuotasRestantes }} cuotas</span>
          }
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-3"><span class="text-[11px] text-secundario">Cuota</span><app-monto class="text-[13px] font-semibold" [valor]="v.credito.cuota" /></div>
        <div class="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-3"><span class="text-[11px] text-secundario">Tasa</span><span class="monto text-[13px] font-semibold">{{ tasa(v.credito.tasaEM) }}</span></div>
        <div class="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-3"><span class="text-[11px] text-secundario">Paga el</span><span class="monto text-[13px] font-semibold">Día {{ v.credito.diaPago }}</span></div>
      </div>

      <section class="flex flex-col gap-2.5 rounded-[14px] bg-acento-suave p-4" aria-labelledby="simulador">
        <h2 id="simulador" class="text-sm font-semibold text-acento-oscuro">¿Y si abonas extra?</h2>
        <div class="flex items-center justify-between gap-3">
          <span class="text-[13px] text-[#3B3D39]" aria-hidden="true">Abono</span>
          <app-monto-input class="w-[150px]" etiquetaAccesible="Abono" [(valor)]="abono" />
        </div>
        @if (simulacion.value(); as s) {
          <p class="text-[13px] leading-normal text-acento-oscuro" data-testid="simulacion">≈ {{ s.cuotasMenos }} cuotas menos y ≈ <app-monto [valor]="s.interesesMenos" [siempreVisible]="true" /> menos en intereses.</p>
        } @else if (abono()) {
          <p class="text-[13px] text-acento-oscuro">Ese abono cubre el saldo o no cambia el plazo.</p>
        }
        <button type="button" class="boton-texto self-start font-semibold" [disabled]="!abono()" (click)="probar()">Probarlo como opción de {{ mesSiguiente }} ›</button>
      </section>

      <section class="flex flex-col gap-1" aria-labelledby="ultimos-pagos">
        <h2 id="ultimos-pagos" class="text-base font-semibold">Últimos pagos</h2>
        <div class="flex flex-col divide-y divide-divisor">
          @for (p of v.credito.pagos.slice(0, 5); track $index) {
            <div class="flex justify-between py-2.5 text-sm">
              <span>{{ p.tipo === 'CUOTA' ? 'Cuota' : 'Abono' }} · {{ fecha(p.fecha) }}</span>
              <app-monto [valor]="p.monto" />
            </div>
          } @empty {
            <p class="py-2.5 text-sm text-secundario">Aún no hay pagos registrados.</p>
          }
        </div>
      </section>

      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }

      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="boton h-[50px] rounded-[14px] border border-[#D9D8D2] bg-superficie text-sm" (click)="hoja.set('saldo')">Actualizar saldo</button>
        <button type="button" class="boton h-[50px] rounded-[14px] bg-acento text-sm text-white" (click)="hoja.set('abono')">Registrar abono</button>
      </div>

      @if (hoja(); as h) {
        <app-hoja [titulo]="h === 'saldo' ? 'Actualizar saldo' : 'Registrar abono'" (cerrar)="hoja.set(null)">
          <app-monto-input [etiqueta]="h === 'saldo' ? 'Saldo que dice el banco' : '¿Cuánto abonaste?'" [grande]="true" [(valor)]="monto" />
          @if (h === 'abono') {
            <!-- Desde donde salio el abono, como en Marcar pago (spec steward-cuentas). -->
            <app-segmentado etiqueta="Desde · Opcional" [chips]="true" [opcional]="true" [opciones]="opciones.desde()" [(valor)]="desde" />
          }
          <button type="button" class="boton-grande" [disabled]="monto() === null" (click)="guardar(h)">Guardar</button>
        </app-hoja>
      }
    } @else if (!vista.isLoading()) {
      <p class="text-secundario">Ese crédito no existe.</p>
    }
  `,
})
export class CreditoPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);

  /** Parametro de la ruta (`/cuentas/credito/:id`). */
  readonly id = input.required<string>();
  protected readonly vista = consulta(() => this.id(), (p, id) => p.cuentas.credito(id));

  private readonly siguiente = sumarMeses(mesDe(this.puertos.hoy()), 1);
  protected readonly mesSiguiente = nombreMes(this.siguiente.mes);

  protected readonly abono = signal<number | null>(ABONO_INICIAL);
  protected readonly simulacion = consulta(() => ({ id: this.id(), abono: this.abono() ?? 0 }), (p, x) => p.cuentas.simular(x.id, x.abono));
  protected readonly hoja = signal<'saldo' | 'abono' | null>(null);
  protected readonly monto = signal<number | null>(null);
  protected readonly opciones = opcionesDeHoja();
  protected readonly desde = signal<string | null>(null);
  protected readonly error = signal('');

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected tasa(t: number): string {
    return formatTasa(t);
  }

  protected async probar(): Promise<void> {
    await this.ejecutar(async () => {
      await this.puertos.cuentas.probarComoOpcion(this.id(), this.siguiente, this.abono()!);
      await this.router.navigate(['/planear', claveMes(this.siguiente)]);
    });
  }

  protected async guardar(tipo: 'saldo' | 'abono'): Promise<void> {
    await this.ejecutar(async () => {
      if (tipo === 'saldo') await this.puertos.cuentas.actualizarSaldo(this.id(), this.monto()!);
      else await this.puertos.cuentas.registrarAbono(this.id(), this.monto()!, this.opciones.origen(this.desde()));
      this.hoja.set(null);
      this.monto.set(null);
      this.desde.set(null);
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.error.set('');
    try {
      await accion();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }
}
