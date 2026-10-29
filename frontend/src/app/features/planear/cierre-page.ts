import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReglaError, claveMes, compararMes, formatCop, formatNumero, mesDe, nombreMes, nombreMesCapital, parseClaveMes, repartoValido, sumarMeses } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS, puertosConectados } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';

/**
 * Cierre.dc.html: plan vs real por categoria, "Sin registrar" (los ajustes de cuadre) y el reparto del sobrante
 * entre ahorro y el mes siguiente. Cerrar deja el mes en solo lectura (spec steward-planear).
 */
@Component({
  selector: 'app-cierre-page',
  imports: [RouterLink, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] px-5 pt-6 pb-4' },
  template: `
    <a [routerLink]="volver()" class="boton-texto -my-2 self-start text-sm font-normal">‹ {{ nombreCapital() }}</a>

    @if (vista.value(); as v) {
      <div class="flex flex-col gap-1.5">
        <span class="rotulo">Cierre de mes{{ v.cerrado ? ' · cerrado' : '' }}</span>
        <h1 class="text-[26px] font-bold">{{ nombreCapital() }} terminó con</h1>
        <app-monto class="text-[34px] font-semibold" [class.text-acento]="v.sobrante >= 0" [class.text-negativo]="v.sobrante < 0" [valor]="v.sobrante" data-testid="sobrante" />
        <span class="text-sm text-secundario">El plan esperaba {{ cop(v.librePlaneado) }} libres.</span>
      </div>

      <div class="rounded-[14px] border border-borde bg-superficie px-4 py-1.5">
        <table class="w-full border-collapse text-sm" data-testid="tabla-cierre">
          <thead>
            <tr class="border-b border-divisor text-[11px] font-semibold tracking-[0.06em] text-secundario">
              <th scope="col" class="py-2.5 text-left"><span class="sr-only">Categoría</span></th>
              <th scope="col" class="w-[84px] py-2.5 text-right">PLAN</th>
              <th scope="col" class="w-[84px] py-2.5 text-right">REAL</th>
            </tr>
          </thead>
          <tbody>
            @for (f of v.filas; track f.nombre; let primero = $first) {
              <tr class="border-b border-divisor">
                <th scope="row" class="py-2.5 text-left" [class.font-semibold]="primero" [class.font-normal]="!primero">{{ f.nombre }}</th>
                <td class="monto py-2.5 text-right text-xs text-secundario">{{ f.plan === null ? '—' : numero(f.plan) }}</td>
                <td class="monto py-2.5 text-right text-xs" [class]="tonoReal(f.plan, f.real, primero)">{{ numero(f.real) }}</td>
              </tr>
            }
            <tr>
              <th scope="row" class="py-2.5 text-left font-normal">Sin registrar<span class="block text-[11px] text-secundario">de cuadrar cuentas</span></th>
              <td class="monto py-2.5 text-right text-xs text-secundario">—</td>
              <td class="monto py-2.5 text-right text-xs">{{ numero(v.sinRegistrar) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      @if (v.cerrado) {
        <div class="nota">
          <span class="text-[13px] font-semibold">Así se repartió</span>
          <span class="flex justify-between text-sm">A ahorro <app-monto [valor]="v.aAhorro" /></span>
          <span class="flex justify-between text-sm">Pasó a {{ siguiente() }} <app-monto [valor]="v.aSiguiente" /></span>
          <span class="text-xs text-secundario">El mes está cerrado: queda en solo lectura.</span>
        </div>
      } @else {
        <div class="flex flex-col gap-2.5">
          <h2 class="text-base font-semibold">¿Qué hacemos con lo que sobró?</h2>
          <div class="flex items-center justify-between gap-3 rounded-xl border-2 border-acento bg-acento-suave px-4 py-2.5">
            <span class="text-[15px] font-medium" id="a-ahorro">A ahorro</span>
            <app-monto-input class="w-40" [(valor)]="aAhorro" etiquetaAccesible="A ahorro" />
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border-2 border-acento bg-acento-suave px-4 py-2.5">
            <span class="text-[15px] font-medium" id="a-siguiente">Pasar a {{ siguiente() }}</span>
            <app-monto-input class="w-40" [(valor)]="aSiguiente" [etiquetaAccesible]="'Pasar a ' + siguiente()" />
          </div>
          @if (!valido()) {
            <p class="text-xs text-aviso" data-testid="aviso-reparto">El reparto debe sumar {{ cop(v.sobrante) }} (va en {{ cop((aAhorro() ?? 0) + (aSiguiente() ?? 0)) }}).</p>
          }
        </div>
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        @if (puedeCerrar()) {
          <button type="button" class="boton-grande" [disabled]="!valido() || guardando()" (click)="cerrar()">Cerrar {{ nombreMin() }}</button>
        } @else {
          <!-- Modo conectado: un mes futuro no se cierra (spec steward-planear). -->
          <p class="text-xs text-secundario" data-testid="cierre-futuro">{{ nombreCapital() }} se cierra cuando llegue.</p>
        }
      }
    }
  `,
})
export class CierrePage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);

  /** Parametro de la ruta (`/planear/:mes/cierre`). */
  readonly mes = input.required<string>();
  private readonly ref = computed(() => parseClaveMes(this.mes()) ?? mesDe(this.puertos.hoy()));
  protected readonly nombreCapital = computed(() => nombreMesCapital(this.ref().mes));
  protected readonly nombreMin = computed(() => nombreMes(this.ref().mes));
  protected readonly siguiente = computed(() => nombreMes(sumarMeses(this.ref(), 1).mes));
  private readonly conectado = puertosConectados(this.puertos) !== null;
  protected readonly puedeCerrar = computed(() => !this.conectado || compararMes(this.ref(), mesDe(this.puertos.hoy())) <= 0);
  protected readonly volver = computed(() => (claveMes(this.ref()) === claveMes(mesDe(this.puertos.hoy())) ? '/hoy' : '/planear'));

  protected readonly vista = consulta(() => this.ref(), (p, ref) => p.cierre.vista(ref));
  protected readonly aAhorro = signal<number | null>(null);
  protected readonly aSiguiente = signal<number | null>(0);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  private readonly reproponer = signal(false);
  private propuesto: number | null = null;
  protected readonly valido = computed(() => {
    const v = this.vista.value();
    return Boolean(v) && repartoValido(v!.sobrante, this.aAhorro() ?? 0, this.aSiguiente() ?? 0);
  });

  constructor() {
    // Por defecto todo lo que sobro va a ahorro; se ajusta moviendo una parte al mes siguiente.
    // Si el cierre estaba desactualizado, se vuelve a proponer cuando llegue la vista con el sobrante nuevo.
    effect(() => {
      const v = this.vista.value();
      if (!v || v.cerrado) return;
      if (this.aAhorro() === null || (this.reproponer() && v.sobrante !== this.propuesto)) {
        this.propuesto = v.sobrante;
        this.reproponer.set(false);
        this.aAhorro.set(Math.max(0, v.sobrante));
        this.aSiguiente.set(0);
      }
    });
  }

  protected numero(v: number): string {
    return formatNumero(v);
  }

  protected cop(v: number): string {
    return formatCop(v);
  }

  /** Ingresos por encima del plan en verde; un gasto por encima de su plan en rojo. */
  protected tonoReal(plan: number | null, real: number, esIngreso: boolean): string {
    if (plan === null) return '';
    if (esIngreso) return real >= plan ? 'text-positivo' : 'text-negativo';
    return real > plan ? 'text-negativo' : '';
  }

  protected async cerrar(): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      // El mes siguiente se calcula antes: tras cerrar, la vista se recarga y su valor no esta mientras tanto.
      const siguiente = claveMes(sumarMeses(this.ref(), 1));
      await this.puertos.cierre.cerrar(this.ref(), { aAhorro: this.aAhorro() ?? 0, aSiguiente: this.aSiguiente() ?? 0 });
      await this.router.navigate(['/planear', siguiente]);
    } catch (e) {
      this.error.set(mensajeDeError(e));
      // Las cifras ya se recalcularon: el reparto vuelve a proponerse con el sobrante nuevo.
      if (e instanceof ReglaError && e.codigo === 'CIERRE_DESACTUALIZADO') this.reproponer.set(true);
    } finally {
      this.guardando.set(false);
    }
  }
}
