import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TITULO_GRUPO, diaDelBloque, fraseVsPlan, claveMes, formatCop, formatDiaLargo, formatDiaSemana, formatMesAnio, nombreMes, sumar, type GrupoPorPagar, type ItemEjecucion, type ResumenMes } from '@steward/domain';

import { consulta } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { AvataresHogar } from '../../core/layout/avatares-hogar';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Avatar } from '../../shared/components/avatar';
import { Fila } from '../../shared/components/fila';
import { Icono } from '../../shared/components/icono';
import { Monto } from '../../shared/components/monto';
import { Segmentado } from '../../shared/components/segmentado';
import { anchoEscritorio } from '../../shared/escritorio';
import { HoyEscritorio } from './hoy-escritorio';
import { IngresosHoy } from './ingresos-hoy';
import { MesDeHoy } from './mes-de-hoy';

/** Pendientes que se ven antes de "Ver N más" (spec steward-hoy). */
const LISTA_CORTA = 3;

/**
 * Main.dc.html: el mes en curso (spec steward-hoy). Las hojas de registro son rutas hijas. El diezmo son items del plan
 * (Por pagar y Ya pagado), sin tarjeta aparte, y los ingresos son las lineas de la opcion en uso (diezmo-como-gasto).
 */
@Component({
  selector: 'app-hoy-page',
  imports: [RouterLink, RouterOutlet, AvataresHogar, Avatar, Fila, HoyEscritorio, Icono, IngresosHoy, Monto, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'block px-10 pt-7 pb-10' : 'flex flex-col gap-5 px-5 pt-6 pb-4'" },
  template: `
    @if (escritorio()) {
      @if (resumen.value(); as r) {
        <app-hoy-escritorio [resumen]="r" [rotulo]="rotulo" [titulo]="titulo()" [claveActual]="claveActual()" [opcionPorElegir]="opcionPorElegir()" />
      } @else {
        <p class="text-secundario">Cargando el mes…</p>
      }
    } @else {
    <header class="flex items-center justify-between px-1">
      <div class="flex flex-col gap-0.5">
        <span class="text-[13px] text-secundario" data-testid="fecha-hoy">{{ fechaLarga }}</span>
        <h1 class="titular text-[28px] font-bold">Hoy</h1>
      </div>
      <app-avatares-hogar />
    </header>

    <app-segmentado etiquetaAccesible="Mes que se ejecuta" [opciones]="mesHoy.opciones" [valor]="mesHoy.clave()" (valorChange)="$event && mesHoy.elegir($event)" />

    @if (opcionPorElegir(); as letra) {
      <a [routerLink]="['/planear', claveActual()]" class="text-[13px] font-medium text-acento" data-testid="opcion-por-elegir">Opción {{ letra }} · elige otra en Plan</a>
    }

    @if (resumen.value(); as r) {
      @if (r.sinPlan) {
        <section class="tarjeta flex flex-col gap-3 p-[18px]">
          <span class="rotulo">Este mes no tiene plan</span>
          <p class="text-sm text-secundario">Empieza desde el mes anterior, solo con lo fijo o desde cero.</p>
          <a [routerLink]="['/planear', claveActual()]" class="boton-primario self-start">Planear {{ titulo() }}</a>
        </section>
      }

      <section class="flex flex-col gap-4 rounded-panel bg-acento p-5 text-white" aria-labelledby="te-queda-libre" data-testid="resumen-mes">
        <div class="flex flex-col gap-1">
          <h2 id="te-queda-libre" class="text-[13px] font-normal text-[#CFE0D6]">Te queda libre en {{ nombreMesRef() }}</h2>
          <app-monto class="titular text-[40px] leading-[1.05] font-bold" [class.text-[#FFCDC7]]="r.libre < 0" [valor]="r.libre" data-testid="libre" />
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex h-2 overflow-hidden rounded bg-[#3E6B58]" aria-hidden="true">
            <span class="rounded bg-white" [style.width.%]="avance(r)"></span>
          </div>
          <div class="flex justify-between text-[13px]">
            <span class="flex flex-col gap-px" data-testid="pagado">
              <span class="text-[#CFE0D6]">Pagado</span>
              <app-monto class="font-semibold" [valor]="r.pagado" />
            </span>
            <span class="flex flex-col gap-px text-right" data-testid="falta-pagar">
              <span class="text-[#CFE0D6]">Falta pagar</span>
              <!-- Destacada en el color de alerta mientras sea mayor que cero (spec "Resumen del mes en Hoy"). -->
              <app-monto class="font-semibold" [class]="r.faltaPagar > 0 ? 'text-negativo-claro' : ''" [valor]="r.faltaPagar" />
            </span>
          </div>
        </div>
        <span class="self-start rounded-full bg-[#2C6250] px-2.5 py-[5px] text-xs font-semibold text-[#E7F1EB]" data-testid="vs-plan">{{ fraseVsPlan(r.vsPlan) }}</span>
      </section>

      <section class="tarjeta flex flex-col pt-1.5 pb-1" aria-labelledby="por-pagar">
        <div class="flex items-baseline justify-between px-4 pt-3 pb-1.5">
          <h2 id="por-pagar" class="text-base font-semibold">Por pagar</h2>
          @if (r.porPagar.length) {
            <span class="text-[13px] text-secundario" data-testid="pendientes">{{ r.porPagar.length }} {{ r.porPagar.length === 1 ? 'pendiente' : 'pendientes' }}</span>
          }
        </div>
        @for (g of grupos(r); track g.grupo) {
          <h3 class="px-4 pt-2.5 pb-0.5 text-xs font-semibold" [class]="g.grupo === 'VENCIDO' ? 'text-negativo' : 'text-secundario'" [attr.data-grupo]="g.grupo">{{ g.titulo }}</h3>
          @for (i of g.items; track i.item.id) {
            <a routerLink="." [queryParams]="{ agregar: i.item.tipo === 'VARIABLE' ? 'gasto' : 'pago', item: i.item.id }" class="flex items-center gap-3 px-4 hover:bg-fondo" [attr.aria-label]="'Marcar ' + i.item.nombre + ' como pagado'">
              <span class="flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-control" [class]="claseBloque(i)" aria-hidden="true">
                <span class="text-[15px] leading-none font-bold">{{ diaDe(i) }}</span>
                <span class="text-[10px] leading-none">{{ diaDe(i) === '—' ? '' : mesCorto() }}</span>
              </span>
              <app-fila class="min-w-0 grow" [titulo]="i.item.nombre" [detalle]="i.detalle" [tonoDetalle]="i.vencido ? 'font-semibold text-negativo' : 'text-secundario'">
                <app-monto class="text-[15px] font-semibold" [valor]="i.pendiente" />
                <span class="flex size-11 items-center justify-center rounded-full border-2 border-[#D6D3CB] text-[#8A8D85]" aria-hidden="true"><app-icono nombre="check" [tamano]="18" /></span>
              </app-fila>
            </a>
          }
        } @empty {
          <p class="px-4 pt-1 pb-4 text-sm text-secundario">Todo pagado este mes.</p>
        }
        @if (ocultos(r); as o) {
          <button type="button" class="mx-4 flex h-11 items-center justify-between border-t border-divisor text-left text-[13px] font-medium text-acento" (click)="verTodo.set(true)" data-testid="ver-mas">
            <span>Ver {{ o.cantidad }} más · {{ r.porPagar.length }} pendientes en total</span>
            <app-monto class="text-secundario" [valor]="o.monto" />
          </button>
        }
      </section>

      <section class="tarjeta flex flex-col px-4 py-1.5" aria-labelledby="ingresos">
        <div class="flex items-center justify-between pt-2.5 pb-1">
          <h2 id="ingresos" class="text-base font-semibold">Entró este mes</h2>
          <a routerLink="." [queryParams]="{ agregar: 'aporte' }" class="boton-texto text-sm">+ Aporte</a>
        </div>
        <app-ingresos-hoy [ingresos]="r.ingresos" />
      </section>

      @if (r.yaPagado.length || r.noPlaneados.length) {
        <section class="tarjeta flex flex-col px-4 py-1" aria-labelledby="ya-pagado">
          <h2 id="ya-pagado" class="text-base font-semibold">
            <button type="button" class="flex min-h-11 w-full items-center justify-between" [attr.aria-expanded]="pagadosAbiertos()" (click)="pagadosAbiertos.set(!pagadosAbiertos())">
              <span>Ya pagado · {{ r.yaPagado.length + r.noPlaneados.length }}</span>
              <span class="text-[13px] font-semibold text-acento">{{ pagadosAbiertos() ? 'Ocultar' : 'Ver' }}</span>
            </button>
          </h2>
          @if (pagadosAbiertos()) {
            <div class="flex flex-col divide-y divide-divisor border-t border-divisor">
              @for (i of r.yaPagado; track i.item.id) {
                <a [routerLink]="i.pagos.length === 1 ? ['registro', i.pagos[0]!.id] : 'registros'" [queryParams]="i.pagos.length === 1 ? null : { item: i.item.id }" class="flex items-center gap-3 hover:bg-fondo">
                  <app-avatar [inicial]="miembros.inicialDe(i.pagadoPor)" [variante]="miembros.varianteDe(i.pagadoPor)" [tamano]="30" [nombre]="'Pagó ' + miembros.nombreDe(i.pagadoPor)" />
                  <app-fila class="min-w-0 grow" [titulo]="i.item.nombre">
                    <span detalle class="text-xs" [class]="(i.diferencia ?? 0) < 0 ? 'text-positivo' : 'text-secundario'">
                      @if (i.diferencia) {
                        plan <app-monto [valor]="i.plan" /> · <app-monto [valor]="i.diferencia" [signo]="true" />
                      } @else {
                        {{ i.detalle }}
                      }
                    </span>
                    <app-monto class="text-sm font-medium text-texto-medio" [valor]="i.real" />
                  </app-fila>
                </a>
              }
              @for (m of r.noPlaneados; track m.id) {
                <a [routerLink]="m.tipo === 'GASTO' ? ['registro', m.id] : null" class="flex items-center gap-3 hover:bg-fondo">
                  <app-avatar [inicial]="miembros.inicialDe(m.usuarioId)" [variante]="miembros.varianteDe(m.usuarioId)" [tamano]="30" [nombre]="'Pagó ' + miembros.nombreDe(m.usuarioId)" />
                  <app-fila class="min-w-0 grow" [titulo]="m.nota || 'Gasto'" detalle="No estaba planeado">
                    <app-monto class="text-sm font-medium text-texto-medio" [valor]="m.monto" />
                  </app-fila>
                </a>
              }
            </div>
          }
        </section>
      }

    } @else {
      <p class="text-secundario">Cargando el mes…</p>
    }
    }

    <router-outlet />
  `,
})
export class HoyPage {
  private readonly puertos = inject(PUERTOS);
  protected readonly miembros = inject(MiembrosHogar);

  private readonly hoy = this.puertos.hoy();
  protected readonly mesHoy = inject(MesDeHoy);
  protected readonly claveActual = computed(() => claveMes(this.mesHoy.ref()));
  protected readonly rotulo = `Hoy · ${formatDiaSemana(this.hoy)}`;
  /** "Lunes 26 · octubre" (artboard "Hoy"). */
  protected readonly fechaLarga = formatDiaLargo(this.hoy);
  protected readonly titulo = computed(() => formatMesAnio(this.mesHoy.ref()));
  protected readonly nombreMesRef = computed(() => nombreMes(this.mesHoy.ref().mes));
  protected readonly mesCorto = computed(() => nombreMes(this.mesHoy.ref().mes).slice(0, 3));
  /** "Ya pagado" empieza abierto y se pliega. */
  protected readonly pagadosAbiertos = linkedSignal({ source: () => this.mesHoy.ref(), computation: () => true });

  protected readonly resumen = consulta(() => this.mesHoy.ref(), (p, ref) => p.movimientos.resumenMes(ref));
  private readonly mes = consulta(() => this.mesHoy.ref(), (p, ref) => p.plan.mes(ref));
  /** Varias opciones sin elegir: se ejecuta la principal (design D3 de plan-mes-siguiente). */
  protected readonly opcionPorElegir = computed(() => {
    const m = this.mes.value();
    return m?.plan && !m.plan.escenarioActivoId && m.opciones.length > 1 ? m.opciones[0]!.escenario.letra : null;
  });

  /** Por pagar empieza corto (3 items) y se despliega con "Ver N más"; al cambiar de mes vuelve a corto. */
  protected readonly verTodo = linkedSignal({ source: () => this.mesHoy.ref(), computation: () => false });

  protected visibles(r: ResumenMes): ItemEjecucion[] {
    return this.verTodo() ? r.porPagar : r.porPagar.slice(0, LISTA_CORTA);
  }

  protected ocultos(r: ResumenMes): { cantidad: number; monto: number } | null {
    if (this.verTodo() || r.porPagar.length <= LISTA_CORTA) return null;
    const resto = r.porPagar.slice(LISTA_CORTA);
    return { cantidad: resto.length, monto: sumar(resto.map((i) => i.pendiente)) };
  }

  /** Lo visible de Por pagar en sus grupos, en el orden del dominio (spec "Resumen del mes en Hoy"). */
  protected grupos(r: ResumenMes): { grupo: GrupoPorPagar; titulo: string; items: ItemEjecucion[] }[] {
    const grupos: { grupo: GrupoPorPagar; titulo: string; items: ItemEjecucion[] }[] = [];
    for (const i of this.visibles(r)) {
      const ultimo = grupos.at(-1);
      if (ultimo?.grupo === i.grupo) ultimo.items.push(i);
      else grupos.push({ grupo: i.grupo, titulo: TITULO_GRUPO[i.grupo], items: [i] });
    }
    return grupos;
  }

  protected readonly diaDe = diaDelBloque;

  protected claseBloque(i: ItemEjecucion): string {
    return i.grupo === 'VENCIDO' ? 'bg-negativo-suave text-negativo' : i.grupo === 'SEMANA' ? 'bg-aviso-suave text-aviso' : 'bg-nota text-secundario';
  }

  /** La barra de la tarjeta: lo pagado frente a lo pagado mas lo que falta. */
  protected avance(r: ResumenMes): number {
    const total = r.pagado + r.faltaPagar;
    return total > 0 ? Math.round((100 * r.pagado) / total) : 100;
  }

  protected readonly fraseVsPlan = fraseVsPlan;

  /** Desde 1024 px, Hoy detallado (spec "Hoy detallado en escritorio"); se monta una sola de las dos vistas (design D3). */
  protected readonly escritorio = anchoEscritorio();

}
