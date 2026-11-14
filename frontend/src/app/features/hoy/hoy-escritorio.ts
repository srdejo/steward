import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { claveMes, formatCop, mesDe, nombreMes, type AvanceCategoria, type ItemEjecucion, type Movimiento, type ResumenMes, type TonoVence } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Avatar } from '../../shared/components/avatar';
import { Monto } from '../../shared/components/monto';
import { IngresosHoy } from './ingresos-hoy';
import { MesDeHoy } from './mes-de-hoy';

const TONO_VENCE: Record<TonoVence, string> = { alerta: 'font-semibold text-negativo', aviso: 'text-aviso', normal: 'text-secundario' };

/**
 * HoyWeb.dc.html: Hoy desde 1024 px (spec steward-hoy, "Hoy detallado en escritorio"). Mismas cifras que la vista de una
 * columna; las hojas siguen siendo las rutas hijas de /hoy, asi que los enlaces son relativos.
 */
@Component({
  selector: 'app-hoy-escritorio',
  imports: [RouterLink, Avatar, IngresosHoy, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6', 'data-testid': 'hoy-escritorio' },
  template: `
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <button type="button" class="h-9 w-9 rounded-[10px] border border-borde-campo bg-superficie font-semibold text-texto disabled:opacity-40" aria-label="Mes anterior" [disabled]="!anterior()" (click)="ir(anterior())">‹</button>
        <div class="flex flex-col gap-0.5">
          <span class="rotulo text-positivo">{{ rotulo() }}</span>
          <h1 class="text-[28px] font-bold">{{ titulo() }}</h1>
        </div>
        <button type="button" class="h-9 w-9 rounded-[10px] border border-borde-campo bg-superficie font-semibold text-texto disabled:opacity-40" aria-label="Mes siguiente" [disabled]="!siguiente()" (click)="ir(siguiente())">›</button>
      </div>
      <div class="flex flex-wrap gap-2">
        @if (cerrarMes(); as nombre) {
          <!-- Spec "Cerrar el mes desde Hoy": solo el mes en curso y sin cerrar. -->
          <a [routerLink]="['/planear', claveActual(), 'cierre']" class="flex h-10 items-center rounded-[10px] px-3.5 text-sm font-semibold text-acento hover:bg-acento-suave" data-testid="cerrar-mes">Cerrar {{ nombre }}</a>
        }
        <a routerLink="aporte" class="flex h-10 items-center rounded-[10px] border border-control bg-superficie px-4 text-sm font-semibold text-texto">+ Aporte</a>
        <a routerLink="gasto" class="flex h-10 items-center rounded-[10px] bg-acento px-4 text-sm font-semibold text-white">+ Gasto</a>
      </div>
    </header>

    @if (opcionPorElegir(); as letra) {
      <a [routerLink]="['/planear', claveActual()]" class="text-[13px] font-medium text-acento">Opción {{ letra }} · elige otra en Plan</a>
    }

    @let r = resumen();
    @if (r.sinPlan) {
      <section class="tarjeta flex flex-col gap-3 p-[18px]">
        <span class="rotulo">Este mes no tiene plan</span>
        <p class="text-sm text-secundario">Empieza desde el mes anterior, solo con lo fijo o desde cero.</p>
        <a [routerLink]="['/planear', claveActual()]" class="boton-primario self-start">Planear {{ titulo() }}</a>
      </section>
    }

    <div class="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
      <section class="flex flex-col gap-1.5 rounded-[14px] bg-acento px-5 py-[18px]" data-testid="tarjeta-libre">
        <h2 class="text-xs font-semibold tracking-[0.06em] text-[#C9DACD] uppercase">Te queda libre</h2>
        <app-monto class="text-[26px] font-semibold text-white" [valor]="r.libre" data-testid="libre" />
        <span class="text-xs text-[#C9DACD]">de {{ formatCop(r.totalIngresos) }} que entran este mes</span>
      </section>
      <section class="tarjeta flex flex-col gap-1.5 px-5 py-[18px]" data-testid="tarjeta-falta">
        <h2 class="text-xs font-semibold tracking-[0.06em] uppercase" [class]="r.faltaPagar > 0 ? 'text-negativo' : 'text-secundario'">Falta pagar</h2>
        <app-monto class="text-[26px] font-semibold" [valor]="r.faltaPagar" />
        <span class="text-xs text-secundario">{{ subtituloFalta() }}</span>
      </section>
      <section class="tarjeta flex flex-col gap-1.5 px-5 py-[18px]" data-testid="tarjeta-pagado">
        <h2 class="text-xs font-semibold tracking-[0.06em] text-secundario uppercase">Pagado</h2>
        <app-monto class="text-[26px] font-semibold" [valor]="r.pagado" />
        <span class="text-xs text-secundario">{{ subtituloPagado() }}</span>
      </section>
      <section class="tarjeta flex flex-col gap-1.5 px-5 py-[18px]" data-testid="tarjeta-vs-plan">
        <h2 class="text-xs font-semibold tracking-[0.06em] text-secundario uppercase">Vs. plan</h2>
        <app-monto class="text-[26px] font-semibold" [class]="r.vsPlan <= 0 ? 'text-positivo' : 'text-negativo'" [valor]="r.vsPlan" />
        <span class="text-xs text-secundario">{{ r.vsPlan < 0 ? 'gastaste menos de lo planeado' : r.vsPlan > 0 ? 'gastaste más de lo planeado' : 'igual al plan' }}</span>
      </section>
    </div>

    <div class="flex flex-wrap items-start gap-5">
      <div class="flex min-w-0 flex-[2_1_560px] flex-col gap-5">
        <section class="tarjeta overflow-hidden" aria-labelledby="tabla-por-pagar">
          <div class="flex items-center justify-between border-b border-divisor px-5 py-4">
            <h2 id="tabla-por-pagar" class="text-base font-semibold">Por pagar</h2>
            <app-monto class="text-sm font-semibold" [class.text-negativo]="r.faltaPagar > 0" [valor]="r.faltaPagar" />
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[620px] border-collapse text-sm" data-testid="tabla-por-pagar">
              <thead class="bg-fondo text-left text-[11px] font-semibold tracking-[0.06em] text-secundario uppercase">
                <tr>
                  <th scope="col" class="px-5 py-2.5 font-semibold">Gasto</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Categoría</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Vence</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Falta</th>
                  <th scope="col" class="px-5 py-2.5"><span class="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                @for (i of r.porPagar; track i.item.id) {
                  <tr class="border-t border-divisor" [attr.data-item]="i.item.nombre">
                    <td class="px-5 py-3">
                      <a [routerLink]="rutaPagar(i)" [queryParams]="paramsPagar(i)" class="flex min-w-0 flex-col gap-0.5 hover:underline">
                        <span class="font-medium">{{ i.item.nombre }}</span>
                        <span class="text-xs text-secundario">{{ detalleTabla(i) }}</span>
                      </a>
                    </td>
                    <td class="px-3 py-3 text-[13px] text-[#3B3D39]">
                      <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-[2px]" [style.background]="colorDe(i)" aria-hidden="true"></span>{{ i.categoriaNombre }}</span>
                    </td>
                    <td class="px-3 py-3 text-[13px]" [class]="tonoVence(i)" data-col="vence">{{ i.vence.texto }}</td>
                    <td class="px-3 py-3 text-right"><app-monto class="text-[13px] font-semibold" [valor]="i.pendiente" /></td>
                    <td class="px-5 py-3 text-right">
                      <a [routerLink]="rutaPagar(i)" [queryParams]="paramsPagar(i)" class="inline-flex h-[34px] items-center rounded-[9px] border border-control px-3 text-[13px] font-semibold whitespace-nowrap text-texto">Marcar pagado</a>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-5 py-4 text-secundario">Nada pendiente. Todo el plan del mes está pagado.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="tarjeta overflow-hidden" aria-labelledby="tabla-ya-pagado">
          <div class="flex items-center justify-between border-b border-divisor px-5 py-4">
            <h2 id="tabla-ya-pagado" class="text-base font-semibold">Ya pagado</h2>
            <app-monto class="text-sm font-semibold" [valor]="r.pagado" />
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[620px] border-collapse text-sm" data-testid="tabla-ya-pagado">
              <thead class="bg-fondo text-left text-[11px] font-semibold tracking-[0.06em] text-secundario uppercase">
                <tr>
                  <th scope="col" class="px-5 py-2.5 font-semibold">Gasto</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Plan</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Real</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Dif.</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Quién</th>
                  <th scope="col" class="px-5 py-2.5 font-semibold">Desde</th>
                </tr>
              </thead>
              <tbody>
                @for (i of r.yaPagado; track i.item.id) {
                  <tr class="border-t border-divisor" [attr.data-item]="i.item.nombre">
                    <td class="px-5 py-[11px]">
                      <a [routerLink]="i.pagos.length === 1 ? ['registro', i.pagos[0]!.id] : 'registros'" [queryParams]="i.pagos.length === 1 ? null : { item: i.item.id }" class="flex items-center gap-2 hover:underline">
                        <span class="h-2 w-2 shrink-0 rounded-[2px]" [style.background]="colorDe(i)" aria-hidden="true"></span>{{ i.item.nombre }}
                      </a>
                    </td>
                    <td class="px-3 py-[11px] text-right"><app-monto class="text-[13px] text-secundario" [valor]="i.plan" /></td>
                    <td class="px-3 py-[11px] text-right"><app-monto class="text-[13px]" [valor]="i.real" /></td>
                    <td class="px-3 py-[11px] text-right" data-col="dif">
                      @if (i.diferencia) {
                        <app-monto class="text-[13px]" [class]="i.diferencia < 0 ? 'text-positivo' : 'text-negativo'" [valor]="i.diferencia" [signo]="true" />
                      } @else {
                        <span class="text-[13px] text-[#9A9C95]">—</span>
                      }
                    </td>
                    <td class="px-3 py-[11px]">
                      <app-avatar [inicial]="miembros.inicialDe(i.pagadoPor)" [variante]="miembros.varianteDe(i.pagadoPor)" [tamano]="26" [nombre]="'Pagó ' + miembros.nombreDe(i.pagadoPor)" />
                    </td>
                    <td class="px-5 py-[11px] text-[13px] text-secundario" data-col="desde">{{ i.desde ?? '—' }}</td>
                  </tr>
                }
                @for (m of r.noPlaneados; track m.id) {
                  <tr class="border-t border-divisor" [attr.data-item]="m.nota || 'Gasto'">
                    <td class="px-5 py-[11px]">
                      @if (m.tipo === 'GASTO') {
                        <a [routerLink]="['registro', m.id]" class="flex flex-col hover:underline"><span>{{ m.nota || 'Gasto' }}</span><span class="text-xs text-secundario">No estaba planeado</span></a>
                      } @else {
                        <span class="flex flex-col"><span>{{ m.nota || 'Gasto' }}</span><span class="text-xs text-secundario">No estaba planeado</span></span>
                      }
                    </td>
                    <td class="px-3 py-[11px] text-right text-[13px] text-[#9A9C95]">—</td>
                    <td class="px-3 py-[11px] text-right"><app-monto class="text-[13px]" [valor]="m.monto" /></td>
                    <td class="px-3 py-[11px] text-right text-[13px] text-[#9A9C95]">—</td>
                    <td class="px-3 py-[11px]">
                      <app-avatar [inicial]="miembros.inicialDe(m.usuarioId)" [variante]="miembros.varianteDe(m.usuarioId)" [tamano]="26" [nombre]="'Pagó ' + miembros.nombreDe(m.usuarioId)" />
                    </td>
                    <td class="px-5 py-[11px] text-[13px] text-secundario">{{ desdeMovimiento(m) }}</td>
                  </tr>
                }
                @if (!r.yaPagado.length && !r.noPlaneados.length) {
                  <tr><td colspan="6" class="px-5 py-4 text-secundario">Todavía no hay pagos este mes.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside class="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
        <section class="tarjeta flex flex-col gap-1 px-[18px] py-4" aria-labelledby="ingresos-escritorio">
          <div class="flex items-center justify-between pb-1.5">
            <h2 id="ingresos-escritorio" class="text-[15px] font-semibold">Ingresos</h2>
            <a routerLink="aporte" class="boton-texto">+ Aporte</a>
          </div>
          <app-ingresos-hoy class="border-t border-divisor" [ingresos]="r.ingresos" />
        </section>

        <section class="tarjeta flex flex-col gap-3.5 px-[18px] py-4" aria-labelledby="por-categoria" data-testid="por-categoria">
          <h2 id="por-categoria" class="text-[15px] font-semibold">Por categoría</h2>
          @for (c of r.porCategoria; track c.categoriaId) {
            <div class="flex flex-col gap-1.5" [attr.data-categoria]="c.nombre">
              <div class="flex justify-between gap-2 text-[13px]">
                <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-[2px]" [style.background]="c.color" aria-hidden="true"></span>{{ c.nombre }}</span>
                <span class="monto text-xs text-secundario">{{ formatCop(c.real) }} / {{ formatCop(c.plan) }}</span>
              </div>
              <div class="flex h-1.5 rounded-[3px] bg-divisor" role="progressbar" [attr.aria-label]="c.nombre" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="avance(c)">
                <span class="rounded-[3px]" [style.width.%]="avance(c)" [style.background]="c.color"></span>
              </div>
            </div>
          } @empty {
            <p class="text-sm text-secundario">Sin gastos en el plan de este mes.</p>
          }
        </section>

        <section class="tarjeta flex flex-col gap-1 px-[18px] py-4" aria-labelledby="cuentas-escritorio" data-testid="cuentas-escritorio">
          <div class="flex items-center justify-between pb-1.5">
            <h2 id="cuentas-escritorio" class="text-[15px] font-semibold">Cuentas</h2>
            <a routerLink="/cuentas/cuadrar" class="boton-texto">Cuadrar</a>
          </div>
          @for (k of cuentas.value()?.cuentas ?? []; track k.cuenta.id) {
            <div class="flex justify-between gap-3 border-t border-divisor py-2 text-sm" [attr.data-cuenta]="k.cuenta.nombre">
              <div class="flex min-w-0 flex-col gap-0.5">
                <span>{{ k.cuenta.nombre }}</span>
                <span class="text-xs" [class]="k.aviso ? 'text-aviso' : 'text-secundario'">{{ k.titular }} · {{ k.estadoCuadre }}</span>
              </div>
              <span class="monto shrink-0 text-[13px]">{{ k.estimado ? '≈ ' : '' }}<app-monto [valor]="k.saldo" /></span>
            </div>
          }
        </section>
      </aside>
    </div>
  `,
})
export class HoyEscritorio {
  protected readonly miembros = inject(MiembrosHogar);
  private readonly mesHoy = inject(MesDeHoy);
  protected readonly formatCop = formatCop;

  readonly resumen = input.required<ResumenMes>();
  readonly rotulo = input.required<string>();
  readonly titulo = input.required<string>();
  readonly claveActual = input.required<string>();
  readonly opcionPorElegir = input<string | null>(null);

  protected readonly cuentas = consulta(() => null, (p) => p.cuentas.cuentas());
  private readonly enCurso = claveMes(mesDe(inject(PUERTOS).hoy()));
  private readonly mes = consulta(() => this.resumen().ref, (p, ref) => p.plan.mes(ref));
  /** Nombre del mes si se puede cerrar desde aqui: el mes en curso, sin cerrar; si no, null. */
  protected readonly cerrarMes = computed(() => {
    if (this.claveActual() !== this.enCurso || this.mes.value()?.plan?.estado === 'CERRADO') return null;
    return nombreMes(this.resumen().ref.mes);
  });

  private readonly indice = computed(() => this.mesHoy.opciones.findIndex((o) => o.valor === this.mesHoy.clave()));
  protected readonly anterior = computed(() => this.mesHoy.opciones[this.indice() - 1]?.valor ?? null);
  protected readonly siguiente = computed(() => this.mesHoy.opciones[this.indice() + 1]?.valor ?? null);

  protected readonly subtituloFalta = computed(() => {
    const r = this.resumen();
    const n = r.porPagar.length;
    const pendientes = `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`;
    return r.vencidos ? `${pendientes} · ${r.vencidos} ${r.vencidos === 1 ? 'vencido' : 'vencidos'}` : pendientes;
  });

  protected readonly subtituloPagado = computed(() => {
    const r = this.resumen();
    const pagos = `${r.pagos} ${r.pagos === 1 ? 'pago' : 'pagos'}`;
    return r.plan > 0 ? `${pagos} · ${Math.floor((r.pagado / r.plan) * 100)}% de lo planeado` : pagos;
  });

  protected ir(clave: string | null): void {
    if (clave) this.mesHoy.elegir(clave);
  }

  /** La misma hoja que abre la fila en una columna: un variable registra un gasto, lo demas se marca pagado. */
  protected rutaPagar(i: ItemEjecucion): string | string[] {
    return i.item.tipo === 'VARIABLE' ? 'gasto' : ['pagar', i.item.id];
  }

  protected paramsPagar(i: ItemEjecucion): Record<string, string> | null {
    return i.item.tipo === 'VARIABLE' ? { item: i.item.id } : null;
  }

  /** Debajo del nombre: el detalle del item, salvo cuando repite lo que ya dice la columna Vence. */
  protected detalleTabla(i: ItemEjecucion): string {
    if (i.item.cuota) return `Cuota ${i.item.cuota.actual} de ${i.item.cuota.total}`;
    return i.detalle === i.vence.texto || /^Vence|^Venció/.test(i.detalle) ? '' : i.detalle;
  }

  protected tonoVence(i: ItemEjecucion): string {
    return TONO_VENCE[i.vence.tono];
  }

  protected colorDe(i: ItemEjecucion): string {
    return this.resumen().porCategoria.find((c) => c.categoriaId === i.item.categoriaId)?.color ?? 'var(--color-control)';
  }

  protected avance(c: AvanceCategoria): number {
    if (c.plan <= 0) return c.real > 0 ? 100 : 0;
    return Math.min(100, Math.round((c.real / c.plan) * 100));
  }

  protected desdeMovimiento(m: Movimiento): string {
    if (m.origen.tipo === 'EXTERNA') return 'Su cuenta';
    if (m.origen.tipo !== 'CUENTA') return '—';
    const id = m.origen.cuentaId;
    return this.cuentas.value()?.cuentas.find((k) => k.cuenta.id === id)?.cuenta.nombre ?? '—';
  }
}
