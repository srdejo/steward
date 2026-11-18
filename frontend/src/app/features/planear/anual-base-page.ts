import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  formatMesAnio, nombreMes, type BaseAnual, type Categoria, type FilaMesBase, type Id, type ItemPlan, type Pesos, type TipoItem,
} from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { NuevaOpcionHoja } from './nueva-opcion-hoja';

/** El tipo de un gasto nuevo sale de su categoria (design D6 de plan-mes-siguiente). */
function tipoDe(c: Categoria | undefined): TipoItem {
  return c?.tipo === 'VARIABLE' ? 'VARIABLE' : c?.tipo === 'CREDITO' ? 'CREDITO' : 'FIJO';
}

/**
 * El mes base editable de una opcion del año (AnualMesBaseWeb, design D4 de anual-mes-base-editable): los gastos por
 * categoria con su monto editable en la celda, agregar y quitar, lo que queda libre y "Usar este mes en los 12 meses".
 * Solo web; con menos de 1024 px se ve en una columna.
 */
@Component({
  selector: 'app-anual-base-page',
  imports: [RouterLink, Hoja, Monto, MontoInput, NuevaOpcionHoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5 px-5 pt-6 pb-10 lg:mx-auto lg:w-full lg:max-w-[1360px] lg:px-9', 'data-testid': 'mes-base' },
  template: `
    <a [routerLink]="['/planear/anual', anio()]" [queryParams]="{ opcion: opcion() ?? null }" class="boton-texto -my-2 self-start text-sm font-normal">‹ Plan {{ anio() }}</a>
    @if (vista.value(); as v) {
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="rotulo text-aviso">Plan {{ anio() }} · Opción {{ v.opcion.letra }} · paso 1 de 2</span>
          <h1 class="titular text-[26px] font-bold lg:text-[28px]">Mes base de la Opción {{ v.opcion.letra }}</h1>
          <p class="text-sm text-secundario">{{ v.origen ? 'Copiado de ' + mesAnio(v.origen) + '.' : 'Empieza vacío.' }} Ajusta lo que va a ser igual todos los meses; lo que cambia en un mes va después.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="boton-secundario h-10 rounded-control px-3.5 text-sm" (click)="copiando.set(true)">Copiar otro mes</button>
          <button type="button" class="boton-primario h-10 rounded-control px-4 text-sm" [disabled]="guardando()" (click)="usar(v.opcion.id)">Usar este mes en los 12 meses</button>
        </div>
      </div>

      <div class="flex flex-wrap items-start gap-5">
        <section aria-label="Mes base" class="min-w-0 flex-[3_1_600px] overflow-x-auto rounded-tarjeta bg-superficie">
          <div class="min-w-[560px]">
            <div class="fila-base border-b border-borde bg-fondo py-2.5 text-[11px] font-semibold tracking-[0.06em] text-secundario">
              <span></span><span>DÍA</span><span class="text-right">CADA MES</span><span></span>
            </div>
            @for (g of v.grupos; track g.categoriaId) {
              <div class="fila-base border-b border-divisor bg-[#FCFCFA] py-2.5" [attr.data-grupo]="g.nombre">
                <span class="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-[#4A4E48] uppercase"><span class="h-2 w-2 rounded-[2px]" [style.background]="g.color" aria-hidden="true"></span>{{ g.nombre }}</span>
                <span></span>
                <app-monto class="text-right text-[13px] font-semibold" [valor]="g.total" />
                <span></span>
              </div>
              @for (f of g.filas; track f.item.id) {
                <div class="fila-base border-b border-[#F0EEE9] py-1.5" [attr.data-fila]="f.item.nombre">
                  <span class="flex min-w-0 flex-col gap-0.5 pl-4">
                    <span class="flex items-center gap-1.5 text-sm">{{ f.item.nombre }}
                      @if (f.terminaEn) {
                        <span class="rounded-lg bg-acento-suave px-[7px] py-0.5 text-[10px] font-semibold text-acento-oscuro">Termina {{ mesCorto(f.terminaEn) }}</span>
                      }
                    </span>
                    <span class="text-xs text-secundario">{{ f.detalle }}</span>
                  </span>
                  <span class="text-[13px] text-[#4A4E48]">{{ f.item.diaVence ?? '' }}</span>
                  <app-monto-input [compacto]="true" [valor]="f.item.monto" [etiquetaAccesible]="f.item.nombre + ' cada mes'" (confirmado)="guardarMonto(v.opcion.id, f, $event)" />
                  <button type="button" class="size-8 rounded-lg text-lg text-[#7A7D76] hover:bg-fondo" [attr.aria-label]="'Quitar ' + f.item.nombre" (click)="quitar(v.opcion.id, f.item)">×</button>
                </div>
              }
              <div class="border-b border-divisor py-1.5 pr-5 pl-9">
                <button type="button" class="h-[30px] text-[13px] font-medium text-acento hover:text-acento-oscuro" (click)="agregarEn.set(g.categoriaId)">+ Agregar a {{ g.nombre }}</button>
              </div>
            }
          </div>
        </section>

        <aside class="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
          <section class="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-[18px]" data-testid="resumen-base">
            <span class="rotulo">Con este mes base</span>
            <div class="flex justify-between text-sm"><span>Entra cada mes</span><app-monto class="text-positivo" [valor]="v.entra" /></div>
            <div class="flex justify-between text-sm"><span>Sale cada mes</span><app-monto [valor]="v.sale" /></div>
            <div class="flex justify-between text-sm"><span>Diezmo</span><app-monto [valor]="v.diezmo" /></div>
            <div class="flex items-baseline justify-between border-t border-divisor pt-2.5">
              <span class="text-sm font-semibold">Queda libre al mes</span>
              <app-monto class="text-xl font-semibold" [class.text-acento]="v.libreMes >= 0" [class.text-negativo]="v.libreMes < 0" [valor]="v.libreMes" data-testid="libre-mes" />
            </div>
            <span class="text-xs leading-[1.45] text-secundario">En el año ≈ <app-monto [valor]="v.libreAnio" />{{ terminan(v.grupos) }}</span>
          </section>
          <section class="flex flex-col gap-1.5 rounded-[14px] bg-nota p-4 text-[13px] leading-[1.45] text-[#4A4E48]">
            <span class="font-semibold">Cómo sigue</span>
            <span>1. Ajusta este mes: lo que vale igual todos los meses.</span>
            <span>2. "Usar este mes en los 12 meses" llena la Opción {{ v.opcion.letra }}.</span>
            <span>3. En el año agregas lo que es distinto en un mes.</span>
            <span>4. "Meses con la Opción {{ v.opcion.letra }}" lleva el plan a los meses.</span>
          </section>
          @if (v.origen) {
            <span class="text-xs text-secundario">Los cambios aquí no tocan {{ mesAnio(v.origen) }}: este mes base es solo de la Opción {{ v.opcion.letra }}.</span>
          }
        </aside>
      </div>

      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }

      @if (agregarEn(); as categoriaId) {
        <app-hoja [titulo]="'Agregar a ' + nombreCategoria(categoriaId)" [antetitulo]="'Mes base · Opción ' + v.opcion.letra" (cerrar)="agregarEn.set(null)">
          <label class="flex flex-col gap-2">
            <span class="rotulo">Nombre</span>
            <input class="campo" placeholder="Ej: Gimnasio" [value]="nombreNuevo()" (input)="nombreNuevo.set($any($event.target).value)" />
          </label>
          <app-monto-input etiqueta="Cada mes" [(valor)]="montoNuevo" />
          <label class="flex flex-col gap-2">
            <span class="rotulo">Día · Opcional</span>
            <input class="campo" inputmode="numeric" placeholder="Ej: 15" [value]="diaNuevo()" (input)="diaNuevo.set($any($event.target).value)" />
          </label>
          <button type="button" class="boton-grande" [disabled]="guardando() || !nombreNuevo().trim() || montoNuevo() === null" (click)="agregar(v.opcion.id, categoriaId)">Agregar</button>
        </app-hoja>
      }
      @if (copiando()) {
        <app-nueva-opcion-hoja [anio]="anioNum()" [letra]="v.opcion.letra" modo="COPIAR" [accion]="copiar(v.opcion.id)" (cerrar)="copiando.set(false)" />
      }
    } @else if (!vista.isLoading()) {
      <p class="text-secundario">Ese año no tiene plan.</p>
    }
  `,
  styles: `
    .fila-base { display: grid; grid-template-columns: minmax(230px, 2fr) 70px 140px 44px; gap: 12px; align-items: center; padding-inline: 20px; }
  `,
})
export class AnualBasePage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);

  /** Parametro de la ruta (`/planear/anual/:anio/base`). */
  readonly anio = input.required<string>();
  /** `?opcion=C`: la opcion; sin ella, la en uso o la A. */
  readonly opcion = input<string>();

  protected readonly anioNum = computed(() => Number(this.anio()));
  private readonly resumen = consulta(() => Number(this.anio()), (p, anio) => p.plan.anual(anio));
  private readonly opcionId = computed<Id | null>(() => this.resumen.value()?.opciones.find((o) => o.letra === this.opcion())?.id ?? null);
  protected readonly vista = consulta(() => (this.resumen.value() ? { anio: Number(this.anio()), opcion: this.opcionId() } : null),
    (p, x) => (x ? p.plan.vistaMesBase(x.anio, x.opcion) : Promise.resolve(null)));
  private readonly categorias = consulta(() => null, (p) => p.hogar.categorias());

  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly copiando = signal(false);
  protected readonly agregarEn = signal<Id | null>(null);
  protected readonly nombreNuevo = signal('');
  protected readonly montoNuevo = signal<number | null>(null);
  protected readonly diaNuevo = signal('');

  protected mesAnio(ref: { anio: number; mes: number }): string {
    return formatMesAnio(ref).toLowerCase();
  }

  protected mesCorto(mes: number): string {
    return nombreMes(mes).slice(0, 3);
  }

  protected nombreCategoria(id: Id): string {
    return this.categorias.value()?.find((c) => c.id === id)?.nombre ?? '';
  }

  /** ". La compra a cuotas termina en junio: desde julio quedan $375.000 más." */
  protected terminan(grupos: { filas: FilaMesBase[] }[]): string {
    const filas = grupos.flatMap((g) => g.filas).filter((f) => f.terminaEn);
    if (!filas.length) return '.';
    return '. ' + filas.map((f) => `${f.item.nombre} termina en ${nombreMes(f.terminaEn!)}`).join('; ') + '.';
  }

  protected async guardarMonto(opcionId: Id, f: FilaMesBase, monto: Pesos | null): Promise<void> {
    if (monto === null || monto === f.item.monto) return;
    await this.ejecutar(() => this.puertos.plan.guardarItemBase(Number(this.anio()), opcionId, { ...f.item, monto }));
  }

  protected async quitar(opcionId: Id, item: ItemPlan): Promise<void> {
    await this.ejecutar(() => this.puertos.plan.quitarItemBase(Number(this.anio()), opcionId, item.id));
  }

  protected async agregar(opcionId: Id, categoriaId: Id): Promise<void> {
    const c = this.categorias.value()?.find((x) => x.id === categoriaId);
    const dia = Number(this.diaNuevo());
    await this.ejecutar(async () => {
      await this.puertos.plan.guardarItemBase(Number(this.anio()), opcionId, {
        categoriaId, nombre: this.nombreNuevo().trim(), monto: this.montoNuevo()!, diaVence: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null,
        tipo: tipoDe(c), cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false,
      });
      this.agregarEn.set(null);
      this.nombreNuevo.set('');
      this.montoNuevo.set(null);
      this.diaNuevo.set('');
    });
  }

  /** "Copiar otro mes": la hoja llama esto con la fuente elegida. */
  protected copiar(opcionId: Id): (base: BaseAnual) => Promise<void> {
    return async (base) => {
      await this.puertos.plan.copiarMesBase(Number(this.anio()), opcionId, base);
      this.copiando.set(false);
    };
  }

  /** "Usar este mes en los 12 meses": llena la opcion y vuelve al año con ella elegida. */
  protected async usar(opcionId: Id): Promise<void> {
    this.guardando.set(true);
    await this.ejecutar(async () => {
      await this.puertos.plan.usarMesBase(Number(this.anio()), opcionId);
      const letra = this.vista.value()?.opcion.letra;
      await this.router.navigate(['/planear/anual', this.anio()], { queryParams: { opcion: letra ?? null } });
    });
    this.guardando.set(false);
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
