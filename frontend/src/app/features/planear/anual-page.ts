import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMiles, nombreMesCapital, type FilaAnualVista, type TipoEvento } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Anual.dc.html (web): 12 meses por categoria, fijos llenos solos, eventos del año, aportes proyectados tenues
 * y KPI. "Crear meses desde este plan" crea cada mes en Borrador con su columna como Opcion A.
 */
@Component({
  selector: 'app-anual-page',
  imports: [RouterLink, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6 px-5 pt-6 pb-4 lg:px-10 lg:pt-8' },
  template: `
    @if (resumen.value(); as r) {
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <a routerLink="/planear" class="boton-texto -my-2 self-start text-sm font-normal">‹ Planear</a>
          <span class="rotulo" [class.text-aviso]="r.estado === 'BORRADOR'">{{ r.estado === 'BORRADOR' ? 'Borrador' : 'Meses creados' }}</span>
          <h1 class="text-[28px] font-bold">Plan anual {{ r.anio }}</h1>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="boton h-10 rounded-control border border-control bg-superficie text-sm" [attr.aria-expanded]="formulario()" (click)="formulario.set(!formulario())">+ Evento del año</button>
          @if (r.estado === 'BORRADOR') {
            <button type="button" class="boton h-10 rounded-control bg-acento text-sm text-white" (click)="crearMeses()">Crear meses desde este plan</button>
          }
        </div>
      </div>

      @if (formulario()) {
        <form class="tarjeta grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4" (submit)="$event.preventDefault(); agregarEvento()" aria-label="Nuevo evento del año">
          <label class="flex flex-col gap-2">
            <span class="rotulo">Evento</span>
            <input class="h-12 rounded-xl border border-borde bg-fondo px-3 text-[15px] focus:border-acento focus:outline-none" placeholder="Ej: SOAT" [value]="evNombre()" (input)="evNombre.set($any($event.target).value)" />
          </label>
          <label class="flex flex-col gap-2">
            <span class="rotulo">Mes</span>
            <select class="h-12 rounded-xl border border-borde bg-fondo px-3 text-[15px] focus:border-acento focus:outline-none" [value]="evMes()" (change)="evMes.set(+$any($event.target).value)">
              @for (m of meses; track m) {
                <option [value]="m">{{ nombre(m) }}</option>
              }
            </select>
          </label>
          <app-monto-input etiqueta="Monto" [(valor)]="evMonto" />
          <app-segmentado etiqueta="Tipo" [opciones]="tipos" [(valor)]="evTipo" />
          <div class="flex gap-2 lg:col-span-4">
            <button type="submit" class="boton-primario" [disabled]="!evNombre().trim() || !evMonto()">Agregar evento</button>
            <button type="button" class="boton-secundario" (click)="formulario.set(false)">Cancelar</button>
          </div>
        </form>
      }

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="tarjeta flex flex-col gap-1 px-5 py-4">
          <span class="text-xs text-secundario">Libre proyectado en el año</span>
          <app-monto class="text-[22px] font-semibold text-acento" [valor]="r.kpis.libreAnio" data-testid="kpi-libre" />
        </div>
        <div class="tarjeta flex flex-col gap-1 px-5 py-4">
          <span class="text-xs text-secundario">Mes más apretado</span>
          <span class="text-lg font-semibold">{{ nombre(r.kpis.mesApretado.mes) }} · <app-monto class="text-negativo" [valor]="r.kpis.mesApretado.libre" /></span>
        </div>
        <div class="tarjeta flex flex-col gap-1 px-5 py-4">
          <span class="text-xs text-secundario">Diezmo del año (calculado)</span>
          <app-monto class="text-[22px] font-semibold" [valor]="r.kpis.diezmoAnio" />
        </div>
      </div>

      <div class="overflow-x-auto rounded-[14px] border border-borde bg-superficie" tabindex="0" role="region" aria-label="Plan anual por mes">
        <table class="w-full min-w-[1100px] border-collapse font-mono text-xs" data-testid="tabla-anual">
          <thead>
            <tr class="border-b border-borde font-sans text-xs font-semibold text-secundario">
              <th scope="col" class="w-[190px] px-4 py-3 text-left">Miles de pesos</th>
              @for (m of meses; track m) {
                <th scope="col" class="px-1 py-3 text-right">{{ nombre(m).slice(0, 3) }}</th>
              }
            </tr>
          </thead>
          <tbody>
            <tr><th colspan="13" scope="colgroup" class="px-4 pt-1.5 text-left font-sans text-[11px] font-semibold tracking-[0.08em] text-positivo">INGRESOS</th></tr>
            @for (f of r.ingresos; track f.clave) {
              <tr class="border-b border-divisor" [class.italic]="f.tenue" [class.text-[#7A7D76]]="f.tenue">
                <th scope="row" class="px-4 py-2.5 text-left font-sans text-[13px] font-normal">{{ f.nombre }}@if (f.detalle) {<span class="block text-[11px] not-italic">{{ f.detalle }}</span>}</th>
                @for (v of f.valores; track $index) {
                  <td class="px-1 py-2.5 text-right" [class.font-semibold]="destacar(f, v)">{{ celda(v) }}</td>
                }
              </tr>
            }
            <tr><th colspan="13" scope="colgroup" class="px-4 pt-3.5 text-left font-sans text-[11px] font-semibold tracking-[0.08em] text-negativo">GASTOS</th></tr>
            @for (f of gastos(); track f.clave) {
              <tr class="border-b border-divisor" [class.text-secundario]="f.calculado" [class.bg-[#FBF7EC]]="f.clave === 'eventos'">
                <th scope="row" class="px-4 py-2.5 text-left font-sans text-[13px] font-normal">{{ f.nombre }}@if (f.detalle) {<span class="block text-[11px] text-secundario">{{ f.detalle }}</span>}</th>
                @for (v of f.valores; track $index) {
                  <td class="px-1 py-2.5 text-right" [class.font-semibold]="destacar(f, v)">{{ celda(v) }}</td>
                }
              </tr>
            }
            <tr class="text-[13px] font-semibold text-acento">
              <th scope="row" class="px-4 py-3.5 text-left font-sans text-sm font-semibold text-texto">Queda libre</th>
              @for (v of r.libre; track $index; let i = $index) {
                <td class="px-1 py-3.5 text-right" [class.text-negativo]="i + 1 === r.kpis.mesApretado.mes">{{ celda(v) }}</td>
              }
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-[13px] text-secundario">Cada mes nace de su columna como "Opción A". Los cambios en un mes no modifican el plan anual; el anual se actualiza solo con el cierre de cada mes.</p>
      @if (mensaje()) {
        <p role="status" class="text-sm text-positivo">{{ mensaje() }}</p>
      }
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    } @else if (!resumen.isLoading()) {
      <a routerLink="/planear" class="boton-texto self-start">‹ Planear</a>
      <p class="text-secundario">No hay plan anual para {{ anio() }}.</p>
    }
  `,
})
export class AnualPage {
  private readonly puertos = inject(PUERTOS);

  /** Parametro de la ruta (`/planear/anual/:anio`). */
  readonly anio = input.required<string>();
  protected readonly resumen = consulta(() => Number(this.anio()), (p, anio) => p.plan.anual(anio));
  protected readonly meses = MESES;
  protected readonly tipos: Opcion<TipoEvento>[] = [
    { valor: 'GASTO', etiqueta: 'Gasto' },
    { valor: 'INGRESO', etiqueta: 'Ingreso' },
  ];

  protected readonly gastos = computed<FilaAnualVista[]>(() => {
    const r = this.resumen.value();
    return r ? [...r.gastos, r.diezmo, ...(r.eventos ? [r.eventos] : [])] : [];
  });

  protected readonly formulario = signal(false);
  protected readonly evNombre = signal('');
  protected readonly evMes = signal(1);
  protected readonly evMonto = signal<number | null>(null);
  protected readonly evTipo = signal<TipoEvento | null>('GASTO');
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  protected nombre(mes: number): string {
    return nombreMesCapital(mes);
  }

  protected celda(v: number): string {
    return v ? formatMiles(v) : '';
  }

  /** Lo que se sale de lo comun en su fila (primas, eventos, el diciembre de variables) va en negrilla. */
  protected destacar(f: FilaAnualVista, v: number): boolean {
    if (!v) return false;
    const conteo = f.valores.filter((x) => x === v).length;
    return conteo < 6;
  }

  protected async agregarEvento(): Promise<void> {
    await this.ejecutar(async () => {
      await this.puertos.plan.agregarEvento(Number(this.anio()), { nombre: this.evNombre(), mes: this.evMes(), monto: this.evMonto()!, tipo: this.evTipo() ?? 'GASTO', usuarioId: null });
      this.formulario.set(false);
      this.evNombre.set('');
      this.evMonto.set(null);
    });
  }

  protected async crearMeses(): Promise<void> {
    await this.ejecutar(async () => {
      await this.puertos.plan.crearMesesDesdeAnual(Number(this.anio()));
      this.mensaje.set(`Los 12 meses de ${this.anio()} quedaron en borrador, cada uno con su Opción A.`);
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await accion();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }
}
