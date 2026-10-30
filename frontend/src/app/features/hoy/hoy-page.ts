import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { claveMes, formatDiaSemana, formatMesAnio, mesDe, type ItemEjecucion, type LineaIngreso } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { AvataresHogar } from '../../core/layout/avatares-hogar';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Avatar } from '../../shared/components/avatar';
import { Encabezado } from '../../shared/components/encabezado';
import { Fila } from '../../shared/components/fila';
import { Kpi } from '../../shared/components/kpi';
import { Monto } from '../../shared/components/monto';

/**
 * Main.dc.html: el mes en curso (spec steward-hoy). Las hojas de registro son rutas hijas. El diezmo son items del plan
 * (Por pagar y Ya pagado), sin tarjeta aparte, y los ingresos son las lineas de la opcion en uso (diezmo-como-gasto).
 */
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

      <section class="flex flex-col gap-1.5" aria-labelledby="ingresos">
        <div class="flex items-center justify-between">
          <h2 id="ingresos" class="text-base font-semibold">Ingresos</h2>
          <a routerLink="aporte" class="boton-texto">+ Aporte</a>
        </div>
        <div class="flex flex-col divide-y divide-divisor">
          @for (l of r.ingresos; track l.clave) {
            <app-fila [titulo]="l.nombre" [detalle]="l.detalle">
              @if (porRecibir(l)) {
                <a [routerLink]="['recibir', l.clave]" class="boton-texto font-semibold">Recibí</a>
              }
              <app-monto class="text-sm" [class.text-positivo]="!porRecibir(l)" [class.text-secundario]="porRecibir(l)" [valor]="l.monto" />
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

  protected urgente(i: ItemEjecucion): boolean {
    return /^Vence (en|hoy)|^Venció/.test(i.detalle);
  }

  /** Una linea de la opcion (o, sin plan, un ingreso fijo) que todavia no llega: "Recibí" abre su monto. */
  protected porRecibir(l: LineaIngreso): boolean {
    return !l.recibido && Boolean(l.lineaId || l.ingresoFijoId);
  }
}
