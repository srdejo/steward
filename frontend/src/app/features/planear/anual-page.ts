import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  claveMes, formatCop, formatMesAnio, formatMiles, mesDe, nombreMeses, nombreMesCapital,
  type BaseAnual, type EventoAnual, type FilaAnualVista, type Id, type MesesAnualVista, type OpcionAnualVista, type ResumenAnual, type ResumenMesPlan, type VistaCambio,
} from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { anchoEscritorio } from '../../shared/escritorio';
import { CambioHoja } from './cambio-hoja';
import { MesesAnualHoja } from './meses-anual-hoja';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

/** Una opcion del paso 1: un mes con plan, solo fijos o desde cero. */
interface OpcionBase {
  clave: string;
  titulo: string;
  detalle: string;
  base: BaseAnual;
}

/**
 * Planear el año desde un mes (spec steward-planear, "Plan anual"; AnualBase, AnualCambios y AnualMesesMovil del canvas).
 * Paso 1: el mes base y "Replicar en los 12 meses". Paso 2: lo que cambia, en tabla desde 1024 px o en lista de meses.
 * Con opciones A, B, ... (AnualOpcionesWeb y AnualOpcionesMovil, design D5 de anual-opciones-y-meses): pestañas o chips,
 * lo distinto de la A marcado, "Las dos opciones, mes a mes" y "Meses con la Opción X".
 */
