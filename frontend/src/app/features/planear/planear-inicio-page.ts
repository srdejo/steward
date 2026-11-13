import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { claveMes, formatCop, formatMesAnio, mesDe, type ResumenMesPlan } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { ESCRITORIO } from '../hoy/hoy-page';

/**
 * PlanInicio.dc.html y PlanInicioWeb.dc.html: el año, los próximos meses y este mes y los anteriores (spec steward-planear).
 * Desde 1024 px, a todo el ancho: la tarjeta del año arriba y los meses como tarjetas en cuadrícula.
 */
@Component({
  selector: 'app-planear-inicio-page',
  imports: [RouterLink, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-7 px-10 pt-7 pb-10' : 'flex flex-col gap-5 px-5 pt-6 pb-4'" },
  template: `
    <div class="flex flex-col gap-1">
      @if (escritorio()) {
        <span class="rotulo text-positivo">{{ enCurso() }} en curso</span>
      }
      <h1 class="text-[26px] font-bold lg:text-[28px]">Plan</h1>
    </div>

    @if (inicio.value(); as i) {
      @if (i.anual; as a) {
        <a [routerLink]="['/planear/anual', a.anio]" class="tarjeta flex items-center justify-between gap-3 p-4 hover:bg-fondo" data-testid="tarjeta-anio">
          <div class="flex flex-col gap-1">
            <span class="rotulo" [class.text-aviso]="a.estado === 'BORRADOR'">{{ a.estado === 'BORRADOR' ? 'Borrador' : 'Meses creados' }}</span>
            <span class="text-lg font-semibold">Año {{ a.anio }}</span>
            <span class="text-[13px] text-secundario">Libre proyectado <app-monto [valor]="a.kpis.libreAnio" /></span>
          </div>
          <span class="text-[13px] font-semibold text-acento">Abrir ›</span>
        </a>
      } @else {
        <section class="tarjeta flex flex-wrap items-center gap-6 p-5 lg:p-6" aria-labelledby="anio-sin-plan" data-testid="tarjeta-anio">
          <div class="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
            <span class="rotulo">Año {{ anioSiguiente() }} · Sin plan</span>
            <h2 id="anio-sin-plan" class="text-lg font-bold lg:text-[22px]">Planea {{ anioSiguiente() }} partiendo de un mes que ya conoces</h2>
            <p class="text-sm text-secundario">Tomas un mes como base, lo replicas en el año y solo agregas lo que cambia: primas, matrícula, SOAT, Navidad.</p>
          </div>
          @if (escritorio()) {
            <ol class="grid flex-[2_1_420px] grid-cols-3 gap-3">
              <li class="flex flex-col gap-1 rounded-xl bg-acento-suave p-3.5"><span class="monto text-xs font-semibold text-acento">1</span><span class="text-sm font-semibold">Mes base</span><span class="text-xs text-secundario">El mes que ya conoces</span></li>
              <li class="flex flex-col gap-1 rounded-xl bg-hueco p-3.5"><span class="monto text-xs font-semibold text-secundario">2</span><span class="text-sm font-semibold">Replicar</span><span class="text-xs text-secundario">En los 12 meses</span></li>
              <li class="flex flex-col gap-1 rounded-xl bg-hueco p-3.5"><span class="monto text-xs font-semibold text-secundario">3</span><span class="text-sm font-semibold">Lo que cambia</span><span class="text-xs text-secundario">Ingresos y gastos de un mes</span></li>
            </ol>
          }
          <a [routerLink]="['/planear/anual', anioSiguiente()]" class="boton-primario shrink-0">Planear {{ anioSiguiente() }} ›</a>
        </section>
      }

      @if (escritorio()) {
        <section class="flex flex-col gap-3" aria-labelledby="proximos">
          <h2 id="proximos" class="rotulo">Próximos meses</h2>
          <div class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]" data-testid="cuadricula-proximos">
            @for (m of i.proximos; track clave(m)) {
              <a [routerLink]="['/planear', clave(m)]" class="tarjeta flex flex-col gap-2.5 p-[18px] hover:bg-fondo" [class.border-dashed]="!m.plan">
                <span class="flex items-center justify-between gap-2"><span class="text-base font-semibold">{{ nombre(m) }}</span><span class="rounded-md px-2 py-0.5 text-xs font-semibold" [class]="chip(m)">{{ estado(m) }}</span></span>
                <span class="text-xs text-secundario">{{ m.detalle }}</span>
                <span class="monto text-[15px] font-semibold" [class]="m.libre.length ? tono(m) : 'text-[#7A7D76]'">{{ m.libre.length ? rango(m) : '—' }}</span>
                <span class="text-[13px] font-semibold text-acento">{{ m.plan ? 'Abrir ›' : 'Planear ›' }}</span>
              </a>
            }
          </div>
        </section>
        <section class="flex flex-col gap-3" aria-labelledby="recientes">
          <h2 id="recientes" class="rotulo">Este mes y anteriores</h2>
          <div class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            @for (m of i.recientes; track clave(m)) {
              <a [routerLink]="destinoReciente(m)" class="tarjeta flex flex-col gap-2.5 p-[18px] hover:bg-fondo">
                <span class="flex items-center justify-between gap-2"><span class="text-base font-semibold">{{ nombre(m) }}</span><span class="rounded-md px-2 py-0.5 text-xs font-semibold" [class]="chip(m)">{{ estado(m) }}</span></span>
                <span class="text-xs text-secundario">{{ m.detalle }}</span>
                <span class="monto text-[15px] font-semibold" [class.text-acento]="m.estado === 'ACTIVO'">{{ m.libre.length ? rango(m) : '—' }}</span>
                <span class="text-[13px]" [class]="m.estado === 'CERRADO' ? 'text-secundario' : 'font-semibold text-acento'">{{ accionReciente(m) }}</span>
              </a>
            }
          </div>
        </section>
      } @else {
        <section class="flex flex-col gap-1" aria-labelledby="proximos">
          <h2 id="proximos" class="rotulo">Próximos meses</h2>
          <div class="flex flex-col divide-y divide-divisor">
            @for (m of i.proximos; track clave(m)) {
              <a [routerLink]="['/planear', clave(m)]" class="flex items-center justify-between gap-3 py-3 hover:bg-superficie">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[15px] font-medium">{{ nombre(m) }}</span>
                  <span class="text-xs" [class]="m.estado === 'BORRADOR' ? 'text-aviso' : 'text-secundario'">{{ m.detalle }}</span>
                </div>
                @if (m.estado === 'SIN_PLAN' && !m.libre.length) {
                  <span class="text-[13px] font-semibold text-acento">Planear ›</span>
                } @else {
                  <span class="monto text-[13px]" [class]="tono(m)">{{ rango(m) }}</span>
                }
              </a>
            }
          </div>
        </section>

        <section class="flex flex-col gap-1" aria-labelledby="recientes">
          <h2 id="recientes" class="rotulo">Este mes y anteriores</h2>
          <div class="flex flex-col divide-y divide-divisor">
            @for (m of i.recientes; track clave(m)) {
              <a [routerLink]="destinoReciente(m)" class="flex items-center justify-between gap-3 py-3 hover:bg-superficie">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[15px] font-medium">{{ nombre(m) }}</span>
                  <span class="text-xs" [class]="m.estado === 'ACTIVO' ? 'text-positivo' : 'text-secundario'">{{ m.detalle }}</span>
                </div>
                <span class="text-[13px]" [class]="m.estado === 'CERRADO' ? 'text-secundario' : 'font-semibold text-acento'">{{ accionReciente(m) }}</span>
              </a>
            }
          </div>
        </section>
      }
    }
  `,
})
export class PlanearInicioPage {
  private readonly puertos = inject(PUERTOS);
  protected readonly inicio = consulta(() => null, (p) => p.plan.inicio());
  /** El año que muestra la tarjeta: el siguiente al en curso, como `plan.inicio()`. */
  protected readonly anioSiguiente = computed(() => mesDe(this.puertos.hoy()).anio + 1);
  protected readonly enCurso = computed(() => formatMesAnio(mesDe(this.puertos.hoy())));

  /** Desde 1024 px, las tarjetas en cuadrícula (spec "Planear inicio"). */
  protected readonly escritorio = signal(false);

  constructor() {
    const mq = typeof matchMedia === 'function' ? matchMedia(ESCRITORIO) : null;
    if (!mq) return;
    this.escritorio.set(mq.matches);
    const cambio = (e: MediaQueryListEvent) => this.escritorio.set(e.matches);
    mq.addEventListener('change', cambio);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', cambio));
  }

  protected clave(m: ResumenMesPlan): string {
    return claveMes(m.ref);
  }

  protected nombre(m: ResumenMesPlan): string {
    return formatMesAnio(m.ref);
  }

  protected rango(m: ResumenMesPlan): string {
    return m.libre.map((v) => formatCop(v)).join(' – ');
  }

  /** Un mes que dejaria menos de este libre se marca en rojo, como "Enero $598.000" en el artboard. */
  private static readonly APRETADO = 1_000_000;

  protected tono(m: ResumenMesPlan): string {
    return m.libre.some((v) => v < PlanearInicioPage.APRETADO) ? 'text-negativo' : 'text-secundario';
  }

  protected estado(m: ResumenMesPlan): string {
    return { BORRADOR: 'Borrador', ACTIVO: 'Activo', CERRADO: 'Cerrado', SIN_PLAN: 'Sin plan' }[m.estado];
  }

  protected chip(m: ResumenMesPlan): string {
    if (m.estado === 'BORRADOR') return 'bg-aviso-suave text-aviso';
    if (m.estado === 'ACTIVO') return 'bg-acento-suave text-positivo';
    return 'bg-hueco text-secundario';
  }

  protected accionReciente(m: ResumenMesPlan): string {
    return m.estado === 'CERRADO' ? 'Ver cierre' : m.estado === 'ACTIVO' ? 'Editar plan ›' : 'Planear ›';
  }

  protected destinoReciente(m: ResumenMesPlan): string[] {
    const clave = this.clave(m);
    if (m.estado === 'CERRADO') return ['/planear', clave, 'cierre'];
    return ['/planear', clave];
  }
}
