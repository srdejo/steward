import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatTasa, nombreMes, type Credito, type MesRef, type VistaCredito } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { MetodoHoja } from './metodo-hoja';

const METODO: Record<Credito['metodo'], string> = { TASA: 'Con la tasa', PLAN: 'Plan de pagos', MANUAL: 'A mano' };
const CHIP: Record<Credito['metodo'], string> = { TASA: 'bg-acento-suave text-[#163A2C]', PLAN: 'bg-[#EAF0F8] text-[#1F4470]', MANUAL: 'bg-[#F3F2EE] text-secundario' };

/**
 * La pestaña Creditos de Cuentas (spec steward-cuentas, "Proyeccion de creditos"): lo que deben, lo que pagan al mes, los
 * indicadores del año, la tabla de creditos con el elegido al lado y la proyeccion a 6 meses (CreditosWeb.dc.html); en
 * movil, una tarjeta por credito (CreditosMovil.dc.html).
 */
@Component({
  selector: 'app-creditos-tab',
  imports: [RouterLink, Hoja, Monto, MontoInput, MetodoHoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5' },
  template: `
    @if (resumen.value(); as r) {
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex gap-10">
          <div class="flex flex-col gap-1">
            <span class="rotulo">Deben en créditos</span>
            <app-monto class="text-[30px] font-semibold" [valor]="r.deben" data-testid="deben-creditos" />
          </div>
          @if (!escritorio()) {
            <div class="flex flex-col gap-1">
              <span class="rotulo">Pagan al mes</span>
              <app-monto class="text-[30px] font-semibold text-[#4A4E48]" [valor]="r.pagan" data-testid="pagan-mes" />
            </div>
          }
        </div>
        <button type="button" class="boton h-10 rounded-[10px] bg-acento px-4 text-sm text-white" (click)="nuevo.set(true)">+ Crédito</button>
      </div>

      @if (!r.creditos.length) {
        <p class="text-sm text-secundario">Sin créditos.</p>
      } @else if (escritorio()) {
        <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <div class="tarjeta flex flex-col gap-1 px-[18px] py-4">
            <span class="text-xs text-secundario">Pagan al mes</span>
            <app-monto class="text-xl font-semibold" [valor]="r.pagan" data-testid="pagan-mes" />
            <span class="text-xs text-secundario">Entra solo al plan en Créditos</span>
          </div>
          <div class="tarjeta flex flex-col gap-1 px-[18px] py-4">
            <span class="text-xs text-secundario">Deberán al cerrar {{ anio() }}</span>
            <app-monto class="text-xl font-semibold" [valor]="r.deberanAlCerrar" data-testid="deberan-cerrar" />
            <span class="text-xs text-positivo">−<app-monto [valor]="r.bajaAlCerrar" /> desde hoy</span>
          </div>
          <div class="flex flex-col gap-1 rounded-[14px] bg-[#FBE9E7] px-[18px] py-4 text-[#8C1D18]">
            <span class="text-xs">Intereses en {{ anio() + 1 }}</span>
            <app-monto class="text-xl font-semibold" [valor]="r.interesesAnioSiguiente" data-testid="intereses-anio" />
            <span class="text-xs">Proyectados con la tasa de cada crédito</span>
          </div>
        </div>

        <div class="flex flex-wrap items-start gap-5">
          <div class="flex min-w-0 flex-[2_1_640px] flex-col gap-5">
            <section class="tarjeta overflow-hidden" aria-label="Créditos">
              <div class="overflow-x-auto">
                <table class="w-full min-w-[700px] border-collapse text-sm" data-testid="tabla-creditos">
                  <thead>
                    <tr class="bg-fondo text-left text-[11px] font-semibold tracking-[0.06em] text-secundario">
                      <th scope="col" class="px-5 py-2.5">CRÉDITO</th><th scope="col" class="py-2.5 pr-3">CÓMO BAJA</th><th scope="col" class="py-2.5 pr-3">PAGO</th>
                      <th scope="col" class="py-2.5 pr-3 text-right">CUOTA</th><th scope="col" class="py-2.5 pr-3 text-right">DEBEN HOY</th><th scope="col" class="py-2.5 pr-5">TERMINA</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of r.creditos; track v.credito.id) {
                      <tr class="cursor-pointer border-t border-divisor" [class]="v.credito.id === elegido()?.credito?.id ? 'bg-[#F3F1F8] shadow-[inset_3px_0_0_#6B5BA8]' : 'hover:bg-fondo'"
                        (click)="elegir(v.credito.id)" [attr.data-credito]="v.credito.nombre">
                        <th scope="row" class="px-5 py-3 text-left font-semibold">
                          <button type="button" class="text-left" [attr.aria-pressed]="v.credito.id === elegido()?.credito?.id" (click)="elegir(v.credito.id)">{{ v.credito.nombre }}</button>
                          <span class="block text-xs font-normal text-secundario">{{ v.credito.entidad }}{{ v.credito.metodo === 'TASA' ? ' · ' + tasa(v.credito.tasaEM) : '' }}</span>
                        </th>
                        <td class="py-3 pr-3"><span class="rounded-[10px] px-2.5 py-0.5 text-[11px] font-semibold" [class]="chip[v.credito.metodo]">{{ metodo[v.credito.metodo] }}</span></td>
                        <td class="py-3 pr-3 text-[13px] text-[#4A4E48]">Día {{ v.credito.diaPago }}</td>
                        <td class="monto py-3 pr-3 text-right text-[13px]"><app-monto [valor]="v.credito.cuota" /></td>
                        <td class="monto py-3 pr-3 text-right text-[13px] font-semibold"><app-monto [valor]="v.credito.saldo" /></td>
                        <td class="py-3 pr-5 text-[13px] text-[#4A4E48]">{{ termina(v) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            <section class="tarjeta overflow-hidden" aria-labelledby="proyeccion">
              <div class="flex flex-col gap-0.5 border-b border-divisor px-5 py-4">
                <h2 id="proyeccion" class="text-base font-semibold">Cuánto deberían al final de cada mes</h2>
                <p class="text-[13px] text-secundario">Calculado con la tasa o con el plan de pagos de cada crédito. Se corrige solo cuando escriben el saldo de un extracto.</p>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[760px] border-collapse text-sm" data-testid="tabla-proyeccion">
                  <thead>
                    <tr class="bg-fondo text-[11px] font-semibold tracking-[0.06em] text-secundario">
                      <th scope="col" class="px-5 py-2.5 text-left">CRÉDITO</th>
                      @for (m of r.meses; track m.mes) {
                        <th scope="col" class="py-2.5 pr-3 text-right">{{ corto(m) }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of r.creditos; track v.credito.id) {
                      <tr class="border-t border-divisor" [class.bg-[#F6F3FD]]="v.credito.id === elegido()?.credito?.id">
                        <th scope="row" class="px-5 py-[11px] text-left font-normal">{{ v.credito.nombre }}</th>
                        @for (s of v.proyeccion; track $index) {
                          <td class="monto py-[11px] pr-3 text-right text-xs"><app-monto [valor]="s" /></td>
                        }
                      </tr>
                    }
                    <tr class="border-t border-borde">
                      <th scope="row" class="px-5 py-3.5 text-left font-semibold">Total</th>
                      @for (t of r.totales; track $index) {
                        <td class="py-3.5 pr-3 align-bottom">
                          <span class="flex flex-col items-end gap-1.5">
                            <span class="flex h-16 w-7 items-end" aria-hidden="true"><span class="w-7 rounded-t bg-cat-tarjetas opacity-85" [style.height.px]="barra(t, r.totales)"></span></span>
                            <app-monto class="text-xs font-semibold" [valor]="t" />
                          </span>
                        </td>
                      }
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          @if (elegido(); as v) {
            <aside class="tarjeta flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 p-[18px]" aria-label="Crédito elegido" data-testid="credito-elegido">
              <div class="flex flex-col gap-0.5">
                <span class="rotulo">{{ metodo[v.credito.metodo] }}</span>
                <span class="text-lg font-semibold">{{ v.credito.nombre }}</span>
              </div>
              <app-monto class="text-[26px] font-semibold" [valor]="v.credito.saldo" />
              @if (v.proxima; as p) {
                <div class="flex flex-col gap-1.5 rounded-[10px] bg-fondo p-3">
                  <span class="flex justify-between text-[13px]"><span>Próxima cuota · {{ mes(p.ref) }}</span><app-monto class="font-semibold" [valor]="p.interes + p.capital" /></span>
                  <span class="flex h-1.5 overflow-hidden rounded-[3px] bg-[#F0EEE9]" aria-hidden="true">
                    <span class="bg-cat-tarjetas" [style.width.%]="(100 * p.capital) / (p.capital + p.interes)"></span><span class="bg-[#E3A08A]" [style.width.%]="(100 * p.interes) / (p.capital + p.interes)"></span>
                  </span>
                  <span class="flex justify-between text-xs text-secundario"><span><app-monto [valor]="p.capital" /> a capital</span><span>@if (p.interes) {<app-monto [valor]="p.interes" /> intereses} @else {sin intereses}</span></span>
                </div>
              } @else if (v.actualizar) {
                <p class="rounded-lg bg-aviso-suave px-2.5 py-2 text-xs text-aviso">Actualiza el saldo con el extracto.</p>
              }
              <div class="flex flex-col gap-2 border-t border-divisor pt-3">
                <button type="button" class="boton h-[38px] rounded-[10px] border border-control bg-superficie text-[13px]" (click)="cambiar.set(v.credito)">Cambiar cómo baja el saldo</button>
                <button type="button" class="boton h-[38px] rounded-[10px] border border-control bg-superficie text-[13px]" (click)="corregir.set(v.credito)">Corregir con extracto</button>
                <a [routerLink]="['/cuentas/credito', v.credito.id]" class="boton-texto self-center text-[13px]">Ver detalle y probar un abono ›</a>
              </div>
            </aside>
          }
        </div>
      } @else {
        @for (v of r.creditos; track v.credito.id) {
          <a [routerLink]="['/cuentas/credito', v.credito.id]" class="tarjeta flex flex-col gap-3 p-4 hover:bg-fondo" [attr.data-credito]="v.credito.nombre">
            <span class="flex items-start justify-between gap-2">
              <span class="flex flex-col"><span class="text-[15px] font-semibold">{{ v.credito.nombre }}</span><span class="text-xs text-secundario">{{ v.credito.entidad }}</span></span>
              <span class="rounded-[10px] px-2.5 py-0.5 text-[11px] font-semibold" [class]="chip[v.credito.metodo]">{{ metodo[v.credito.metodo] }}{{ v.credito.metodo === 'TASA' ? ' · ' + tasa(v.credito.tasaEM) : '' }}</span>
            </span>
            <span class="flex items-baseline justify-between"><app-monto class="text-[22px] font-semibold" [valor]="v.credito.saldo" />
              @if (v.progreso; as g) {<span class="text-xs text-secundario">Cuota {{ g.actual }} de {{ g.total }}</span>}</span>
            @if (v.progreso; as g) {
              <span class="flex h-1.5 overflow-hidden rounded-[3px] bg-[#F0EEE9]" role="img" [attr.aria-label]="(g.actual - 1) + ' cuotas pagadas de ' + g.total">
                <span class="bg-cat-tarjetas" [style.width.%]="(100 * (g.actual - 1)) / g.total"></span>
              </span>
              <span class="flex justify-between text-xs text-secundario"><span>{{ g.actual - 1 }} pagadas</span><span>faltan {{ g.total - g.actual + 1 }}{{ v.termina ? ' · ' + mes(v.termina) : '' }}</span></span>
            }
            @if (v.proxima; as p) {
              <span class="flex justify-between border-t border-divisor pt-2.5 text-[13px]"><span>Próxima cuota · {{ mes(p.ref) }}</span><span class="text-secundario"><app-monto [valor]="p.capital" /> a capital</span></span>
            } @else if (v.actualizar) {
              <span class="text-xs font-medium text-aviso">Actualiza el saldo con el extracto</span>
            }
          </a>
        }
        <button type="button" class="boton-texto self-start font-semibold" (click)="nuevo.set(true)">+ Agregar crédito</button>
      }
    }

    @if (nuevo()) {
      <app-metodo-hoja (cerrar)="nuevo.set(false)" />
    }
    @if (cambiar(); as c) {
      <app-metodo-hoja [credito]="c" (cerrar)="cambiar.set(null)" />
    }
    @if (corregir(); as c) {
      <app-hoja titulo="Corregir con extracto" (cerrar)="corregir.set(null)">
        <app-monto-input etiqueta="Saldo que dice el extracto" [grande]="true" [(valor)]="saldoExtracto" />
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="saldoExtracto() === null" (click)="guardarExtracto(c)">Guardar</button>
      </app-hoja>
    }
  `,
})
export class CreditosTab {
  private readonly puertos = inject(PUERTOS);
  readonly escritorio = input(false);

  protected readonly resumen = consulta(() => null, (p) => p.cuentas.resumenCreditos());
  protected readonly metodo = METODO;
  protected readonly chip = CHIP;
  protected readonly anio = computed(() => Number(this.puertos.hoy().slice(0, 4)));

  /** El credito del panel de escritorio: el primero hasta que se elige otro. */
  private readonly elegidoId = linkedSignal<string | null>(() => this.resumen.value()?.creditos[0]?.credito.id ?? null);
  protected readonly elegido = computed<VistaCredito | null>(() => this.resumen.value()?.creditos.find((v) => v.credito.id === this.elegidoId()) ?? null);

  protected readonly nuevo = signal(false);
  protected readonly cambiar = signal<Credito | null>(null);
  protected readonly corregir = signal<Credito | null>(null);
  protected readonly saldoExtracto = signal<number | null>(null);
  protected readonly error = signal('');

  protected elegir(id: string): void {
    this.elegidoId.set(id);
  }

  protected tasa(t: number): string {
    return formatTasa(t);
  }

  protected mes(ref: MesRef): string {
    return `${nombreMes(ref.mes).slice(0, 3)} ${ref.anio}`;
  }

  protected corto(ref: MesRef): string {
    return nombreMes(ref.mes).slice(0, 3).toUpperCase();
  }

  protected termina(v: VistaCredito): string {
    if (v.credito.metodo === 'MANUAL') return 'A mano';
    return v.termina ? `${v.credito.metodo === 'TASA' ? '≈ ' : ''}${this.mes(v.termina)}` : '—';
  }

  protected barra(t: number, totales: number[]): number {
    const max = Math.max(...totales, 1);
    return Math.round((64 * t) / max);
  }

  protected async guardarExtracto(c: Credito): Promise<void> {
    this.error.set('');
    try {
      await this.puertos.cuentas.actualizarSaldo(c.id, this.saldoExtracto()!);
      this.corregir.set(null);
      this.saldoExtracto.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

}
