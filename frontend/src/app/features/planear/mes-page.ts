import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  claveMes, formatCop, formatMesAnio, mesDe, nombreMes, nombreMesCapital, parseClaveMes, sumarMeses, type ConteoBorrado, type Id, type IngresoPlan, type ItemPlan, type LineaIngreso,
  type ModoNuevoMes, type VistaOpcion,
} from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Encabezado } from '../../shared/components/encabezado';
import { Hoja } from '../../shared/components/hoja';
import { Kpi } from '../../shared/components/kpi';
import { Monto } from '../../shared/components/monto';
import { MesDeHoy } from '../hoy/mes-de-hoy';
import { GastoPlanHoja } from './gasto-plan-hoja';
import { IngresoHoja } from './ingreso-hoja';

/**
 * Un mes en Planear. Sin plan: MesVacio.dc.html (tres formas de empezar y lo que ya trae).
 * Borrador: Planear.dc.html (opciones, lo que dejaria libre, ingresos y gastos por categoria). Las lineas de ingreso y los
 * gastos se editan en hojas con "Guardar" (design D5 de usabilidad-plan).
 * Activo: el plan elegido, editable con las mismas hojas, con acceso a Hoy y al cierre. Cerrado: en solo lectura.
 */
@Component({
  selector: 'app-mes-page',
  imports: [NgTemplateOutlet, RouterLink, Encabezado, GastoPlanHoja, Hoja, IngresoHoja, Kpi, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] px-5 pt-6 pb-4' },
  template: `
    @if (!ref()) {
      <app-encabezado titulo="Mes no válido" volver="/planear" volverTexto="Plan" />
    } @else if (vista.value(); as v) {
      @switch (v.estado) {
        @case ('SIN_PLAN') {
          <app-encabezado [titulo]="titulo()" volver="/planear" volverTexto="Plan" />
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
          <app-encabezado [titulo]="titulo()" rotulo="Borrador" [volver]="'/planear'" volverTexto="Plan">
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
              <h2 class="rotulo">{{ o.libre < 0 ? 'Con la Opción ' + o.escenario.letra + ' faltarían' : 'Opción ' + o.escenario.letra + ' dejaría libre' }}</h2>
              <app-monto class="text-[30px] font-semibold" [class.text-[#3B3D39]]="o.libre >= 0" [class.text-negativo]="o.libre < 0" [valor]="o.libre < 0 ? -o.libre : o.libre" data-testid="dejaria-libre" />
              <div class="grid grid-cols-2 gap-2 border-t border-divisor pt-3">
                <app-kpi etiqueta="Ingresos" [valor]="o.totalIngresos" />
                <app-kpi etiqueta="Gastos" [valor]="o.totalGastos" />
              </div>
              @if (puedeQuitar(v.opciones.length, o)) {
                <!-- Quitar una opcion que ya no sirve: ni la ultima ni la que esta en uso (backend-opciones-mes D5). -->
                <button type="button" class="boton-texto self-start text-sm font-normal text-negativo" (click)="confirmarQuitar.set(true)">Quitar opción</button>
              }
            </section>

            @if (confirmarQuitar()) {
              <app-hoja [titulo]="'¿Quitar la Opción ' + o.escenario.letra + '?'" (cerrar)="confirmarQuitar.set(false)">
                <p class="text-sm text-[#3B3D39]">Se borran sus gastos. Las demás opciones no cambian.</p>
                <button type="button" class="boton-grande bg-negativo" [disabled]="guardando()" (click)="quitar(o)">Quitar opción {{ o.escenario.letra }}</button>
              </app-hoja>
            }

            <ng-container [ngTemplateOutlet]="detalle" [ngTemplateOutletContext]="{ $implicit: o, editable: true }" />

            @if (seEjecuta()) {
              <button type="button" class="boton-texto self-start font-semibold" (click)="verEjecucion()">Ver en Ejecución</button>
            }

            <div class="grid grid-cols-2 gap-2">
              <a [routerLink]="['/planear', clave(), 'comparar']" class="boton h-[52px] rounded-[14px] border border-control bg-superficie">Comparar</a>
              <button type="button" class="boton h-[52px] rounded-[14px] bg-acento text-white" (click)="usar(o)">Usar opción {{ o.escenario.letra }}</button>
            </div>
          }
        }

        @default {
          <app-encabezado [titulo]="titulo()" [rotulo]="v.estado === 'ACTIVO' ? 'Activo' : 'Cerrado'" volver="/planear" volverTexto="Plan" />
          @if (v.opciones[0]; as o) {
            <section class="tarjeta flex flex-col gap-3 p-[18px]">
              <h2 class="rotulo">Opción {{ o.escenario.letra }} · el plan del mes</h2>
              <div class="grid grid-cols-3 gap-2">
                <app-kpi etiqueta="Ingresos" [valor]="o.totalIngresos" />
                <app-kpi etiqueta="Gastos" [valor]="o.totalGastos" />
                <app-kpi etiqueta="Libre" [valor]="o.libre" />
              </div>
            </section>
            <ng-container [ngTemplateOutlet]="detalle" [ngTemplateOutletContext]="{ $implicit: o, editable: v.estado === 'ACTIVO' }" />
          }
          <div class="grid grid-cols-2 gap-2">
            @if (v.estado === 'ACTIVO') {
              <button type="button" class="boton h-[52px] rounded-[14px] border border-control bg-superficie" (click)="verEjecucion()">Ver ejecución</button>
            }
            <a [routerLink]="['/planear', clave(), 'cierre']" class="boton-grande" [class.col-span-2]="v.estado !== 'ACTIVO'">{{ v.estado === 'ACTIVO' ? 'Cierre de mes' : 'Ver cierre' }}</a>
          </div>
        }
      }

      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }

      @if (v.estado !== 'SIN_PLAN' || sinPlanCerrado.value()) {
        <button type="button" class="boton-texto self-center font-normal text-negativo" [disabled]="guardando()" (click)="abrirBorrar()">Borrar plan de {{ nombreMesMinuscula() }}</button>
      }

      @if (conteo(); as c) {
        <app-hoja [titulo]="'¿Borrar el plan de ' + nombreMesMinuscula() + '?'" (cerrar)="conteo.set(null)">
          <p class="text-[15px] text-secundario" data-testid="que-se-borra">{{ queSeBorra(c) }}</p>
          @if (error()) {
            <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
          }
          @if (conRegistros(c) && !seguro()) {
            <button type="button" class="boton-grande bg-negativo" (click)="seguro.set(true)">Continuar</button>
          } @else {
            <button type="button" class="boton-grande bg-negativo" [disabled]="guardando()" (click)="borrarPlan()">{{ conRegistros(c) ? 'Sí, borrar el plan y sus registros' : 'Borrar plan' }}</button>
          }
        </app-hoja>
      }

      @if (v.plan && actual(); as o) {
        @if (hojaIngreso(); as h) {
          <app-ingreso-hoja [planId]="v.plan.id" [escenarioId]="o.escenario.id" [letra]="o.escenario.letra" [linea]="h.linea" (cerrar)="hojaIngreso.set(null)" (guardado)="guardado()" />
        }
        @if (hojaGasto(); as h) {
          <app-gasto-plan-hoja [planId]="v.plan.id" [escenarioId]="o.escenario.id" [letra]="o.escenario.letra" [categorias]="categoriasParaAgregar()" [lineas]="o.escenario.ingresos" [item]="h.item" (cerrar)="hojaGasto.set(null)" (guardado)="guardado()" />
        }
      }

      @if (aviso()) {
        <p role="status" class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#3A3B38] px-4 py-2 text-sm text-white" data-testid="guardado">Guardado</p>
      }
    }

    <ng-template #detalle let-o let-editable="editable">
      <section class="flex flex-col gap-1" aria-labelledby="plan-ingresos">
        <h2 id="plan-ingresos" class="text-base font-semibold">Ingresos</h2>
        <div class="flex flex-col divide-y divide-divisor">
          @for (l of o.ingresos; track l.clave) {
            @if (editable && lineaDe(o, l); as linea) {
              <button type="button" class="flex w-full items-center justify-between gap-3 py-2.5 text-left" data-testid="linea-ingreso" (click)="hojaIngreso.set({ linea })">
                <span class="flex min-w-0 flex-col gap-0.5"><span class="truncate text-[15px]">{{ l.nombre }}</span><span class="text-xs text-secundario">{{ l.detalle }}</span></span>
                <span class="flex shrink-0 items-center gap-2"><app-monto class="text-sm" [valor]="l.monto" /><span class="text-secundario" aria-hidden="true">›</span></span>
              </button>
            } @else {
              <div class="flex items-center justify-between py-2.5" [class.italic]="l.tenue" [class.text-secundario]="l.tenue">
                <div class="flex flex-col gap-0.5"><span class="text-[15px]">{{ l.nombre }}</span><span class="text-xs text-secundario not-italic">{{ l.detalle }}</span></div>
                <app-monto class="text-sm" [valor]="l.monto" />
              </div>
            }
          }
        </div>
        @if (editable) {
          <button type="button" class="boton-texto mt-1 self-start font-semibold" (click)="hojaIngreso.set({ linea: null })">+ Ingreso</button>
        }
      </section>
      <section class="flex flex-col gap-1" aria-labelledby="plan-gastos">
        <h2 id="plan-gastos" class="text-base font-semibold">Gastos</h2>
        <div class="flex flex-col divide-y divide-divisor">
          @for (g of o.grupos; track g.categoriaId) {
            <div>
              <button type="button" class="flex w-full items-center justify-between py-2.5 text-left" [attr.aria-expanded]="abierta() === g.categoriaId" (click)="alternar(g.categoriaId)">
                <span class="flex items-center gap-2 text-[15px]"><span class="h-2 w-2 rounded-[2px]" [style.background]="g.color" aria-hidden="true"></span>{{ g.nombre }} <span class="text-xs text-secundario">· {{ g.items.length }}</span></span>
                <span class="flex items-center gap-2"><app-monto class="text-sm" [valor]="g.total" /><span class="w-3 text-center text-secundario" aria-hidden="true">{{ abierta() === g.categoriaId ? '⌄' : '›' }}</span></span>
              </button>
              @if (abierta() === g.categoriaId) {
                <ul class="mb-2 flex flex-col gap-2 rounded-xl bg-nota p-3" [attr.aria-label]="'Gastos de ' + g.nombre">
                  @for (item of g.items; track item.id) {
                    <li>
                      @if (editable) {
                        <button type="button" class="flex w-full items-center justify-between gap-3 py-1 text-left" (click)="hojaGasto.set({ item })">
                          <span class="min-w-0 truncate text-sm">{{ item.nombre }}@if (item.ajustadoAMano) { <span class="text-xs text-secundario"> · ajustado a mano</span> }</span>
                          <span class="flex shrink-0 items-center gap-2"><app-monto class="text-sm" [valor]="item.monto" /><span class="text-secundario" aria-hidden="true">›</span></span>
                        </button>
                      } @else {
                        <div class="flex items-center justify-between gap-3">
                          <span class="min-w-0 truncate text-sm">{{ item.nombre }}</span>
                          <app-monto class="text-sm" [valor]="item.monto" />
                        </div>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </div>
        @if (editable) {
          <button type="button" class="boton-texto mt-1 self-start font-semibold" (click)="hojaGasto.set({ item: null })">+ Gasto</button>
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
  /** Diezmo al final: un gasto nuevo casi nunca es diezmo, y el primero de la lista es el que se elige sin tocar. */
  protected readonly categoriasParaAgregar = computed(() => {
    const todas = this.categorias.value() ?? [];
    return [...todas.filter((c) => c.tipo !== 'DIEZMO'), ...todas.filter((c) => c.tipo === 'DIEZMO')];
  });
  protected readonly elegida = signal<Id | null>(null);
  protected readonly abierta = signal<Id | null>(null);
  protected readonly hojaIngreso = signal<{ linea: IngresoPlan | null } | null>(null);
  protected readonly hojaGasto = signal<{ item: ItemPlan | null } | null>(null);
  protected readonly aviso = signal(false);
  protected readonly conteo = signal<ConteoBorrado | null>(null);
  protected readonly seguro = signal(false);
  /** Un mes cerrado sin plan tambien se puede borrar, para dejarlo otra vez sin cierre. */
  protected readonly sinPlanCerrado = consulta(() => this.ref() ?? mesDe(this.puertos.hoy()), (p, ref) => p.cierre.vista(ref).then((v) => v.cerrado).catch(() => false));
  protected readonly nombreMesMinuscula = computed(() => (this.ref() ? nombreMes(this.ref()!.mes) : ''));
  private readonly mesHoy = inject(MesDeHoy);
  protected readonly seEjecuta = computed(() => Boolean(this.ref()) && this.mesHoy.seEjecuta(this.ref()!));
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
      { modo: 'CERO' as ModoNuevoMes, titulo: 'Empezar desde cero', detalle: 'Solo los ingresos, sus diezmos y las cuotas' },
    ];
  });

  protected alternar(categoriaId: Id): void {
    this.abierta.set(this.abierta() === categoriaId ? null : categoriaId);
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

  protected readonly confirmarQuitar = signal(false);

  protected puedeQuitar(vigentes: number, o: VistaOpcion): boolean {
    return vigentes > 1 && o.escenario.id !== this.vista.value()?.plan?.escenarioActivoId;
  }

  protected async quitar(o: VistaOpcion): Promise<void> {
    const plan = this.vista.value()?.plan;
    if (!plan) return;
    await this.ejecutar(async () => {
      await this.puertos.plan.quitarOpcion(plan.id, o.escenario.id);
      this.elegida.set(null);
    });
    this.confirmarQuitar.set(false);
  }

  protected async usar(o: VistaOpcion): Promise<void> {
    const plan = this.vista.value()?.plan;
    if (!plan) return;
    await this.ejecutar(async () => {
      await this.puertos.plan.usar(plan.id, o.escenario.id);
      await this.router.navigateByUrl('/planear');
    });
  }

  /** Abre Hoy con este mes elegido. */
  protected verEjecucion(): Promise<boolean> {
    this.mesHoy.elegir(this.clave());
    return this.router.navigateByUrl('/hoy');
  }

  /** La linea de la opcion detras de lo que se ve (solo las de la opcion se editan; los aportes y el sobrante no). */
  protected lineaDe(o: VistaOpcion, l: LineaIngreso): IngresoPlan | null {
    return o.escenario.ingresos.find((x) => x.id === l.lineaId) ?? null;
  }

  /** La hoja ya guardo: se cierra y avisa "Guardado" un momento. */
  protected guardado(): void {
    this.hojaIngreso.set(null);
    this.hojaGasto.set(null);
    this.aviso.set(true);
    setTimeout(() => this.aviso.set(false), 2500);
  }

  protected conRegistros(c: ConteoBorrado): boolean {
    return c.pagos + c.gastos + c.ingresos > 0;
  }

  /** "Se borran 3 pagos, 2 gastos y 1 ingreso recibido de octubre; los aportes se conservan." */
  protected queSeBorra(c: ConteoBorrado): string {
    const contar = (n: number, uno: string, varios: string) => (n ? [`${n} ${n === 1 ? uno : varios}`] : []);
    const partes = [...contar(c.pagos, 'pago', 'pagos'), ...contar(c.gastos, 'gasto', 'gastos'), ...contar(c.ingresos, 'ingreso recibido', 'ingresos recibidos')];
    const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0];
    const cierre = c.cerrado ? ' y su cierre' : '';
    const mes = this.nombreMesMinuscula();
    return lista ? `Se borran ${lista} de ${mes}${cierre}; los aportes se conservan.` : `Se borra el plan de ${mes}${cierre}. No tiene pagos ni gastos registrados.`;
  }

  protected async abrirBorrar(): Promise<void> {
    this.seguro.set(false);
    await this.ejecutar(async () => this.conteo.set(await this.puertos.plan.conteoBorrado(this.ref()!)));
  }

  protected async borrarPlan(): Promise<void> {
    await this.ejecutar(async () => {
      await this.puertos.plan.borrarPlan(this.ref()!);
      this.conteo.set(null);
      this.elegida.set(null);
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
