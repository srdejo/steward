import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DIAS_FECHAS, formatFechaCorta, nombreMes, type Fecha, type FechaTarjeta, type Tarjeta, type TonoVence } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { TarjetaHoja } from './tarjeta-hoja';

const TONO: Record<TonoVence, string> = { alerta: 'font-semibold text-negativo', aviso: 'font-semibold text-aviso', normal: 'text-secundario' };
const FONDO: Record<TonoVence, string> = { alerta: 'bg-[#FBEDE8]', aviso: 'bg-[#FBF4E2]', normal: 'bg-fondo' };

interface Dia {
  fecha: Fecha;
  numero: string;
  hoy: boolean;
  primero: boolean;
  eventos: FechaTarjeta[];
}

/**
 * La pestaña Tarjetas de Cuentas (spec steward-tarjetas): "Por pagar este ciclo", las proximas fechas (calendario de 5
 * semanas en escritorio, lista en movil) y cada tarjeta con su proximo pago, su proximo corte y su ayuda.
 */
@Component({
  selector: 'app-tarjetas-tab',
  imports: [Monto, TarjetaHoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5' },
  template: `
    @if (vista.value(); as v) {
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="rotulo">Por pagar este ciclo</span>
          <app-monto class="text-[30px] font-semibold" [valor]="v.porPagarCiclo" data-testid="por-pagar-ciclo" />
        </div>
        <button type="button" class="boton h-10 rounded-[10px] bg-acento px-4 text-sm text-white" (click)="abrir(null)">+ Tarjeta</button>
      </div>

      @if (!v.tarjetas.length) {
        <p class="text-sm text-secundario">Sin tarjetas. Agrega una con sus días de corte y de pago, y su línea entra al plan del mes.</p>
      } @else {
        @if (escritorio()) {
          <section class="tarjeta flex flex-col gap-3 px-5 pt-4 pb-[18px]" aria-labelledby="calendario">
            <div class="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="calendario" class="text-base font-semibold">Próximas 5 semanas</h2>
              <div class="flex gap-3.5 text-xs text-secundario">
                <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-cat-tarjetas" aria-hidden="true"></span>Pago</span>
                <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full border-2 border-cat-tarjetas" aria-hidden="true"></span>Corte</span>
              </div>
            </div>
            <div class="overflow-x-auto">
              <ol class="grid min-w-[860px] grid-cols-[repeat(35,minmax(0,1fr))] gap-0.5" data-testid="calendario">
                @for (d of dias(); track d.fecha) {
                  <li class="flex min-h-[74px] flex-col items-center gap-1.5 rounded-lg pt-2 pb-1.5" [class.bg-[#F6F3FD]]="tienePago(d)" [class.shadow-[inset_2px_0_0_#E2E1DC]]="d.primero"
                    [attr.aria-label]="etiquetaDia(d)">
                    <span class="text-[11px]" [class]="d.hoy ? 'rounded-[9px] bg-acento px-1.5 font-bold text-white' : d.primero ? 'font-bold' : 'text-secundario'">{{ d.numero }}</span>
                    @if (d.eventos[0]; as e) {
                      <span class="h-3 w-3 rounded-full" [class]="e.tipo === 'PAGO' ? 'bg-cat-tarjetas' : 'border-2 border-cat-tarjetas'" aria-hidden="true"></span>
                    } @else {
                      <span class="h-3 w-3" aria-hidden="true"></span>
                    }
                    <span class="text-center text-[9px] leading-tight text-[#3B3D39]" aria-hidden="true">{{ textoDia(d) }}</span>
                  </li>
                }
              </ol>
            </div>
          </section>
        } @else {
          <section class="tarjeta flex flex-col px-4 py-2" aria-labelledby="proximas">
            <h2 id="proximas" class="rotulo py-2">Próximas fechas</h2>
            @for (f of v.fechas; track f.fecha + f.tarjetaId + f.tipo) {
              <div class="flex items-center gap-3 border-t border-divisor py-2.5" data-testid="fecha-tarjeta">
                <span class="w-12 shrink-0 text-[13px] font-semibold">{{ corta(f.fecha) }}</span>
                <span class="h-3 w-3 shrink-0 rounded-full" [class]="f.tipo === 'PAGO' ? 'bg-cat-tarjetas' : 'border-2 border-cat-tarjetas'" aria-hidden="true"></span>
                <span class="flex min-w-0 grow flex-col"><span class="text-sm">{{ f.que }}</span><span class="text-xs" [class]="tono[f.tono]">{{ f.cuando }}</span></span>
                @if (f.valor !== null) {
                  <app-monto class="text-[13px]" [valor]="f.valor" />
                }
              </div>
            }
          </section>
        }

        <div class="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          @for (t of v.tarjetas; track t.tarjeta.id) {
            <button type="button" class="tarjeta flex flex-col gap-3.5 p-[18px] text-left hover:bg-fondo" (click)="abrir(t.tarjeta)" [attr.data-tarjeta]="t.tarjeta.nombre">
              <span class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-2 text-base font-semibold">{{ t.tarjeta.nombre }}
                  <span class="rounded-[10px] px-2.5 py-0.5 text-[11px] font-semibold" [class]="t.tarjeta.uso ? 'bg-[#F1EDFB] text-[#5B37B0]' : 'bg-[#F3F2EE] text-secundario'">{{ t.tarjeta.uso || 'Sin uso' }}</span>
                </span>
                <app-monto class="text-[15px] font-semibold" [valor]="t.monto" />
              </span>
              <span class="grid grid-cols-2 gap-2">
                <span class="flex flex-col gap-0.5 rounded-[10px] px-3 py-2.5" [class]="fondo[t.proximoPago.tono]" data-testid="proximo-pago">
                  <span class="text-[11px] font-semibold tracking-[0.06em] text-secundario">PRÓXIMO PAGO</span>
                  <span class="text-lg font-bold">{{ corta(t.proximoPago.fecha) }}</span>
                  <span class="text-xs" [class]="tono[t.proximoPago.tono]">{{ enDias(t.proximoPago.dias) }}</span>
                </span>
                <span class="flex flex-col gap-0.5 rounded-[10px] bg-fondo px-3 py-2.5">
                  <span class="text-[11px] font-semibold tracking-[0.06em] text-secundario">PRÓXIMO CORTE</span>
                  <span class="text-lg font-bold">{{ corta(t.proximoCorte.fecha) }}</span>
                  <span class="text-xs text-secundario">{{ enDias(t.proximoCorte.dias) }}</span>
                </span>
              </span>
              <span class="flex justify-between border-t border-divisor pt-2.5 text-[13px]">
                <span class="text-secundario">Corte día {{ t.tarjeta.diaCorte }} · pago día {{ t.tarjeta.diaPago }}</span>
                <span class="font-semibold">{{ t.tarjeta.pago.tipo === 'FIJO' ? 'Pago fijo' : 'Se paga completa' }}</span>
              </span>
              <span class="text-xs leading-normal" [class]="t.aviso ? 'rounded-lg bg-[#FBEDE8] px-2.5 py-2 text-[#8A2A15]' : 'text-[#3B3D39]'" data-testid="ayuda-tarjeta">{{ t.ayuda }}</span>
            </button>
          }
        </div>
        <p class="text-[13px] leading-normal text-secundario">La tarjeta con uso es la línea del plan: se paga con el valor del extracto y no hay que registrar compras. Para cambiar el uso o las fechas, toca la tarjeta.</p>
      }
    }

    @if (hoja(); as h) {
      <app-tarjeta-hoja [tarjeta]="h.tarjeta" (cerrar)="hoja.set(null)" />
    }
  `,
})
export class TarjetasTab {
  private readonly puertos = inject(PUERTOS);
  readonly escritorio = input(false);

  protected readonly vista = consulta(() => null, (p) => p.tarjetas.vista());
  protected readonly hoja = signal<{ tarjeta: Tarjeta | null } | null>(null);
  protected readonly tono = TONO;
  protected readonly fondo = FONDO;

  /** Los 35 dias del calendario, desde hoy, con sus cortes y pagos. */
  protected readonly dias = computed<Dia[]>(() => {
    const fechas = this.vista.value()?.fechas ?? [];
    const hoy = this.puertos.hoy();
    const inicio = Date.parse(`${hoy}T00:00:00Z`);
    return Array.from({ length: DIAS_FECHAS }, (_, k) => {
      const fecha = new Date(inicio + k * 86_400_000).toISOString().slice(0, 10);
      const dia = Number(fecha.slice(8));
      const primero = dia === 1;
      return { fecha, numero: primero ? `1 ${nombreMes(Number(fecha.slice(5, 7))).slice(0, 3)}` : String(dia), hoy: k === 0, primero, eventos: fechas.filter((f) => f.fecha === fecha) };
    });
  });

  protected abrir(tarjeta: Tarjeta | null): void {
    this.hoja.set({ tarjeta });
  }

  protected tienePago(d: Dia): boolean {
    return d.eventos.some((e) => e.tipo === 'PAGO');
  }

  protected textoDia(d: Dia): string {
    return d.eventos.map((e) => e.etiqueta).join(' · ');
  }

  protected etiquetaDia(d: Dia): string {
    return d.eventos.length ? `${formatFechaCorta(d.fecha)}: ${this.textoDia(d)}` : formatFechaCorta(d.fecha);
  }

  protected corta(f: Fecha): string {
    return formatFechaCorta(f);
  }

  protected enDias(dias: number): string {
    return dias === 0 ? 'Hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
}
