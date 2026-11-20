import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TITULO_GRUPO, diaDelBloque, fraseVsPlan, claveMes, formatCop, formatDiaLargo, mesDe, nombreMes, type AvanceCategoria, type ItemEjecucion, type Movimiento, type ResumenMes, type TonoVence } from '@steward/domain';

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
          <span class="text-[13px] text-secundario" data-testid="fecha-hoy">{{ fechaYOpcion() }}</span>
          <h1 class="titular text-[32px] font-bold">{{ titulo() }}</h1>
        </div>
        <button type="button" class="h-9 w-9 rounded-[10px] border border-borde-campo bg-superficie font-semibold text-texto disabled:opacity-40" aria-label="Mes siguiente" [disabled]="!siguiente()" (click)="ir(siguiente())">›</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <a [routerLink]="['/planear', claveActual()]" class="flex h-10 items-center rounded-control bg-acento-suave px-3.5 text-sm font-semibold text-acento hover:bg-acento-elegido">Ver el plan</a>
        @if (cerrarMes(); as nombre) {
          <!-- Spec "Cerrar el mes desde Hoy": solo el mes en curso y sin cerrar. -->
          <a [routerLink]="['/planear', claveActual(), 'cierre']" class="flex h-10 items-center rounded-control bg-acento-suave px-3.5 text-sm font-semibold text-acento hover:bg-acento-elegido" data-testid="cerrar-mes">Cerrar {{ nombre }}</a>
        }
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

    <section class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-end gap-7 rounded-[22px] bg-acento px-7 py-6 text-white" aria-label="Resumen del mes" data-testid="resumen-mes">
      <div class="flex flex-col gap-1.5" data-testid="tarjeta-libre">
        <h2 class="text-sm font-normal text-[#CFE0D6]">Te queda libre en {{ nombreMesRef() }}</h2>
        <app-monto class="titular text-[52px] leading-none font-bold" [class.text-negativo-claro]="r.libre < 0" [valor]="r.libre" data-testid="libre" />
        <span class="mt-2 self-start rounded-full bg-[#2C6250] px-2.5 py-[5px] text-xs font-semibold text-[#E7F1EB]" data-testid="tarjeta-vs-plan">{{ fraseVsPlan(r.vsPlan) }}</span>
      </div>
      <div class="flex flex-col gap-2.5">
        <div class="flex h-2.5 overflow-hidden rounded-[5px] bg-[#3E6B58]" aria-hidden="true">
          <span class="rounded-[5px] bg-white" [style.width.%]="avancePagado()"></span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-[13px]">
          <span class="flex flex-col gap-0.5" data-testid="tarjeta-pagado"><span class="text-[#CFE0D6]">Pagado</span><app-monto class="text-base font-semibold" [valor]="r.pagado" /></span>
          <span class="flex flex-col gap-0.5" data-testid="tarjeta-falta">
            <span class="text-[#CFE0D6]">Falta pagar</span>
            <app-monto class="text-base font-semibold" [class.text-negativo-claro]="r.faltaPagar > 0" [valor]="r.faltaPagar" />
          </span>
          <span class="flex flex-col gap-0.5" data-testid="tarjeta-entro"><span class="text-[#CFE0D6]">Entró</span><app-monto class="text-base font-semibold" [valor]="r.totalIngresos" /></span>
        </div>
      </div>
    </section>

    <div class="flex flex-wrap items-start gap-5">
      <div class="flex min-w-0 flex-[2_1_560px] flex-col gap-5">
        <section class="tarjeta overflow-hidden" aria-labelledby="tabla-por-pagar">
          <div class="flex items-center justify-between border-b border-divisor px-5 py-4">
            <h2 id="tabla-por-pagar" class="text-[17px] font-semibold">Por pagar</h2>
            <span class="text-sm text-secundario">{{ subtituloFalta() }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[620px] border-collapse text-sm" data-testid="tabla-por-pagar">
              <thead class="bg-fondo text-left text-[11px] font-semibold tracking-[0.06em] text-secundario uppercase">
                <tr>
                  <th scope="col" class="w-[72px] py-2.5 pl-5"><span class="sr-only">Fecha</span></th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Gasto</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Categoría</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Vence</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Falta</th>
                  <th scope="col" class="px-5 py-2.5"><span class="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                @for (i of r.porPagar; track i.item.id; let k = $index) {
                  @if (k === 0 || r.porPagar[k - 1]!.grupo !== i.grupo) {
                    <tr [attr.data-grupo]="i.grupo">
                      <th colspan="6" scope="colgroup" class="px-5 pt-3 pb-1 text-left text-xs font-semibold" [class]="i.grupo === 'VENCIDO' ? 'text-negativo' : 'text-secundario'">{{ tituloGrupo[i.grupo] }}</th>
                    </tr>
                  }
                  <tr class="border-t border-divisor" [attr.data-item]="i.item.nombre">
                    <td class="py-3 pl-5">
                      <span class="flex size-12 flex-col items-center justify-center gap-0.5 rounded-control" [class]="claseBloque(i)" aria-hidden="true">
                        <span class="text-base leading-none font-bold">{{ diaDe(i) }}</span>
                        <span class="text-[10px] leading-none">{{ diaDe(i) === '—' ? '' : mesCorto() }}</span>
                      </span>
                    </td>
                    <td class="px-3 py-3">
                      <a [routerLink]="rutaPagar(i)" [queryParams]="paramsPagar(i)" class="flex min-w-0 flex-col gap-0.5 hover:underline">
                        <span class="font-medium">{{ i.item.nombre }}</span>
                        <span class="text-xs text-secundario">{{ detalleTabla(i) }}</span>
                      </a>
                    </td>
                    <td class="px-3 py-3 text-[13px] text-[#4A4E48]">
                      <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-[2px]" [style.background]="colorDe(i)" aria-hidden="true"></span>{{ i.categoriaNombre }}</span>
                    </td>
                    <td class="px-3 py-3 text-[13px]" [class]="tonoVence(i)" data-col="vence">{{ i.vence.texto }}</td>
                    <td class="px-3 py-3 text-right"><app-monto class="text-[13px] font-semibold" [valor]="i.pendiente" /></td>
                    <td class="px-5 py-3 text-right whitespace-nowrap">
                      @if (i.item.enlacePago) {
                        <a [href]="i.item.enlacePago" target="_blank" rel="noopener noreferrer" class="mr-3 text-[13px] font-semibold text-acento" data-testid="pagar-enlace" [attr.aria-label]="'Pagar ' + i.item.nombre + ' en línea'">Pagar ↗</a>
                      }
                      <a [routerLink]="rutaPagar(i)" [queryParams]="paramsPagar(i)" class="inline-flex h-[34px] items-center rounded-[9px] border border-control px-3 text-[13px] font-semibold whitespace-nowrap text-texto">Marcar pagado</a>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="px-5 py-4 text-secundario">Todo pagado este mes.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="tarjeta overflow-hidden" aria-labelledby="tabla-ya-pagado">
          <div class="flex items-center justify-between border-b border-divisor px-5 py-4">
            <h2 id="tabla-ya-pagado" class="text-[17px] font-semibold">Ya pagado · {{ r.yaPagado.length + r.noPlaneados.length }}</h2>
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
            <h2 id="ingresos-escritorio" class="text-[15px] font-semibold">Entró este mes</h2>
            <a routerLink="." [queryParams]="{ agregar: 'aporte' }" class="boton-texto">+ Aporte</a>
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
  private readonly hoy = inject(PUERTOS).hoy();
  private readonly enCurso = claveMes(mesDe(this.hoy));
  protected readonly tituloGrupo = TITULO_GRUPO;
  protected readonly nombreMesRef = computed(() => nombreMes(this.resumen().ref.mes));
  protected readonly mesCorto = computed(() => nombreMes(this.resumen().ref.mes).slice(0, 3));
  /** "Lunes 26 de octubre · plan activo: opción A" (artboard "Hoy (web)"). */
  protected readonly fechaYOpcion = computed(() => {
    const fecha = formatDiaLargo(this.hoy).replace(' · ', ' de ');
    const opcion = this.mes.value()?.opciones.find((o) => o.escenario.id === this.mes.value()?.plan?.escenarioActivoId);
    return opcion ? `${fecha} · plan activo: opción ${opcion.escenario.letra}` : fecha;
  });
  protected readonly avancePagado = computed(() => {
    const r = this.resumen();
    const total = r.pagado + r.faltaPagar;
    return total > 0 ? Math.round((100 * r.pagado) / total) : 100;
  });
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

  protected readonly fraseVsPlan = fraseVsPlan;

  protected readonly diaDe = diaDelBloque;

  protected claseBloque(i: ItemEjecucion): string {
    return i.grupo === 'VENCIDO' ? 'bg-negativo-suave text-negativo' : i.grupo === 'SEMANA' ? 'bg-aviso-suave text-aviso' : 'bg-nota text-secundario';
  }

  protected ir(clave: string | null): void {
    if (clave) this.mesHoy.elegir(clave);
  }

  /** Agregar sobre Hoy: un variable registra un gasto, lo demas se marca pagado (rediseno-libreta-clara). */
  protected rutaPagar(_i: ItemEjecucion): string {
    return '.';
  }

  protected paramsPagar(i: ItemEjecucion): Record<string, string> {
    return { agregar: i.item.tipo === 'VARIABLE' ? 'gasto' : 'pago', item: i.item.id };
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
