import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  claveMes, formatCop, formatMesAnio, mesDe, nombreMesCapital, parseClaveMes, sumarMeses, type Id, type ItemPlan, type ModoNuevoMes, type VistaOpcion,
} from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Encabezado } from '../../shared/components/encabezado';
import { Icono } from '../../shared/components/icono';
import { Kpi } from '../../shared/components/kpi';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';

/**
 * Un mes en Planear. Sin plan: MesVacio.dc.html (tres formas de empezar y lo que ya trae).
 * Borrador: Planear.dc.html (opciones, lo que dejaria libre, ingresos y gastos por categoria, diezmo calculado).
 * Activo o cerrado: el plan elegido en solo lectura, con acceso a Hoy o al cierre.
 */
@Component({
  selector: 'app-mes-page',
  imports: [NgTemplateOutlet, RouterLink, Encabezado, Icono, Kpi, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] px-5 pt-6 pb-4' },
  template: `
    @if (!ref()) {
      <app-encabezado titulo="Mes no válido" volver="/planear" volverTexto="Planear" />
    } @else if (vista.value(); as v) {
      @switch (v.estado) {
        @case ('SIN_PLAN') {
          <app-encabezado [titulo]="titulo()" volver="/planear" volverTexto="Planear" />
          <p class="-mt-2 text-[15px] leading-normal text-secundario">Aún no tiene plan. Empieza desde algo que ya existe y ajusta lo que cambie.</p>
          <div class="flex flex-col gap-2.5">
            @for (o of formasDeEmpezar(); track o.modo; let primero = $first) {
              <button type="button" (click)="crear(o.modo)" [disabled]="guardando()"
                class="flex items-center justify-between gap-3 rounded-[14px] p-4 text-left"
                [class]="primero ? 'border-2 border-acento bg-acento-suave' : 'border border-borde-campo bg-superficie'">
                <span class="flex flex-col gap-1">
                  <span class="text-base font-semibold">{{ o.titulo }}</span>
                  <span class="text-[13px] text-secundario">{{ o.detalle }}</span>
                </span>
                <span class="text-lg" [class]="primero ? 'text-acento' : 'text-secundario'" aria-hidden="true">›</span>
              </button>
            }
          </div>
          @if (trae.value(); as lineas) {
            @if (lineas.length) {
              <div class="flex flex-col gap-2.5 rounded-[14px] bg-[#FBF7EC] p-4" data-testid="ya-trae">
                <span class="text-[13px] font-semibold text-[#6B4A00]">{{ nombreMes() }} ya trae</span>
                @for (l of lineas; track l.nombre) {
                  <div class="flex justify-between text-sm">
                    <span>{{ l.nombre }}</span>
                    @if (l.monto === null) {
                      <span class="text-secundario">{{ l.detalle }}</span>
                    } @else {
                      <app-monto [valor]="l.monto < 0 ? -l.monto : l.monto" [signo]="l.monto > 0" />
                    }
                  </div>
                }
                <span class="text-xs text-[#6B4A00]">Se suman a cualquier opción que elijas.</span>
              </div>
            }
          }
        }

        @case ('BORRADOR') {
          <app-encabezado [titulo]="titulo()" rotulo="Borrador" [volver]="'/planear'" volverTexto="Planear">
            <a [routerLink]="['/planear/anual', ref()!.anio]" class="boton-texto">Ver año</a>
          </app-encabezado>

          <div class="flex flex-wrap gap-2" role="tablist" aria-label="Opciones del mes">
            @for (o of v.opciones; track o.escenario.id) {
              <button type="button" role="tab" [attr.aria-selected]="o.escenario.id === actual()?.escenario?.id" (click)="elegida.set(o.escenario.id)"
                class="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm"
                [class]="o.escenario.id === actual()?.escenario?.id ? 'bg-acento font-semibold text-white' : 'border border-borde bg-superficie'">
                Opción {{ o.escenario.letra }}
                @if (o.escenario.creadoPor !== usuarioActual()) {
                  <span class="text-[11px]" [class]="o.escenario.id === actual()?.escenario?.id ? 'text-white/80' : 'text-secundario'">· {{ o.inicialAutor }}</span>
                }
              </button>
            }
            <button type="button" class="flex h-9 items-center rounded-full border border-dashed border-control px-3.5 text-sm text-[#3B3D39]" (click)="duplicar()">+ Duplicar</button>
          </div>

          @if (actual(); as o) {
            <section class="flex flex-col gap-3 rounded-panel border border-dashed border-control bg-superficie p-[18px]">
              <h2 class="rotulo">Opción {{ o.escenario.letra }} dejaría libre</h2>
              <app-monto class="text-[30px] font-semibold" [class.text-[#3B3D39]]="o.libre >= 0" [class.text-negativo]="o.libre < 0" [valor]="o.libre" data-testid="dejaria-libre" />
              <div class="grid grid-cols-2 gap-2 border-t border-divisor pt-3">
                <app-kpi etiqueta="Ingresos" [valor]="o.totalIngresos" />
                <app-kpi etiqueta="Gastos" [valor]="o.totalGastos" />
              </div>
            </section>

            <ng-container [ngTemplateOutlet]="detalle" [ngTemplateOutletContext]="{ $implicit: o, editable: true }" />

            <div class="grid grid-cols-2 gap-2">
              <a [routerLink]="['/planear', clave(), 'comparar']" class="boton h-[52px] rounded-[14px] border border-control bg-superficie">Comparar</a>
              <button type="button" class="boton h-[52px] rounded-[14px] bg-acento text-white" (click)="usar(o)">Usar opción {{ o.escenario.letra }}</button>
            </div>
          }
        }

        @default {
          <app-encabezado [titulo]="titulo()" [rotulo]="v.estado === 'ACTIVO' ? 'Activo' : 'Cerrado'" volver="/planear" volverTexto="Planear" />
          @if (v.opciones[0]; as o) {
            <section class="tarjeta flex flex-col gap-3 p-[18px]">
              <h2 class="rotulo">Opción {{ o.escenario.letra }} · el plan del mes</h2>
              <div class="grid grid-cols-3 gap-2">
                <app-kpi etiqueta="Ingresos" [valor]="o.totalIngresos" />
                <app-kpi etiqueta="Gastos" [valor]="o.totalGastos" />
                <app-kpi etiqueta="Libre" [valor]="o.libre" />
              </div>
            </section>
            <ng-container [ngTemplateOutlet]="detalle" [ngTemplateOutletContext]="{ $implicit: o, editable: false }" />
          }
          <div class="grid grid-cols-2 gap-2">
            @if (v.estado === 'ACTIVO') {
              <a routerLink="/hoy" class="boton h-[52px] rounded-[14px] border border-control bg-superficie">Ver hoy</a>
            }
            <a [routerLink]="['/planear', clave(), 'cierre']" class="boton-grande" [class.col-span-2]="v.estado !== 'ACTIVO'">{{ v.estado === 'ACTIVO' ? 'Cierre de mes' : 'Ver cierre' }}</a>
          </div>
        }
      }

      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    }

    <ng-template #detalle let-o let-editable="editable">
      <section class="flex flex-col gap-1" aria-labelledby="plan-ingresos">
        <h2 id="plan-ingresos" class="text-base font-semibold">Ingresos</h2>
        <div class="flex flex-col divide-y divide-divisor">
          @for (l of o.ingresos; track l.clave) {
            <div class="flex items-center justify-between py-2.5" [class.italic]="l.tenue" [class.text-secundario]="l.tenue">
              <div class="flex flex-col gap-0.5"><span class="text-[15px]">{{ l.nombre }}</span><span class="text-xs text-secundario not-italic">{{ l.detalle }}</span></div>
              <app-monto class="text-sm" [valor]="l.monto" />
            </div>
          }
        </div>
      </section>
      <section class="flex flex-col gap-1" aria-labelledby="plan-gastos">
        <h2 id="plan-gastos" class="text-base font-semibold">Gastos</h2>
        <div class="flex flex-col divide-y divide-divisor">
          @for (g of o.grupos; track g.categoriaId) {
            <div>
              <button type="button" class="flex w-full items-center justify-between py-2.5 text-left" [attr.aria-expanded]="abierta() === g.categoriaId" (click)="alternar(g.categoriaId)">
                <span class="flex items-center gap-2 text-[15px]"><span class="h-2 w-2 rounded-[2px]" [style.background]="g.color" aria-hidden="true"></span>{{ g.nombre }}</span>
                <app-monto class="text-sm" [valor]="g.total" />
              </button>
              @if (abierta() === g.categoriaId) {
                <ul class="mb-2 flex flex-col gap-2 rounded-xl bg-nota p-3" [attr.aria-label]="'Gastos de ' + g.nombre">
                  @for (item of g.items; track item.id) {
                    <li class="flex items-center justify-between gap-3">
                      <span class="min-w-0 truncate text-sm">{{ item.nombre }}</span>
                      @if (editable) {
                        <app-monto-input class="w-36" [valor]="item.monto" [etiquetaAccesible]="'Monto de ' + item.nombre" (valorChange)="cambiarMonto(o, item, $event)" />
                      } @else {
                        <app-monto class="text-sm" [valor]="item.monto" />
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          }
          <div class="flex items-center justify-between py-2.5" data-testid="fila-diezmo">
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-2 text-[15px]"><span class="h-2 w-2 rounded-[2px] bg-cat-diezmo" aria-hidden="true"></span>Diezmo</span>
              <span class="pl-4 text-xs text-secundario">{{ o.diezmo.detalle }}</span>
            </div>
            <span class="flex items-center gap-1.5 text-secundario">
              <app-monto class="text-sm" [valor]="o.diezmo.monto" />
              <app-icono nombre="candado" [tamano]="14" />
              <span class="sr-only">No editable: se calcula solo</span>
            </span>
          </div>
        </div>
        @if (editable) {
          <form class="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-nota p-3" (submit)="$event.preventDefault(); agregar(o)" aria-label="Agregar un gasto a la opción">
            <select class="h-11 rounded-control border border-borde bg-superficie px-2 text-sm focus:border-acento focus:outline-none" aria-label="Categoría del gasto"
              [value]="categoriaNueva() ?? ''" (change)="categoriaNueva.set($any($event.target).value)">
              @for (c of categorias.value() ?? []; track c.id) {
                <option [value]="c.id">{{ c.nombre }}</option>
              }
            </select>
            <input class="h-11 min-w-0 grow rounded-control border border-borde bg-superficie px-3 text-sm focus:border-acento focus:outline-none" placeholder="Nuevo gasto" aria-label="Nombre del gasto"
              [value]="nuevo()" (input)="nuevo.set($any($event.target).value)" />
            <button type="submit" class="boton-texto font-semibold" [disabled]="!nuevo().trim()">+ Agregar</button>
          </form>
        }
      </section>
    </ng-template>
  `,
})
export class MesPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);

  /** Parametro de la ruta (`/planear/:mes`, `YYYY-MM`). */
  readonly mes = input.required<string>();
  protected readonly ref = computed(() => parseClaveMes(this.mes()));
  protected readonly clave = computed(() => (this.ref() ? claveMes(this.ref()!) : ''));
  protected readonly titulo = computed(() => (this.ref() ? formatMesAnio(this.ref()!) : ''));
  protected readonly nombreMes = computed(() => (this.ref() ? nombreMesCapital(this.ref()!.mes) : ''));

  protected readonly vista = consulta(() => this.ref() ?? mesDe(this.puertos.hoy()), (p, ref) => p.plan.mes(ref));
  protected readonly trae = consulta(() => this.ref() ?? mesDe(this.puertos.hoy()), (p, ref) => p.plan.loQueTrae(ref));
  private readonly sesion = consulta(() => null, (p) => p.sesion.actual());
  protected readonly usuarioActual = computed(() => this.sesion.value()?.usuario.id ?? null);

  protected readonly categorias = consulta(() => null, (p) => p.hogar.categorias());
  protected readonly categoriaNueva = signal<Id | null>(null);
  protected readonly elegida = signal<Id | null>(null);
  protected readonly abierta = signal<Id | null>(null);
  protected readonly nuevo = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly actual = computed<VistaOpcion | null>(() => {
    const opciones = this.vista.value()?.opciones ?? [];
    return opciones.find((o) => o.escenario.id === this.elegida()) ?? opciones[0] ?? null;
  });

  /** El mes anterior, para "Copiar {mes} · Opción A · gastos $X". */
  private readonly anterior = consulta(() => sumarMeses(this.ref() ?? mesDe(this.puertos.hoy()), -1), (p, ref) => p.plan.mes(ref));

  protected readonly formasDeEmpezar = computed(() => {
    const anterior = this.ref() ? nombreMesCapital(sumarMeses(this.ref()!, -1).mes).toLowerCase() : '';
    const base = this.anterior.value()?.opciones[0];
    return [
      {
        modo: 'COPIAR' as ModoNuevoMes,
        titulo: `Copiar ${anterior}`,
        detalle: base ? `Opción ${base.escenario.letra} · gastos ${formatCop(base.totalGastos)}` : 'El mes anterior no tiene plan: empieza vacío',
      },
      { modo: 'FIJOS' as ModoNuevoMes, titulo: 'Solo fijos e ingresos', detalle: 'Salario, fijos, tarjetas y créditos. Variables en blanco.' },
      { modo: 'CERO' as ModoNuevoMes, titulo: 'Empezar desde cero', detalle: 'Solo el salario y el diezmo calculado' },
    ];
  });

  protected alternar(categoriaId: Id): void {
    this.abierta.set(this.abierta() === categoriaId ? null : categoriaId);
    this.nuevo.set('');
  }

  protected async crear(modo: ModoNuevoMes): Promise<void> {
    await this.ejecutar(() => this.puertos.plan.crearMes(this.ref()!, modo));
  }

  protected async duplicar(): Promise<void> {
    const plan = this.vista.value()?.plan;
    const o = this.actual();
    if (!plan || !o) return;
    await this.ejecutar(async () => {
      const id = await this.puertos.plan.duplicar(plan.id, o.escenario.id);
      this.elegida.set(id);
    });
  }

  protected async usar(o: VistaOpcion): Promise<void> {
    const plan = this.vista.value()?.plan;
    if (!plan) return;
    await this.ejecutar(async () => {
      await this.puertos.plan.usar(plan.id, o.escenario.id);
      await this.router.navigateByUrl('/planear');
    });
  }

  protected async cambiarMonto(o: VistaOpcion, item: ItemPlan, monto: number | null): Promise<void> {
    const plan = this.vista.value()?.plan;
    if (!plan || monto === null || monto === item.monto) return;
    await this.ejecutar(() => this.puertos.plan.guardarItem(plan.id, o.escenario.id, { ...item, monto }));
  }

  /** "+ Agregar": un gasto nuevo en cualquier categoria (tambien las recien creadas en Ajustes); se abre para darle monto. */
  protected async agregar(o: VistaOpcion): Promise<void> {
    const plan = this.vista.value()?.plan;
    const categoria = (this.categorias.value() ?? []).find((c) => c.id === this.categoriaNueva()) ?? this.categorias.value()?.[0];
    if (!plan || !categoria || !this.nuevo().trim()) return;
    const tipo = categoria.tipo === 'VARIABLE' ? 'VARIABLE' : categoria.tipo === 'CREDITO' ? 'CREDITO' : 'FIJO';
    await this.ejecutar(async () => {
      await this.puertos.plan.guardarItem(plan.id, o.escenario.id, { categoriaId: categoria.id, nombre: this.nuevo(), monto: 0, diaVence: null, tipo, cuota: null, creditoId: null });
      this.nuevo.set('');
      this.abierta.set(categoria.id);
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await accion();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
