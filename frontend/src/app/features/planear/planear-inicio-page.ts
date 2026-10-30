import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { claveMes, formatCop, formatMesAnio, type ResumenMesPlan } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { Monto } from '../../shared/components/monto';

/** PlanInicio.dc.html: el año, los próximos meses y este mes y los anteriores (spec steward-planear). */
@Component({
  selector: 'app-planear-inicio-page',
  imports: [RouterLink, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5 px-5 pt-6 pb-4' },
  template: `
    <h1 class="text-[26px] font-bold">Plan</h1>

    @if (inicio.value(); as i) {
      @if (i.anual; as a) {
        <a [routerLink]="['/planear/anual', a.anio]" class="tarjeta flex items-center justify-between gap-3 p-4 hover:bg-fondo">
          <div class="flex flex-col gap-1">
            <span class="rotulo" [class.text-aviso]="a.estado === 'BORRADOR'">{{ a.estado === 'BORRADOR' ? 'Borrador' : 'Meses creados' }}</span>
            <span class="text-lg font-semibold">Año {{ a.anio }}</span>
            <span class="text-[13px] text-secundario">Libre proyectado <app-monto [valor]="a.kpis.libreAnio" /></span>
          </div>
          <span class="text-[13px] font-semibold text-acento">Abrir ›</span>
        </a>
      }

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
              <span class="text-[13px]" [class]="m.estado === 'CERRADO' ? 'text-secundario' : 'font-semibold text-acento'">{{ m.estado === 'CERRADO' ? 'Ver cierre' : m.estado === 'ACTIVO' ? 'Editar plan ›' : 'Planear ›' }}</span>
            </a>
          }
        </div>
      </section>
    }
  `,
})
export class PlanearInicioPage {
  protected readonly inicio = consulta(() => null, (p) => p.plan.inicio());

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

  protected destinoReciente(m: ResumenMesPlan): string[] {
    const clave = this.clave(m);
    if (m.estado === 'CERRADO') return ['/planear', clave, 'cierre'];
    return ['/planear', clave];
  }
}
