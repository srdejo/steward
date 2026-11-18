import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { claveMes, formatFechaCorta, formatTasa, mesDe, nombreMes, sumarMeses, type MesRef } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado } from '../../shared/components/segmentado';
import { anchoEscritorio } from '../../shared/escritorio';
import { opcionesDeHoja } from '../hoy/opciones-hoja';
import { MetodoHoja } from './metodo-hoja';

const METODO = { TASA: 'Baja solo con la tasa', PLAN: 'Sigue el plan de pagos', MANUAL: 'Lo actualizas a mano' } as const;
const DETALLE = {
  TASA: 'Al marcar la cuota pagada, se descuenta el capital.',
  PLAN: 'Al pagar una cuota, el saldo queda en lo que dice la tabla para esa cuota.',
  MANUAL: 'Escribe el saldo cuando llegue el extracto.',
} as const;

/** Abono que muestra el simulador al abrir (el de la Opción C de los artboards). */
const ABONO_INICIAL = 1_500_000;

/**
 * Credito.dc.html: saldo, como baja (con "Cambiar"), avance de cuotas, cuota, dia de pago y cuando termina, las
 * proximas cuotas con interes y capital, el simulador "¿Y si abonas extra?" con "Probarlo como opción" y los ultimos
 * pagos (spec steward-cuentas, tarjetas-y-creditos). Desde 1024 px, CreditoWeb.dc.html: indicadores, 12 cuotas con su barra
 * de capital e interes, los pagos con su cuenta y, al lado, el metodo, el simulador y "Eliminar crédito"
 * (credito-escritorio-y-eliminar).
 */