@Component({
  selector: 'app-anual-page',
  imports: [RouterLink, CambioHoja, Hoja, MesesAnualHoja, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6 px-5 pt-6 pb-4 lg:mx-auto lg:w-full lg:max-w-[1192px] lg:px-10 lg:pt-8' },
  template: `
    @if (pasoBase()) {
      <a [routerLink]="resumen.value() ? ['/planear/anual', anio()] : '/planear'" class="boton-texto -my-2 self-start text-sm font-normal">{{ resumen.value() ? '‹ Lo que cambia' : '‹ Plan' }}</a>
      <div class="flex flex-col gap-1">
        <span class="rotulo">Paso 1 de 2 · Año {{ anio() }}</span>
        <h1 class="text-[26px] font-bold lg:text-[28px]">¿De qué mes parte {{ anio() }}?</h1>
        <p class="text-sm text-secundario">Ese mes se copia en cada mes del año. Después agregas solo lo que cambia.</p>
      </div>
      @if (!puedeCrear()) {
        <p class="text-secundario">{{ anio() }} ya pasó: no se puede planear.</p>
      } @else {
        <div class="flex flex-wrap items-start gap-6">
          <fieldset class="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5">
            <legend class="rotulo pb-2.5">Mes base</legend>
            @for (o of opcionesBase(); track o.clave) {
              <label class="flex cursor-pointer items-start gap-3 rounded-[14px] border bg-superficie p-4" [class.border-2]="o.clave === elegida()" [class.border-acento]="o.clave === elegida()" [class.bg-acento-suave]="o.clave === elegida()" [class.border-borde]="o.clave !== elegida()">
                <input type="radio" name="base" class="mt-0.5 size-[18px] accent-acento" [checked]="o.clave === elegida()" (change)="elegidaSetter(o.clave)" />
                <span class="flex flex-col gap-1">
                  <span class="text-base font-semibold">{{ o.titulo }}</span>
                  <span class="text-[13px] text-secundario">{{ o.detalle }}</span>
                </span>
              </label>
            }
            <p class="pt-1.5 text-xs text-secundario">Se copia en los 12 meses. Al crear los meses, los que ya tienen plan no cambian.</p>
          </fieldset>

          @if (vista.value(); as v) {
            <section class="tarjeta flex min-w-0 flex-[1_1_340px] flex-col gap-3 p-5" aria-labelledby="queda-cada-mes" data-testid="vista-base">
              <h2 id="queda-cada-mes" class="text-base font-semibold">Así queda cada mes de {{ anio() }}</h2>
              <span class="pt-1 text-[11px] font-semibold tracking-[0.08em] text-positivo">INGRESOS</span>
              @for (i of v.ingresos; track i.nombre) {
                <div class="flex justify-between text-sm"><span>{{ i.nombre }}</span><app-monto [valor]="i.monto" /></div>
              }
              @for (a of v.aportes; track a.usuarioId) {
                <div class="flex justify-between text-sm text-[#7A7D76] italic"><span>{{ a.nombre }} · proyectado</span><app-monto [valor]="a.monto" /></div>
              }
              <span class="pt-2 text-[11px] font-semibold tracking-[0.08em] text-negativo">GASTOS</span>
              @for (f of v.filas; track f.categoriaId) {
                @if (f.monto) {
                  <div class="flex justify-between text-sm"><span>{{ f.nombre }} <span class="text-secundario">· {{ f.items }}</span></span><app-monto [valor]="f.monto" /></div>
                }
              }
              <div class="flex justify-between text-sm text-secundario"><span>Diezmo · calculado</span><app-monto [valor]="v.diezmo" /></div>
              <div class="mt-1 flex items-baseline justify-between border-t border-borde pt-3">
                <span class="text-sm font-semibold">Queda libre cada mes</span>
                <app-monto class="text-lg font-semibold" [class.text-acento]="v.libreMes >= 0" [class.text-negativo]="v.libreMes < 0" [valor]="v.libreMes" data-testid="libre-mes-base" />
              </div>
              <div class="flex justify-between text-[13px] text-secundario"><span>En el año, antes de lo que cambia</span><app-monto [valor]="v.libreAnio" /></div>
            </section>
          }
        </div>

        @if (confirmando()) {
          <p role="alert" class="rounded-xl bg-aviso-suave px-4 py-3 text-sm text-aviso">Se reemplazan los montos de los 12 meses; lo que cambia se conserva.</p>
        }
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <div class="flex flex-wrap justify-end gap-2 border-t border-borde pt-5">
          <a [routerLink]="resumen.value() ? ['/planear/anual', anio()] : '/planear'" class="boton-secundario">Cancelar</a>
          <button type="button" class="boton-primario" [disabled]="!inicio.value() || !elegida() || ocupado()" (click)="replicar()">{{ confirmando() ? 'Sí, reemplazar' : 'Replicar en los 12 meses' }}</button>
        </div>
      }
    } @else if (resumen.value(); as r) {
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <a routerLink="/planear" class="boton-texto -my-2 self-start text-sm font-normal">‹ Plan</a>
          <span class="rotulo" [class.text-aviso]="r.estado === 'BORRADOR'">{{ rotulo(r) }}</span>
          <h1 class="text-[26px] font-bold lg:text-[28px]">Plan {{ r.anio }}{{ r.opciones.length > 1 ? '' : ': lo que cambia' }}</h1>
          <p class="text-sm text-secundario">{{ r.base ? 'La Opción ' + r.opcion.letra + ' es copia de ' + mesAnio(r.base) + '.' : 'Los montos de cada mes.' }} {{ escritorio() ? 'Agrega lo que es distinto en un mes.' : 'Toca un mes para agregar algo distinto.' }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          @if (r.estado === 'BORRADOR') {
            <a [routerLink]="['/planear/anual', anio()]" [queryParams]="{ paso: 'base' }" class="boton-texto self-center text-sm">Cambiar mes base</a>
          }
          <button type="button" class="boton h-10 rounded-control border border-control bg-superficie text-sm" (click)="abrirCambio(null, 1)">+ Algo distinto en un mes</button>
          <button type="button" class="boton h-10 rounded-control bg-acento text-sm text-white" [disabled]="ocupado()" (click)="hojaMeses.set(true)">Meses con la Opción {{ r.opcion.letra }}</button>
        </div>
      </div>

      <div role="tablist" aria-label="Opciones del año" class="flex flex-wrap items-center gap-2" data-testid="opciones-anual">
        @for (o of r.opciones; track o.id) {
          <button type="button" role="tab" [attr.aria-selected]="o.id === r.opcion.id" (click)="elegir(o)"
            class="flex flex-col items-start justify-center gap-px rounded-xl px-4 text-left"
            [class]="(o.id === r.opcion.id ? 'bg-acento text-white' : 'border border-borde-campo bg-superficie') + (escritorio() ? ' h-[52px]' : ' h-9 rounded-full')">
            <span class="text-sm font-semibold">Opción {{ o.letra }}{{ autor(o) }}</span>
            @if (escritorio() && (o.nota || o.enUso)) {
              <span class="text-xs opacity-80">{{ o.enUso ? 'En uso' + (o.nota ? ' · ' + o.nota : '') : o.nota }}</span>
            }
          </button>
        }
        <button type="button" class="boton rounded-xl border border-dashed border-control bg-transparent px-3.5 text-sm font-medium" [class]="escritorio() ? 'h-[52px]' : 'h-9 rounded-full'" [disabled]="ocupado()" (click)="duplicar(r)">+ Duplicar Opción {{ r.opcion.letra }}</button>
        @if (r.opciones.length > 1 && !opcionEnUso(r)) {
          <button type="button" class="boton-texto text-sm font-normal text-negativo" (click)="quitandoOpcion.set(true)">Quitar opción {{ r.opcion.letra }}</button>
        }
      </div>
      @if (quitandoOpcion()) {
        <div class="flex flex-col gap-3 rounded-xl bg-aviso-suave px-4 py-3" role="alert" data-testid="confirmar-quitar-opcion">
          <p class="text-sm text-aviso">Se borran las celdas y los cambios de la Opción {{ r.opcion.letra }}. Las demás opciones y los meses no cambian.</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="boton h-10 rounded-control bg-negativo text-sm text-white" [disabled]="ocupado()" (click)="quitarOpcion(r)">Sí, quitar la Opción {{ r.opcion.letra }}</button>
            <button type="button" class="boton-secundario" (click)="quitandoOpcion.set(false)">Cancelar</button>
          </div>
        </div>
      }

      <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <div class="tarjeta flex flex-col gap-1 px-5 py-4">
          <span class="text-xs text-secundario">Libre proyectado en el año</span>
          <app-monto class="text-[22px] font-semibold text-acento" [valor]="r.kpis.libreAnio" data-testid="kpi-libre" />
          @if (frenteA(r); as d) {
            <span class="text-xs" [class.text-negativo]="d < 0" [class.text-positivo]="d > 0" data-testid="frente-a">{{ conSigno(d) }} frente a la Opción A</span>
          } @else if (r.kpis.porCambios) {
            <span class="text-xs text-secundario" data-testid="por-cambios">{{ conSigno(r.kpis.porCambios) }} por lo que cambia</span>
          }
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

      @if (escritorio()) {
        <div class="flex flex-wrap items-center gap-[18px] text-xs text-secundario">
          <span class="flex items-center gap-1.5"><span class="size-3.5 rounded border border-borde bg-superficie"></span>Igual al mes base</span>
          <span class="flex items-center gap-1.5"><span class="size-3.5 rounded bg-[#F6E7C1]"></span>Cambia ese mes</span>
          @if (filasA()) {
            <span class="flex items-center gap-1.5"><span class="size-3.5 rounded bg-superficie shadow-[inset_0_0_0_2px_#3C64A8]"></span>Distinto de la Opción A</span>
          }
          <span>Toca una celda para cambiar solo ese mes en la Opción {{ r.opcion.letra }}.</span>
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
                  @for (v of f.valores; track $index; let i = $index) {
                    <td class="px-1 py-2.5 text-right" [class.bg-[#F6E7C1]]="f.cambia[i]" [class.font-semibold]="f.cambia[i] || distintoDeA(f, i)" [class.shadow-[inset_0_0_0_2px_#3C64A8]]="distintoDeA(f, i)" [attr.data-cambia]="f.cambia[i] || null" [attr.data-distinto]="distintoDeA(f, i) || null">
                      @if (editable(f)) {
                        <button type="button" class="w-full text-right hover:text-acento" [attr.aria-label]="f.nombre + ' · ' + nombre(i + 1)" (click)="abrirCelda(f, i + 1, v)">{{ celda(v) }}</button>
                      } @else {
                        {{ celda(v) }}
                      }
                    </td>
                  }
                </tr>
              }
              <tr><th colspan="13" scope="colgroup" class="px-4 pt-3.5 text-left font-sans text-[11px] font-semibold tracking-[0.08em] text-negativo">GASTOS</th></tr>
              @for (f of gastos(); track f.clave) {
                <tr class="border-b border-divisor" [class.text-secundario]="f.calculado">
                  <th scope="row" class="px-4 py-2.5 text-left font-sans text-[13px] font-normal">{{ f.nombre }}@if (f.detalle) {<span class="block text-[11px] text-secundario">{{ f.detalle }}</span>}</th>
                  @for (v of f.valores; track $index; let i = $index) {
                    <td class="px-1 py-2.5 text-right" [class.bg-[#F6E7C1]]="f.cambia[i]" [class.font-semibold]="f.cambia[i] || distintoDeA(f, i)" [class.shadow-[inset_0_0_0_2px_#3C64A8]]="distintoDeA(f, i)" [attr.data-cambia]="f.cambia[i] || null" [attr.data-distinto]="distintoDeA(f, i) || null">
                      @if (editable(f)) {
                        <button type="button" class="w-full text-right hover:text-acento" [attr.aria-label]="f.nombre + ' · ' + nombre(i + 1)" (click)="abrirCelda(f, i + 1, v)">{{ celda(v) }}</button>
                      } @else {
                        {{ celda(v) }}
                      }
                    </td>
                  }
                </tr>
              }
              <tr class="text-[13px] font-semibold text-acento">
                <th scope="row" class="px-4 py-3.5 text-left font-sans text-sm font-semibold text-texto">Queda libre</th>
                @for (v of r.libre; track $index; let i = $index) {
                  <td class="px-1 py-3.5 text-right" [class.text-negativo]="i + 1 === r.kpis.mesApretado.mes || v < 0">{{ celda(v) }}</td>
                }
              </tr>
            </tbody>
          </table>
        </div>
        @if (filasA()) {
          <section aria-labelledby="mes-a-mes" class="overflow-hidden rounded-[14px] border border-borde bg-superficie" data-testid="mes-a-mes">
            <div class="flex items-baseline justify-between gap-3 border-b border-divisor px-5 py-4">
              <h2 id="mes-a-mes" class="text-base font-semibold">Las dos opciones, mes a mes</h2>
              <span class="text-xs text-secundario">Lo que dejaría libre cada mes</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[760px] border-collapse font-mono text-xs">
                <thead>
                  <tr class="bg-fondo font-sans text-[11px] font-semibold text-secundario">
                    <th scope="col" class="w-[110px] px-5 py-2.5 text-left"><span class="sr-only">Opción</span></th>
                    @for (m of meses; track m) {
                      <th scope="col" class="px-1 py-2.5 text-right">{{ nombre(m).slice(0, 3).toUpperCase() }}</th>
                    }
                    <th scope="col" class="px-5 py-2.5 text-right">AÑO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-t border-[#F1F0EB]" data-fila="A">
                    <th scope="row" class="px-5 py-2.5 text-left font-sans text-[13px] font-semibold">Opción A</th>
                    @for (v of r.libreA; track $index) {
                      <td class="px-1 py-2.5 text-right" [class.text-negativo]="v < 0">{{ celda(v) }}</td>
                    }
                    <td class="px-5 py-2.5 text-right font-semibold">{{ celda(suma(r.libreA)) }}</td>
                  </tr>
                  <tr class="border-t border-[#F1F0EB]" [attr.data-fila]="r.opcion.letra">
                    <th scope="row" class="px-5 py-2.5 text-left font-sans text-[13px] font-semibold">Opción {{ r.opcion.letra }}</th>
                    @for (v of r.libre; track $index; let i = $index) {
                      <td class="px-1 py-2.5 text-right" [class.font-semibold]="v !== r.libreA[i]" [class.text-negativo]="v < r.libreA[i]! || v < 0" [class.text-positivo]="v > r.libreA[i]!">{{ celda(v) }}</td>
                    }
                    <td class="px-5 py-2.5 text-right font-semibold">{{ celda(r.kpis.libreAnio) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        }
      } @else {
        <section aria-labelledby="los-meses" class="flex flex-col" data-testid="lista-meses">
          <h2 id="los-meses" class="sr-only">Los 12 meses</h2>
          @for (m of r.meses; track m.desde) {
            <button type="button" class="flex items-center justify-between gap-3 border-b border-divisor py-3 text-left last:border-b-0 tocable" (click)="abrirCambio(null, m.desde)">
              <span class="flex min-w-0 flex-col gap-0.5">
                <span class="text-[15px] font-medium">{{ nombreGrupo(m) }}</span>
                <span class="text-xs" [class.text-aviso]="m.cambios.length" [class.text-secundario]="!m.cambios.length">{{ m.cambios.length ? m.cambios.join(' · ') : igualTexto(m) }}</span>
              </span>
              <span class="flex shrink-0 flex-col items-end gap-0.5">
                <app-monto class="text-sm" [class.font-semibold]="m.cambios.length" [class.text-negativo]="apretado(m) || m.libre < 0" [valor]="m.libre" />
                @if (vsA(r, m); as d) {
                  <span class="monto text-[11px]" [class.text-negativo]="d < 0" [class.text-positivo]="d > 0" data-testid="vs-a">{{ conSigno(d) }} vs A</span>
                }
              </span>
            </button>
          }
        </section>
      }

      <section aria-labelledby="lo-que-cambia" class="flex flex-col gap-1" data-testid="lo-que-cambia">
        <h2 id="lo-que-cambia" class="rotulo pb-1.5">Lo que cambia{{ r.opciones.length > 1 ? ' en la Opción ' + r.opcion.letra : '' }} · {{ r.cambios.length }}</h2>
        @if (!r.cambios.length) {
          <p class="text-sm text-secundario">Nada todavía: todos los meses son iguales al mes base.</p>
        }
        @for (c of r.cambios; track c.evento.id) {
          <button type="button" class="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-divisor py-2.5 text-left last:border-b-0 tocable" (click)="abrirCambio(c.evento, c.evento.mes)">
            <span class="text-[13px] font-semibold text-secundario">{{ nombre(c.evento.mes).slice(0, 3) }}</span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="text-sm font-medium">{{ c.evento.nombre }}</span>
              <span class="text-xs text-secundario">{{ detalleCambio(c) }}</span>
            </span>
            <span class="monto text-[13px]" [class.text-positivo]="c.evento.tipo === 'INGRESO'">{{ montoCambio(c) }}</span>
          </button>
        }
      </section>
      <p class="text-[13px] text-secundario">"Meses con la Opción {{ r.opcion.letra }}" crea los meses sin plan con su columna y actualiza los que marques. Lo que cambies después en un mes no toca este plan.</p>
      @if (borrando(); as b) {
        <div class="flex flex-col gap-3 rounded-xl bg-aviso-suave px-4 py-3" role="alert" data-testid="confirmar-borrar">
          <p class="text-sm text-aviso">{{ textoBorrado(b) }}</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="boton h-10 rounded-control bg-negativo text-sm text-white" [disabled]="ocupado()" (click)="borrar()">Sí, borrar plan de {{ r.anio }}</button>
            <button type="button" class="boton-secundario" (click)="borrando.set(null)">Cancelar</button>
          </div>
        </div>
      } @else {
        <button type="button" class="boton-texto self-start font-normal text-negativo" (click)="pedirBorrar()">Borrar plan de {{ r.anio }}</button>
      }

      @if (editando(); as e) {
        <app-hoja [titulo]="e.fila.nombre + ' · ' + nombre(e.mes)" (cerrar)="editando.set(null)">
          <app-monto-input [etiqueta]="e.fila.tenue ? 'Aporte que esperas' : 'Monto del mes'" [grande]="true" [(valor)]="montoCelda" />
          <button type="button" class="boton-grande" [disabled]="montoCelda() === null" (click)="guardarCelda(e.fila, e.mes)">Guardar</button>
        </app-hoja>
      }
      @if (cambio(); as c) {
        <app-cambio-hoja [anio]="r.anio" [opcionId]="r.opcion.id" [mesInicial]="c.mes" [evento]="c.evento" [categorias]="categorias.value() ?? []" (cerrar)="cambio.set(null)" (guardado)="guardado()" />
      }
      @if (hojaMeses()) {
        <app-meses-anual-hoja [anio]="r.anio" [opcionId]="r.opcion.id" [letra]="r.opcion.letra" (cerrar)="hojaMeses.set(false)" (guardado)="mesesListos($event)" />
      }
      @if (mensaje()) {
        <p role="status" class="text-sm text-positivo">{{ mensaje() }}</p>
      }
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    }
  `,
})
export class AnualPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);

  /** Parametro de la ruta (`/planear/anual/:anio`). */
  readonly anio = input.required<string>();
  /** `?paso=base`: volver al mes base de un año que ya tiene plan. */
  readonly paso = input<string>();
  /** `?opcion=B`: la opcion que se ve (design D5 de anual-opciones-y-meses). Sin ella, la en uso o la A. */
  readonly opcion = input<string>();
  /** La opcion elegida, por id; null hasta resolver la letra de la URL. */
  private readonly opcionId = signal<Id | null>(null);
  protected readonly resumen = consulta(() => ({ anio: Number(this.anio()), opcion: this.opcionId() }), (p, x) => p.plan.anual(x.anio, x.opcion));
  /** El resumen de la Opcion A, para marcar lo distinto cuando se ve otra. */
  private readonly resumenA = consulta(() => {
    const r = this.resumen.value();
    const a = r?.opciones[0];
    return r && a && a.id !== r.opcion.id ? { anio: r.anio, opcion: a.id } : null;
  }, (p, x) => (x ? p.plan.anual(x.anio, x.opcion) : Promise.resolve(null)));
  /** Las filas de la A por clave; null si se ve la A. */
  protected readonly filasA = computed(() => {
    const a = this.resumenA.value();
    if (!a || !this.resumen.value() || this.resumen.value()!.opcion.id === a.opcion.id) return null;
    return new Map([...a.ingresos, ...a.gastos, ...(a.eventos ? [a.eventos] : [])].map((f) => [f.clave, f.valores]));
  });
  protected readonly hojaMeses = signal(false);
  protected readonly quitandoOpcion = signal(false);

  constructor() {
    // La letra de la URL se resuelve con las opciones del año.
    effect(() => {
      const r = this.resumen.value();
      const letra = this.opcion();
      if (!r || !letra || this.opcionId()) return;
      const o = r.opciones.find((x) => x.letra === letra);
      if (o && o.id !== r.opcion.id) this.opcionId.set(o.id);
    });
  }
  protected readonly categorias = consulta(() => null, (p) => p.hogar.categorias());
  protected readonly inicio = consulta(() => null, (p) => p.plan.inicio());
  protected readonly meses = MESES;
  protected readonly puedeCrear = computed(() => Number(this.anio()) >= mesDe(this.puertos.hoy()).anio);

  /** Sin plan anual, o pedido con `?paso=base`, se ve el paso 1. */
  protected readonly pasoBase = computed(() => this.paso() === 'base' || (!this.resumen.isLoading() && !this.resumen.value() && this.resumen.status() !== 'idle'));

  // --- Paso 1 ---

  /** Los meses con plan, del mas reciente al mas antiguo, y "Solo fijos" y "Desde cero". */
  protected readonly opcionesBase = computed<OpcionBase[]>(() => {
    const i = this.inicio.value();
    const conPlan = i ? [...i.proximos.filter((m) => m.plan).reverse(), ...i.recientes.filter((m) => m.plan)] : [];
    return [
      ...conPlan.map((m) => ({ clave: claveMes(m.ref), titulo: `${formatMesAnio(m.ref)} · ${m.detalle.split(' · ')[0]}`, detalle: this.detalleBase(m), base: { tipo: 'MES' as const, ref: m.ref } })),
      { clave: 'FIJOS', titulo: 'Solo fijos e ingresos', detalle: 'Salario, fijos, tarjetas y créditos. Variables en blanco.', base: { tipo: 'FIJOS' } },
      { clave: 'CERO', titulo: 'Desde cero', detalle: 'Solo el salario y el diezmo calculado', base: { tipo: 'CERO' } },
    ];
  });
  private readonly elegidaUsuario = signal<string | null>(null);
  /** Por defecto, el mes en curso (o el primero con plan). */
  protected readonly elegida = computed(() => {
    const opciones = this.opcionesBase();
    const actual = claveMes(mesDe(this.puertos.hoy()));
    return this.elegidaUsuario() ?? (opciones.find((o) => o.clave === actual) ?? opciones[0])?.clave ?? null;
  });
  protected readonly baseElegida = computed(() => this.opcionesBase().find((o) => o.clave === this.elegida())?.base ?? null);
  protected readonly vista = consulta(() => (this.baseElegida() ? { anio: Number(this.anio()), base: this.baseElegida()! } : null), (p, d) => (d ? p.plan.vistaBase(d.anio, d.base) : Promise.resolve(null)));
  protected readonly confirmando = signal(false);
  protected readonly ocupado = signal(false);

  // --- Paso 2 ---

  protected readonly gastos = computed<FilaAnualVista[]>(() => {
    const r = this.resumen.value();
    return r ? [...r.gastos, r.diezmo, ...(r.eventos ? [r.eventos] : [])] : [];
  });
  protected readonly editando = signal<{ fila: FilaAnualVista; mes: number } | null>(null);
  protected readonly montoCelda = signal<number | null>(null);
  protected readonly cambio = signal<{ evento: EventoAnual | null; mes: number } | null>(null);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  /** Desde 1024 px, la tabla de 12 meses; con menos, la lista de meses (design D5). */
  protected readonly escritorio = anchoEscritorio();


  protected readonly elegidaSetter = (clave: string) => this.elegidaUsuario.set(clave);

  private detalleBase(m: ResumenMesPlan): string {
    const libre = m.libre.map((v) => formatCop(v)).join(' – ');
    return `${m.estado === 'BORRADOR' ? 'dejaría' : 'deja'} libre ${libre}`;
  }

  protected async replicar(): Promise<void> {
    const r = this.resumen.value();
    const tieneMontos = Boolean(r && r.gastos.some((f) => f.valores.some((v) => v > 0)));
    if (tieneMontos && !this.confirmando()) {
      this.confirmando.set(true);
      return;
    }
    this.ocupado.set(true);
    await this.ejecutar(async () => {
      await this.puertos.plan.replicarMes(Number(this.anio()), this.baseElegida()!, this.opcionId());
      this.confirmando.set(false);
      await this.router.navigate(['/planear/anual', this.anio()], { queryParams: { opcion: this.opcion() ?? null } });
    });
    this.ocupado.set(false);
  }

  /** Las filas de gasto por categoria y las de aportes proyectados; no el diezmo, los fijos ni los eventos. */
  protected editable(f: FilaAnualVista): boolean {
    return Boolean(f.categoriaId) || Boolean(f.usuarioId);
  }

  protected abrirCelda(f: FilaAnualVista, mes: number, valor: number): void {
    this.montoCelda.set(valor);
    this.editando.set({ fila: f, mes });
  }

  protected async guardarCelda(f: FilaAnualVista, mes: number): Promise<void> {
    const anio = Number(this.anio());
    const monto = this.montoCelda() ?? 0;
    await this.ejecutar(async () => {
      if (f.usuarioId) await this.puertos.plan.editarProyeccion(f.usuarioId, { anio, mes }, monto);
      else await this.puertos.plan.editarMontoAnual(anio, f.categoriaId!, mes, monto, this.resumen.value()?.opcion.id);
      this.editando.set(null);
    });
  }

  protected abrirCambio(evento: EventoAnual | null, mes: number): void {
    this.cambio.set({ evento, mes });
  }

  protected guardado(): void {
    this.cambio.set(null);
    this.mensaje.set('Guardado');
  }

  /** "Borrar plan de {año}": la confirmacion dice que se borra (spec steward-planear, "Plan anual"). */
  protected readonly borrando = signal<{ cambios: number; proyecciones: boolean } | null>(null);

  protected async pedirBorrar(): Promise<void> {
    await this.ejecutar(async () => this.borrando.set(await this.puertos.plan.conteoBorradoAnual(Number(this.anio()))));
  }

  protected textoBorrado(b: { cambios: number; proyecciones: boolean }): string {
    const partes = ['los montos'];
    if (b.cambios) partes.push(`${b.cambios} ${b.cambios === 1 ? 'cambio' : 'cambios'}`);
    if (b.proyecciones) partes.push('los aportes proyectados');
    const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0];
    return `Se borran ${lista} de ${this.anio()}. Los meses ya creados no cambian.`;
  }

  protected async borrar(): Promise<void> {
    this.ocupado.set(true);
    await this.ejecutar(async () => {
      await this.puertos.plan.borrarAnual(Number(this.anio()));
      this.borrando.set(null);
      await this.router.navigate(['/planear']);
    });
    this.ocupado.set(false);
  }

  /** La hoja de meses termino: dice cuantos se crearon y actualizaron. */
  protected mesesListos(r: { creados: number; actualizados: number }): void {
    this.hojaMeses.set(false);
    const partes = [r.creados ? `${r.creados} ${r.creados === 1 ? 'mes creado' : 'meses creados'}` : '', r.actualizados ? `${r.actualizados} ${r.actualizados === 1 ? 'actualizado' : 'actualizados'}` : ''].filter(Boolean);
    this.mensaje.set(`Listo: ${partes.join(' y ')} con la Opción ${this.resumen.value()?.opcion.letra ?? 'A'}.`);
  }

  protected rotulo(r: ResumenAnual): string {
    const opciones = r.opciones.length > 1 ? ` · ${r.opciones.length} opciones` : '';
    return (r.estado === 'BORRADOR' ? 'Borrador · paso 2 de 2' : 'Meses creados') + opciones;
  }

  protected autor(o: OpcionAnualVista): string {
    return o.inicialAutor && o.creadoPor !== this.usuario.value()?.usuario.id ? ` · ${o.inicialAutor}` : '';
  }

  private readonly usuario = consulta(() => null, (p) => p.sesion.actual());

  protected opcionEnUso(r: ResumenAnual): boolean {
    return r.opciones.find((o) => o.id === r.opcion.id)?.enUso ?? false;
  }

  /** Elegir una opcion: queda en la URL. */
  protected elegir(o: OpcionAnualVista): void {
    this.opcionId.set(o.id);
    this.quitandoOpcion.set(false);
    void this.router.navigate([], { queryParams: { opcion: o.letra }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async duplicar(r: ResumenAnual): Promise<void> {
    this.ocupado.set(true);
    await this.ejecutar(async () => {
      const id = await this.puertos.plan.duplicarOpcionAnual(r.anio, r.opcion.id);
      this.opcionId.set(id);
      const letra = String.fromCharCode(Math.max(...r.opciones.map((o) => o.letra.charCodeAt(0))) + 1);
      await this.router.navigate([], { queryParams: { opcion: letra }, queryParamsHandling: 'merge', replaceUrl: true });
    });
    this.ocupado.set(false);
  }

  protected async quitarOpcion(r: ResumenAnual): Promise<void> {
    this.ocupado.set(true);
    await this.ejecutar(async () => {
      await this.puertos.plan.quitarOpcionAnual(r.anio, r.opcion.id);
      this.quitandoOpcion.set(false);
      this.opcionId.set(null);
      await this.router.navigate([], { queryParams: { opcion: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });
    this.ocupado.set(false);
  }

  /** Cuanto mas o menos deja libre la elegida frente a la A; 0 si se ve la A. */
  protected frenteA(r: ResumenAnual): number {
    return r.opciones[0]?.id === r.opcion.id ? 0 : this.suma(r.libre) - this.suma(r.libreA);
  }

  protected distintoDeA(f: FilaAnualVista, i: number): boolean {
    const a = this.filasA();
    if (!a) return false;
    return (a.get(f.clave)?.[i] ?? 0) !== f.valores[i];
  }

  /** La diferencia de un mes (o grupo) frente a la A, en la lista de meses. */
  protected vsA(r: ResumenAnual, m: MesesAnualVista): number {
    return r.opciones[0]?.id === r.opcion.id ? 0 : m.libre - r.libreA[m.desde - 1]!;
  }

  protected suma(v: number[]): number {
    return v.reduce((a, x) => a + x, 0);
  }

  protected nombre(mes: number): string {
    return nombreMesCapital(mes);
  }

  protected mesAnio(ref: { anio: number; mes: number }): string {
    return formatMesAnio(ref).toLowerCase();
  }

  protected nombreGrupo(m: MesesAnualVista): string {
    return nombreMeses(m);
  }

  protected igualTexto(m: MesesAnualVista): string {
    return m.desde === m.hasta ? 'Igual al mes base' : `Igual al mes base · ${m.hasta - m.desde + 1} meses`;
  }

  protected apretado(m: MesesAnualVista): boolean {
    const mes = this.resumen.value()?.kpis.mesApretado.mes ?? 0;
    return mes >= m.desde && mes <= m.hasta;
  }

  protected celda(v: number): string {
    return v ? formatMiles(v) : '';
  }

  protected conSigno(v: number): string {
    return formatCop(v, { signo: true });
  }

  protected detalleCambio(c: VistaCambio): string {
    const partes = [c.evento.tipo === 'GASTO' ? `Gasto · ${c.donde}` : c.donde];
    if (c.diezmo) partes.push(`diezmo ${formatCop(c.diezmo)}`);
    if (c.evento.enAdelante) partes.push(`de ${nombreMesCapital(c.evento.mes).toLowerCase()} en adelante`);
    return partes.join(' · ');
  }

  protected montoCambio(c: VistaCambio): string {
    return c.evento.tipo === 'GASTO' ? formatCop(c.evento.monto) : formatCop(c.evento.monto, { signo: true });
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
