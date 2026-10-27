import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { claveMes, formatDiaSemana, formatMesAnio, mesDe, sumar, type ItemEjecucion, type ObligacionDiezmo } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { AvataresHogar } from '../../core/layout/avatares-hogar';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Avatar } from '../../shared/components/avatar';
import { Encabezado } from '../../shared/components/encabezado';
import { Fila } from '../../shared/components/fila';
import { Kpi } from '../../shared/components/kpi';
import { Monto } from '../../shared/components/monto';

interface TarjetaDiezmo {
  ids: string[];
  monto: number;
  detalle: string;
}

/** Main.dc.html: el mes en curso (spec steward-hoy). Las hojas de registro son rutas hijas. */
@Component({
  selector: 'app-hoy-page',
  imports: [RouterLink, RouterOutlet, AvataresHogar, Avatar, Encabezado, Fila, Kpi, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5 px-5 pt-6 pb-4' },
  template: `
    <app-encabezado [rotulo]="rotulo" [titulo]="titulo">
      <app-avatares-hogar />
    </app-encabezado>

    @if (resumen.value(); as r) {
      @if (r.sinPlan) {
        <section class="tarjeta flex flex-col gap-3 p-[18px]">
          <span class="rotulo">Este mes no tiene plan</span>
          <p class="text-sm text-secundario">Empieza desde el mes anterior, solo con lo fijo o desde cero.</p>
          <a [routerLink]="['/planear', claveActual]" class="boton-primario self-start">Planear {{ titulo }}</a>
        </section>
      }

      <section class="tarjeta flex flex-col gap-3.5 p-[18px]" aria-labelledby="te-queda-libre">
        <h2 id="te-queda-libre" class="rotulo">Te queda libre</h2>
        <app-monto class="text-[32px] font-semibold" [class.text-acento]="r.libre >= 0" [class.text-negativo]="r.libre < 0" [valor]="r.libre" data-testid="libre" />
        <div class="grid grid-cols-3 gap-2 border-t border-divisor pt-3">
          <app-kpi etiqueta="Plan" [valor]="r.plan" />
          <app-kpi etiqueta="Pagado" [valor]="r.pagado" />
          <app-kpi etiqueta="Vs. plan" [valor]="r.vsPlan" [tono]="r.vsPlan <= 0 ? 'text-positivo' : 'text-negativo'" />
        </div>
      </section>

      @for (d of diezmos(); track d.ids.join()) {
        <section class="flex items-center justify-between gap-3 rounded-tarjeta bg-diezmo-suave px-4 py-3.5" data-testid="tarjeta-diezmo">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="text-[13px] font-semibold text-diezmo">Disponible para diezmar</span>
            <span class="text-xs text-diezmo-texto">{{ d.detalle }}</span>
          </div>
          <div class="flex flex-col items-end gap-1.5">
            <app-monto class="text-[15px] font-semibold text-diezmo" [valor]="d.monto" />
            <button type="button" class="tocable h-[30px] rounded-[15px] bg-diezmo px-3 text-xs font-semibold text-white" (click)="entregar(d)">Entregado</button>
          </div>
        </section>
      }

      <section class="flex flex-col gap-1.5" aria-labelledby="ingresos">
        <div class="flex items-center justify-between">
          <h2 id="ingresos" class="text-base font-semibold">Ingresos</h2>
          <a routerLink="aporte" class="boton-texto">+ Aporte</a>
        </div>
        <div class="flex flex-col divide-y divide-divisor">
          @for (l of r.ingresos; track l.clave) {
            <app-fila [titulo]="l.nombre" [detalle]="l.detalle">
              @if (l.tipo === 'FIJO' && !l.recibido) {
                <button type="button" class="boton-texto font-semibold" (click)="recibir(l.ingresoFijoId!)">Recibí</button>
              }
              <app-monto class="text-sm" [class.text-positivo]="l.recibido || l.tipo !== 'FIJO'" [class.text-secundario]="l.tipo === 'FIJO' && !l.recibido" [valor]="l.monto" />
            </app-fila>
          } @empty {
            <p class="py-2.5 text-sm text-secundario">Aún no hay ingresos este mes.</p>
          }
        </div>
      </section>

      <section class="flex flex-col gap-1.5" aria-labelledby="por-pagar">
        <div class="flex items-center justify-between">
          <h2 id="por-pagar" class="text-base font-semibold">Por pagar</h2>
          <a routerLink="gasto" class="boton-texto">+ Gasto</a>
        </div>
        <div class="flex flex-col divide-y divide-divisor">
          @for (i of r.porPagar; track i.item.id) {
            <a [routerLink]="i.item.tipo === 'VARIABLE' ? 'gasto' : ['pagar', i.item.id]" [queryParams]="i.item.tipo === 'VARIABLE' ? { item: i.item.id } : null" class="block hover:bg-superficie">
              <app-fila [titulo]="i.item.nombre" [detalle]="i.detalle" [tonoDetalle]="urgente(i) ? 'text-negativo' : 'text-secundario'">
                <app-monto class="text-sm" [valor]="i.pendiente" />
                <span class="h-6 w-6 rounded-full border-2 border-control" aria-hidden="true"></span>
              </app-fila>
            </a>
          } @empty {
            <p class="py-2.5 text-sm text-secundario">Nada pendiente. Todo el plan del mes está pagado.</p>
          }
        </div>
      </section>

      @if (r.yaPagado.length || r.noPlaneados.length) {
        <section class="flex flex-col gap-1.5" aria-labelledby="ya-pagado">
          <h2 id="ya-pagado" class="text-base font-semibold">Ya pagado</h2>
          <div class="flex flex-col divide-y divide-divisor">
            @for (i of r.yaPagado; track i.item.id) {
              <app-fila [titulo]="i.item.nombre">
                <span detalle class="text-xs text-secundario">
                  @if (i.diferencia) {
                    plan <app-monto [valor]="i.plan" /> ·
                    <span [class]="i.diferencia < 0 ? 'text-positivo' : 'text-negativo'"><app-monto [valor]="i.diferencia" [signo]="true" /></span>
                  } @else {
                    {{ i.detalle }}
                  }
                </span>
                <app-monto class="text-sm" [valor]="i.real" />
                <app-avatar [inicial]="miembros.inicialDe(i.pagadoPor)" [variante]="miembros.varianteDe(i.pagadoPor)" [tamano]="24" [nombre]="'Pagó ' + miembros.nombreDe(i.pagadoPor)" />
              </app-fila>
            }
            @for (m of r.noPlaneados; track m.id) {
              <app-fila [titulo]="m.nota || 'Gasto'" detalle="No estaba planeado">
                <app-monto class="text-sm" [valor]="m.monto" />
                <app-avatar [inicial]="miembros.inicialDe(m.usuarioId)" [variante]="miembros.varianteDe(m.usuarioId)" [tamano]="24" [nombre]="'Pagó ' + miembros.nombreDe(m.usuarioId)" />
              </app-fila>
            }
          </div>
        </section>
      }

      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    } @else {
      <p class="text-secundario">Cargando el mes…</p>
    }

    <router-outlet />
  `,
})
export class HoyPage {
  private readonly puertos = inject(PUERTOS);
  protected readonly miembros = inject(MiembrosHogar);

  private readonly hoy = this.puertos.hoy();
  private readonly ref = mesDe(this.hoy);
  protected readonly claveActual = claveMes(this.ref);
  protected readonly rotulo = `Hoy · ${formatDiaSemana(this.hoy)}`;
  protected readonly titulo = formatMesAnio(this.ref);

  protected readonly resumen = consulta(() => this.ref, (p, ref) => p.movimientos.resumenMes(ref));
  protected readonly error = signal('');

  /** "Diezmo en Hoy": una tarjeta por ingreso (Separado) o una sola con la suma (Agrupado). */
  protected readonly diezmos = computed<TarjetaDiezmo[]>(() => {
    const pendientes: ObligacionDiezmo[] = this.resumen.value()?.diezmo.pendientes ?? [];
    if (!pendientes.length) return [];
    if (this.miembros.hogar.value()?.hogar.diezmoEnHoy === 'AGRUPADO' && pendientes.length > 1) {
      return [{ ids: pendientes.map((p) => p.id), monto: sumar(pendientes.map((p) => p.monto)), detalle: `${pendientes.length} ingresos recibidos` }];
    }
    return pendientes.map((p) => ({ ids: [p.id], monto: p.monto, detalle: p.detalle }));
  });

  protected urgente(i: ItemEjecucion): boolean {
    return /^Vence (en|hoy)|^Venció/.test(i.detalle);
  }

  protected async entregar(d: TarjetaDiezmo): Promise<void> {
    await this.ejecutar(() => this.puertos.ingresos.entregarDiezmo(d.ids, this.ref, null));
  }

  protected async recibir(ingresoFijoId: string): Promise<void> {
    await this.ejecutar(() => this.puertos.ingresos.marcarRecibido(ingresoFijoId, this.ref));
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