@Component({
  selector: 'app-credito-page',
  imports: [NgTemplateOutlet, RouterLink, Hoja, Monto, MontoInput, Segmentado, MetodoHoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-5 px-10 pt-7 pb-10' : 'flex flex-col gap-5 px-5 pt-6 pb-4'" },
  template: `
    <a routerLink="/cuentas" [queryParams]="{ pestana: 'creditos' }" class="boton-texto -my-2 self-start text-sm font-normal">‹ Créditos</a>

    @if (vista.value(); as v) {
      @if (escritorio()) {
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex flex-col gap-1">
            <span class="rotulo">Crédito · {{ v.credito.entidad }}</span>
            <h1 class="titular text-[28px] font-bold">{{ v.credito.nombre }}</h1>
            <div class="flex flex-wrap items-baseline gap-3">
              <app-monto class="text-[32px] font-semibold" [valor]="v.credito.saldo" data-testid="saldo" />
              <span class="text-[13px] text-secundario">Saldo actualizado el {{ fecha(v.credito.saldoActualizadoEn) }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="boton-secundario h-10 rounded-control px-3.5 text-sm" (click)="hoja.set('saldo')">Corregir con extracto</button>
            <button type="button" class="boton-primario h-10 rounded-control px-4 text-sm" (click)="hoja.set('abono')">Registrar abono</button>
          </div>
        </div>
        @if (v.actualizar) {
          <p class="rounded-lg bg-aviso-suave px-3 py-2 text-[13px] text-aviso" role="note">Ya pasó el día de pago: actualiza el saldo con el extracto.</p>
        }

        <div class="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3" data-testid="indicadores">
          <div class="flex flex-col gap-1 rounded-tarjeta bg-superficie px-[18px] py-4">
            <span class="text-xs text-secundario">Cuota</span>
            <app-monto class="text-xl font-semibold" [valor]="v.credito.cuota" />
            <span class="text-xs text-secundario">Día {{ v.credito.diaPago }} de cada mes</span>
          </div>
          <div class="flex flex-col gap-1.5 rounded-tarjeta bg-superficie px-[18px] py-4">
            <span class="text-xs text-secundario">Pagado</span>
            <span class="monto text-xl font-semibold">{{ v.porcentajePagado }}%</span>
            <div class="flex h-1.5 rounded bg-divisor" role="progressbar" [attr.aria-valuenow]="v.porcentajePagado" aria-valuemin="0" aria-valuemax="100" aria-label="Pagado del crédito">
              <span class="rounded bg-acento" [style.width.%]="v.porcentajePagado"></span>
            </div>
            <span class="text-xs text-secundario">de <app-monto [valor]="v.credito.totalOriginal" />{{ v.progreso ? ' · cuota ' + v.progreso.actual + ' de ' + v.progreso.total : '' }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded-tarjeta bg-superficie px-[18px] py-4">
            <span class="text-xs text-secundario">Termina</span>
            <span class="monto text-xl font-semibold" data-testid="termina">{{ v.termina ? (v.credito.metodo === 'TASA' ? '≈ ' : '') + mes(v.termina) : '—' }}</span>
            <span class="text-xs text-secundario">{{ v.cuotasRestantes !== null ? 'Faltan ' + v.cuotasRestantes + ' cuotas' : 'Lo actualizas con el extracto' }}</span>
          </div>
          @if (v.interesesAnioSiguiente) {
            <div class="flex flex-col gap-1 rounded-[14px] bg-[#FBE9E7] px-[18px] py-4 text-[#8C1D18]" data-testid="intereses-anio">
              <span class="text-xs">Intereses en {{ anioSiguiente }}</span>
              <app-monto class="text-xl font-semibold" [valor]="v.interesesAnioSiguiente" />
              <span class="text-xs">Con la tasa de {{ tasa(v.credito.tasaEM) }}</span>
            </div>
          }
        </div>

        <div class="flex flex-wrap items-start gap-5">
          <div class="flex min-w-0 flex-[2_1_600px] flex-col gap-5">
            @if (v.proximasAnio.length) {
              <section class="overflow-hidden rounded-tarjeta bg-superficie" aria-labelledby="proximas-web">
                <div class="flex items-baseline justify-between gap-3 border-b border-divisor px-5 py-4">
                  <h2 id="proximas-web" class="text-base font-semibold">Próximas cuotas</h2>
                  <span class="flex gap-3.5 text-xs text-secundario">
                    <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-[2px] bg-acento"></span>Capital</span>
                    <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-[2px] bg-[#E3A08A]"></span>Interés</span>
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[620px] border-collapse text-[13px]" data-testid="proximas-cuotas">
                    <thead>
                      <tr class="bg-fondo text-[11px] font-semibold tracking-[0.06em] text-secundario">
                        <th scope="col" class="w-[110px] px-5 py-2.5 text-left">CUOTA</th>
                        <th scope="col" class="px-3 py-2.5 text-left">A CAPITAL E INTERÉS</th>
                        <th scope="col" class="w-[110px] px-3 py-2.5 text-right">INTERÉS</th>
                        <th scope="col" class="w-[110px] px-3 py-2.5 text-right">CAPITAL</th>
                        <th scope="col" class="w-[140px] px-5 py-2.5 text-right">QUEDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (q of v.proximasAnio; track q.k) {
                        <tr class="border-t border-[#F0EEE9]">
                          <th scope="row" class="px-5 py-2 text-left font-normal">
                            <span class="block font-semibold">{{ q.k }}{{ v.progreso ? ' / ' + v.progreso.total : '' }}</span>
                            <span class="block text-[11px] text-secundario">{{ mes(q.ref) }}</span>
                          </th>
                          <td class="px-3 py-2">
                            <span class="flex h-2 overflow-hidden rounded bg-divisor" aria-hidden="true">
                              <span class="bg-acento" [style.width.%]="parteCapital(q.capital, q.interes)"></span>
                              <span class="bg-[#E3A08A]" [style.width.%]="100 - parteCapital(q.capital, q.interes)"></span>
                            </span>
                          </td>
                          <td class="px-3 py-2 text-right text-[#A6553B]"><app-monto [valor]="q.interes" /></td>
                          <td class="px-3 py-2 text-right"><app-monto [valor]="q.capital" /></td>
                          <td class="px-5 py-2 text-right font-semibold"><app-monto [valor]="q.saldo" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>
            }
            <section class="overflow-hidden rounded-tarjeta bg-superficie" aria-labelledby="pagos-web">
              <h2 id="pagos-web" class="border-b border-divisor px-5 py-4 text-base font-semibold">Últimos pagos</h2>
              @for (p of v.pagos.slice(0, 8); track $index) {
                <div class="grid grid-cols-[minmax(160px,1fr)_160px_130px] items-center gap-3 border-t border-[#F0EEE9] px-5 py-2.5 text-[13px] first-of-type:border-t-0" data-testid="pago">
                  <span>{{ p.tipo === 'CUOTA' ? 'Cuota' : 'Abono' }} · {{ fecha(p.fecha) }}</span>
                  <span class="text-secundario">{{ p.desde ?? '—' }}</span>
                  <app-monto class="text-right" [valor]="p.monto" />
                </div>
              } @empty {
                <p class="px-5 py-3 text-sm text-secundario">Aún no hay pagos registrados.</p>
              }
            </section>
          </div>

          <aside class="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <section class="flex flex-col gap-2 rounded-[14px] bg-acento-suave p-4" data-testid="metodo">
              <span class="text-xs font-semibold tracking-[0.06em] text-acento-oscuro">CÓMO BAJA EL SALDO</span>
              <span class="text-sm font-semibold text-acento-oscuro">{{ metodo[v.credito.metodo] }}{{ v.credito.metodo === 'MANUAL' ? '' : ' · ' + tasa(v.credito.tasaEM) }}</span>
              <span class="text-[13px] leading-[1.45] text-[#3B5A48]">{{ detalle[v.credito.metodo] }}</span>
              <button type="button" class="boton-texto self-start font-semibold" (click)="cambiando.set(true)">Cambiar</button>
            </section>
            <ng-container [ngTemplateOutlet]="simulador" />
            <section class="flex flex-col gap-2 rounded-tarjeta bg-superficie p-4">
              <span class="text-sm font-semibold">¿Ya no lo tienen?</span>
              <span class="text-[13px] leading-[1.45] text-secundario">Si lo pagaron completo, lo trasladaron o lo agregaron por error, elimínalo. Los pagos registrados se quedan en el historial.</span>
              <button type="button" class="boton h-10 self-start rounded-control border border-[#E3B6A8] bg-superficie px-3.5 text-[13px] text-negativo" (click)="eliminando.set(true)">Eliminar crédito</button>
            </section>
          </aside>
        </div>
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
      } @else {
      <div class="flex flex-col gap-1.5">
        <span class="rotulo">Crédito · {{ v.credito.entidad }}</span>
        <h1 class="titular text-[26px] font-bold">{{ v.credito.nombre }}</h1>
        <app-monto class="text-[30px] font-semibold" [valor]="v.credito.saldo" />
        <span class="text-[13px] text-secundario">Saldo actualizado el {{ fecha(v.credito.saldoActualizadoEn) }}</span>
      </div>

      <div class="flex items-center justify-between gap-3 rounded-xl bg-acento-suave px-3.5 py-3" data-testid="metodo">
        <span class="flex flex-col gap-0.5"><span class="text-sm font-semibold">{{ metodo[v.credito.metodo] }}{{ v.credito.metodo === 'MANUAL' ? '' : ' · ' + tasa(v.credito.tasaEM) }}</span><span class="text-xs text-secundario">{{ detalle[v.credito.metodo] }}</span></span>
        <button type="button" class="boton-texto font-semibold" (click)="cambiando.set(true)">Cambiar</button>
      </div>
      @if (v.actualizar) {
        <p class="rounded-lg bg-aviso-suave px-3 py-2 text-[13px] text-aviso" role="note">Ya pasó el día de pago: actualiza el saldo con el extracto.</p>
      }

      <div class="flex flex-col gap-2">
        @if (v.progreso; as g) {
          <div class="flex justify-between text-sm"><span class="font-semibold">Cuota {{ g.actual }} de {{ g.total }}</span><span class="text-secundario">{{ g.actual - 1 }} pagadas · faltan {{ g.total - g.actual + 1 }}</span></div>
        }
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
        <div class="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-3"><span class="text-[11px] text-secundario">Paga el</span><span class="monto text-[13px] font-semibold">Día {{ v.credito.diaPago }}</span></div>
        <div class="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-3"><span class="text-[11px] text-secundario">Termina</span><span class="monto text-[13px] font-semibold" data-testid="termina">{{ v.termina ? (v.credito.metodo === 'TASA' ? '≈ ' : '') + mes(v.termina) : '—' }}</span></div>
      </div>

      @if (v.proximas.length) {
        <section class="flex flex-col gap-1" aria-labelledby="proximas">
          <div class="flex items-baseline justify-between"><h2 id="proximas" class="text-base font-semibold">Próximas cuotas</h2>
            @if (v.cuotasRestantes !== null) {<span class="text-xs text-secundario">Faltan {{ v.cuotasRestantes }} cuotas</span>}</div>
          <table class="w-full border-collapse text-sm" data-testid="proximas-cuotas">
            <thead><tr class="text-[11px] font-semibold tracking-[0.06em] text-secundario"><th scope="col" class="py-2 text-left">CUOTA</th><th scope="col" class="py-2 text-right">INTERÉS</th><th scope="col" class="py-2 text-right">CAPITAL</th><th scope="col" class="py-2 text-right">QUEDA</th></tr></thead>
            <tbody>
              @for (q of v.proximas; track q.k) {
                <tr class="border-t border-divisor">
                  <th scope="row" class="py-2 text-left font-normal">{{ q.k }}{{ v.progreso ? ' / ' + v.progreso.total : '' }} <span class="text-xs text-secundario">{{ mesCorto(q.ref) }}</span></th>
                  <td class="monto py-2 text-right text-xs"><app-monto [valor]="q.interes" /></td>
                  <td class="monto py-2 text-right text-xs"><app-monto [valor]="q.capital" /></td>
                  <td class="monto py-2 text-right text-xs font-semibold"><app-monto [valor]="q.saldo" /></td>
                </tr>
              }
            </tbody>
          </table>
          @if (v.interesesAnioSiguiente) {
            <p class="rounded-lg bg-[#FBE9E7] px-3 py-2 text-[13px] text-[#8C1D18]" data-testid="intereses-anio">En {{ anioSiguiente }} pagarías <app-monto [valor]="v.interesesAnioSiguiente" [siempreVisible]="true" /> en intereses.</p>
          }
        </section>
      }

      <ng-container [ngTemplateOutlet]="simulador" />

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
        <button type="button" class="boton h-[50px] rounded-[14px] border border-[#D9D8D2] bg-superficie text-sm" (click)="hoja.set('saldo')">Corregir con extracto</button>
        <button type="button" class="boton h-[50px] rounded-[14px] bg-acento text-sm text-white" (click)="hoja.set('abono')">Registrar abono</button>
      </div>
      <button type="button" class="boton-texto self-center font-semibold text-negativo" (click)="eliminando.set(true)">Eliminar crédito</button>
      }

      @if (hoja(); as h) {
        <app-hoja [titulo]="h === 'saldo' ? 'Corregir con extracto' : 'Registrar abono'" (cerrar)="hoja.set(null)">
          <app-monto-input [etiqueta]="h === 'saldo' ? 'Saldo que dice el extracto' : '¿Cuánto abonaste?'" [grande]="true" [(valor)]="monto" />
          @if (h === 'abono') {
            <!-- Desde donde salio el abono, como en Marcar pago (spec steward-cuentas). -->
            <app-segmentado etiqueta="Desde · Opcional" [chips]="true" [opcional]="true" [opciones]="opciones.desde()" [(valor)]="desde" />
          }
          <button type="button" class="boton-grande" [disabled]="monto() === null" (click)="guardar(h)">Guardar</button>
        </app-hoja>
      }
      @if (cambiando()) {
        <app-metodo-hoja [credito]="v.credito" (cerrar)="cambiando.set(false)" />
      }
      @if (eliminando()) {
        <app-hoja [titulo]="'¿Eliminar ' + v.credito.nombre + '?'" (cerrar)="eliminando.set(false)">
          <p class="text-[15px] leading-normal text-[#4A4E48]">Sale de Créditos y su cuota sale del plan de {{ mesActual }} en adelante.</p>
          <div class="flex flex-col gap-1.5 rounded-xl bg-nota px-4 py-3 text-[13px] text-[#4A4E48]" data-testid="que-se-conserva">
            <span>{{ conservan(v.pagos.length) }}</span>
            <span>Si la cuota de este mes ya tiene un pago, se queda en el plan.</span>
          </div>
          @if (error()) {
            <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
          }
          <button type="button" class="boton-grande bg-negativo hover:bg-negativo" [disabled]="guardando()" (click)="eliminar()">Eliminar crédito</button>
        </app-hoja>
      }
    } @else if (!vista.isLoading()) {
      <p class="text-secundario">Ese crédito no existe.</p>
    }

    <ng-template #simulador>
        <section class="flex flex-col gap-2.5 rounded-[14px] bg-acento-suave p-4" aria-labelledby="simulador">
          <h2 id="simulador" class="text-sm font-semibold text-acento-oscuro">¿Y si abonas extra?</h2>
          <div class="flex items-center justify-between gap-3">
            <span class="text-[13px] text-[#4A4E48]" aria-hidden="true">Abono</span>
            <app-monto-input class="w-[150px]" etiquetaAccesible="Abono" [(valor)]="abono" />
          </div>
          @if (simulacion.value(); as s) {
            <p class="text-[13px] leading-normal text-acento-oscuro" data-testid="simulacion">≈ {{ s.cuotasMenos }} cuotas menos y ≈ <app-monto [valor]="s.interesesMenos" [siempreVisible]="true" /> menos en intereses.</p>
          } @else if (abono()) {
            <p class="text-[13px] text-acento-oscuro">Ese abono cubre el saldo o no cambia el plazo.</p>
          }
          <button type="button" class="boton-texto self-start font-semibold" [disabled]="!abono()" (click)="probar()">Probarlo como opción de {{ mesSiguiente }} ›</button>
        </section>
    </ng-template>
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
  protected readonly anioSiguiente = mesDe(this.puertos.hoy()).anio + 1;
  protected readonly metodo = METODO;
  protected readonly detalle = DETALLE;
  protected readonly cambiando = signal(false);
  protected readonly eliminando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly escritorio = anchoEscritorio();
  protected readonly mesActual = nombreMes(mesDe(this.puertos.hoy()).mes);

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

  /** "dic 2029". */
  protected mes(ref: MesRef): string {
    return `${nombreMes(ref.mes).slice(0, 3)} ${ref.anio}`;
  }

  protected mesCorto(ref: MesRef): string {
    return nombreMes(ref.mes).slice(0, 3);
  }

  /** Que parte de la cuota va a capital, en porcentaje. */
  protected parteCapital(capital: number, interes: number): number {
    const total = capital + interes;
    return total > 0 ? Math.round((100 * capital) / total) : 100;
  }

  protected conservan(n: number): string {
    if (n === 0) return 'No tiene pagos registrados.';
    return n === 1 ? 'Se conserva el pago registrado, en el historial de las cuentas.' : `Se conservan los ${n} pagos registrados, en el historial de las cuentas.`;
  }

  /** "Eliminar crédito" (design D2): vuelve a la pestaña Créditos. */
  protected async eliminar(): Promise<void> {
    this.guardando.set(true);
    await this.ejecutar(async () => {
      await this.puertos.cuentas.eliminarCredito(this.id());
      this.eliminando.set(false);
      await this.router.navigate(['/cuentas'], { queryParams: { pestana: 'creditos' } });
    });
    this.guardando.set(false);
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
