import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { claveMes, formatCop, formatMesAnio, nombreMes, sumarMeses, type FilaOpciones, type Id, type ItemPlan, type MesRef, type Pesos, type TablaOpciones } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';

/**
 * Un mes en Borrador con varias opciones en escritorio (Comparar.dc.html, design D3, D4 y D6 de plan-mes-escritorio): las
 * opciones lado a lado gasto por gasto, la "Editando" se edita en la celda, y al lado sus cambios frente a la A, lo que el
 * mes ya trae y los atajos. Las hojas las abre la pagina del mes.
 */
@Component({
  selector: 'app-mes-opciones',
  imports: [RouterLink, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5', 'data-testid': 'mes-opciones', '(keydown)': 'tecla($event)' },
  template: `
    <a routerLink="/planear" class="boton-texto -my-2 self-start text-sm font-normal">‹ Planear</a>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <a [routerLink]="['/planear', claveDe(-1)]" class="flecha-mes" [attr.aria-label]="tituloDe(-1)">‹</a>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs font-semibold tracking-[0.08em] text-aviso uppercase" data-testid="estado-mes">{{ tabla()?.estadoTexto }} · {{ tabla()?.vistas?.length }} opciones</span>
          <h1 class="text-[28px] font-bold">{{ titulo() }}</h1>
        </div>
        <a [routerLink]="['/planear', claveDe(1)]" class="flecha-mes" [attr.aria-label]="tituloDe(1)">›</a>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex min-h-11 items-center gap-2 px-2 text-sm text-[#3B3D39]">
          <input type="checkbox" class="h-[18px] w-[18px] accent-acento" [checked]="soloCambios()" (change)="soloCambios.set($any($event.target).checked)" />
          Solo lo que cambia
        </label>
        <button type="button" class="boton-secundario h-10 rounded-control px-3.5 text-sm font-semibold" (click)="duplicar.emit()">Duplicar {{ nombreEditando() }}</button>
        <button type="button" class="boton-primario h-10 rounded-control px-4 text-sm font-semibold" (click)="usar.emit()">Usar {{ nombreEditando() }} para {{ mesMin() }}</button>
      </div>
    </div>

    @if (tabla(); as t) {
      <div class="flex flex-wrap items-start gap-5">
        <section class="min-w-0 flex-[3_1_640px] overflow-x-auto rounded-[14px] border border-borde bg-superficie" aria-label="Opciones lado a lado" data-testid="tabla-opciones">
          <table class="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr class="border-b border-borde bg-fondo">
                <th scope="col" class="px-5 py-3 text-left"><span class="sr-only">Gasto</span></th>
                <th scope="col" class="w-[70px] px-2 py-3 text-left text-[11px] font-semibold tracking-[0.06em] text-secundario">DÍA</th>
                @for (v of t.vistas; track v.escenario.id; let k = $index) {
                  <th scope="col" class="w-[150px] px-2 py-2 text-right align-bottom" [class.bg-acento-suave]="k === indice()">
                    <button type="button" class="flex w-full flex-col items-end gap-0.5 rounded-lg px-2 py-1" [attr.aria-pressed]="k === indice()" (click)="editar(v.escenario.id)">
                      @if (k === indice()) {
                        <span class="text-[10px] font-semibold tracking-[0.06em] text-acento">EDITANDO</span>
                      }
                      <span class="text-[15px] font-semibold">Opción {{ v.escenario.letra }}</span>
                      <span class="text-xs font-normal text-secundario">{{ descripcion(v.autor, v.escenario.nota) }}</span>
                    </button>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-divisor" data-fila="Ingresos">
                <th scope="row" class="px-5 py-3 text-left font-semibold">Ingresos</th>
                <td></td>
                @for (valor of t.ingresos.valores; track $index; let k = $index) {
                  <td class="px-4 py-3 text-right" [class]="claseCelda(t.ingresos.cambia[k]!, k)"><app-monto class="text-positivo" [valor]="valor" /></td>
                }
              </tr>
              @for (s of t.secciones; track s.categoriaId) {
                @if (filasDe(s.filas).length) {
                  <tr class="border-b border-divisor bg-[#FCFCFA]" [attr.data-grupo]="s.nombre">
                    <th scope="rowgroup" class="px-5 py-2.5 text-left text-xs font-semibold tracking-[0.06em] text-[#3B3D39] uppercase">
                      <span class="flex items-center gap-2"><span class="h-2 w-2 rounded-[2px]" [style.background]="s.color" aria-hidden="true"></span>{{ s.nombre }}</span>
                    </th>
                    <td></td>
                    @for (sub of s.subtotales; track $index; let k = $index) {
                      <td class="px-4 py-2.5 text-right text-[13px] font-semibold" [class.bg-acento-suave]="k === indice()"><app-monto [valor]="sub" /></td>
                    }
                  </tr>
                  @for (f of filasDe(s.filas); track f.clave) {
                    <tr class="border-b border-[#F1F0EB]" [attr.data-fila]="f.nombre" [attr.data-categoria]="f.categoriaId">
                      <th scope="row" class="py-1.5 pr-3 pl-9 text-left font-normal">
                        <span class="flex flex-col gap-0.5">
                          @if (itemEditando(f); as item) {
                            <button type="button" class="self-start text-left text-sm hover:underline" (click)="abrirGasto.emit({ item, categoriaId: f.categoriaId })">{{ f.nombre }}</button>
                          } @else {
                            <span class="text-sm">{{ f.nombre }}</span>
                          }
                          <span class="text-xs text-secundario">{{ f.detalle }}</span>
                        </span>
                      </th>
                      <td class="px-2 text-[13px] text-[#3B3D39]">{{ f.dia ?? '' }}</td>
                      @for (c of f.celdas; track $index; let k = $index) {
                        <td class="px-2 py-1 text-right text-[13px]" [class]="claseCelda(c.cambia, k)" [attr.data-cambia]="c.cambia">
                          @if (k === indice() && f.tipo !== 'DIEZMO') {
                            <app-monto-input [compacto]="true" [valor]="c.monto" placeholder="—" [etiquetaAccesible]="f.nombre + ' en la Opción ' + letra(k)" (confirmado)="guardarCelda(f, k, $event)" />
                          } @else if (c.monto === null) {
                            <span class="monto px-2 text-[#A5A79F]">—</span>
                          } @else if (k === indice() && c.item) {
                            <button type="button" class="monto px-2 hover:underline" (click)="abrirGasto.emit({ item: c.item, categoriaId: f.categoriaId })">{{ cop(c.monto) }}</button>
                          } @else {
                            <app-monto class="px-2" [valor]="c.monto" />
                          }
                        </td>
                      }
                    </tr>
                  }
                  <tr class="border-b border-divisor">
                    <td colspan="2" class="py-1 pl-9">
                      <button type="button" class="h-[30px] text-[13px] font-medium text-acento hover:text-acento-oscuro" (click)="abrirGasto.emit({ item: null, categoriaId: s.categoriaId })">+ Agregar a {{ s.nombre }}</button>
                    </td>
                    <td [attr.colspan]="t.vistas.length"></td>
                  </tr>
                }
              }
              @if (soloCambios() && t.igualesEnTodas) {
                <tr class="border-b border-divisor">
                  <td [attr.colspan]="t.vistas.length + 2" class="px-5 py-2.5 text-[13px] text-secundario" data-testid="ocultos">
                    {{ t.igualesEnTodas }} {{ t.igualesEnTodas === 1 ? 'gasto igual' : 'gastos iguales' }} en todas las opciones, ocultos
                  </td>
                </tr>
              }
              <tr class="border-b border-divisor" data-fila="Total gastos">
                <th scope="row" class="px-5 py-3 text-left font-semibold">Total gastos</th>
                <td></td>
                @for (total of t.totales; track $index; let k = $index) {
                  <td class="px-4 py-3 text-right font-semibold" [class.bg-acento-suave]="k === indice()"><app-monto [valor]="total" /></td>
                }
              </tr>
              <tr data-fila="Queda libre">
                <th scope="row" class="px-5 py-4 text-left text-base font-semibold">Queda libre</th>
                <td></td>
                @for (libre of t.libres; track $index; let k = $index) {
                  <td class="px-4 py-4 text-right text-lg font-semibold" [class.bg-acento-suave]="k === indice()" [class.text-acento]="libre >= 0" [class.text-negativo]="libre < 0"><app-monto [valor]="libre" /></td>
                }
              </tr>
            </tbody>
          </table>
        </section>

        <aside class="flex min-w-0 flex-[2_1_320px] flex-col gap-4">
          @if (t.vistas[indice()]; as v) {
            <section class="flex flex-col gap-2 rounded-[14px] border border-borde bg-superficie p-4" data-testid="opcion-editando">
              <span class="rotulo">Opción {{ v.escenario.letra }} dejaría libre</span>
              <app-monto class="text-[26px] font-semibold" [class.text-negativo]="v.libre < 0" [valor]="v.libre" />
              @if (indice() > 0) {
                <span class="text-[13px] text-secundario">{{ frenteA(v.libre - t.libres[0]!) }}</span>
                <ul class="flex flex-col gap-1 border-t border-divisor pt-2 text-[13px]">
                  @for (c of t.cambios[indice()]; track c) {
                    <li>{{ c }}</li>
                  } @empty {
                    <li class="text-secundario">Igual a la Opción A</li>
                  }
                </ul>
              } @else {
                <span class="text-[13px] text-secundario">La base con que se comparan las demás.</span>
              }
              @if (v.escenario.nota) {
                <p class="rounded-lg bg-nota px-3 py-2 text-[13px] text-[#3B3D39]">{{ v.escenario.nota }}</p>
              }
            </section>
          }
          @if (trae.value(); as lineas) {
            @if (lineas.length) {
              <section class="flex flex-col gap-2 rounded-[14px] bg-[#FBF7EC] p-4" data-testid="ya-trae">
                <span class="text-[13px] font-semibold text-[#6B4A00]">{{ mesCapital() }} ya trae</span>
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
              </section>
            }
          }
          <section class="flex flex-col gap-2 rounded-[14px] border border-borde bg-superficie p-4 text-[13px]" aria-label="Atajos">
            <span class="rotulo">Atajos</span>
            <div class="flex justify-between"><span>Duplicar la opción</span><kbd class="rounded border border-borde px-1.5 font-sans text-xs">Ctrl + D</kbd></div>
            <div class="flex justify-between"><span>Agregar un gasto en la categoría</span><kbd class="rounded border border-borde px-1.5 font-sans text-xs">N</kbd></div>
          </section>
        </aside>
      </div>
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    }
  `,
  styles: `
    .flecha-mes { display: flex; height: 36px; width: 36px; align-items: center; justify-content: center; border-radius: 10px; border: 1px solid var(--color-borde-campo); background: var(--color-superficie); font-size: 16px; font-weight: 600; color: #3b3d39; }
  `,
})
export class MesOpciones {
  private readonly puertos = inject(PUERTOS);

  readonly ref = input.required<MesRef>();
  readonly planId = input.required<Id>();
  /** La opcion "Editando": la misma que elige la pagina del mes. */
  readonly elegida = model<Id | null>(null);
  /** La opcion en uso: la "Editando" al abrir si no se eligio otra (o la A). */
  readonly enUso = input<Id | null>(null);
  readonly duplicar = output<void>();
  readonly usar = output<void>();
  readonly abrirGasto = output<{ item: ItemPlan | null; categoriaId: Id | null }>();

  private readonly datos = consulta(() => this.ref(), (p, ref) => p.plan.tablaOpciones(ref));
  protected readonly trae = consulta(() => this.ref(), (p, ref) => p.plan.loQueTrae(ref));
  protected readonly tabla = computed<TablaOpciones | null>(() => this.datos.value() ?? null);
  protected readonly soloCambios = signal(false);
  protected readonly error = signal('');

  protected readonly indice = computed(() => {
    const vistas = this.tabla()?.vistas ?? [];
    return Math.max(0, vistas.findIndex((v) => v.escenario.id === (this.elegida() ?? this.enUso())));
  });
  protected readonly nombreEditando = computed(() => `Opción ${this.letra(this.indice())}`);
  protected readonly titulo = computed(() => formatMesAnio(this.ref()));
  protected readonly mesMin = computed(() => nombreMes(this.ref().mes));
  protected readonly mesCapital = computed(() => this.mesMin().charAt(0).toUpperCase() + this.mesMin().slice(1));

  protected letra(k: number): string {
    return this.tabla()?.vistas[k]?.escenario.letra ?? 'A';
  }

  protected claveDe(n: number): string {
    return claveMes(sumarMeses(this.ref(), n));
  }

  protected tituloDe(n: number): string {
    return formatMesAnio(sumarMeses(this.ref(), n));
  }

  protected editar(id: Id): void {
    this.elegida.set(id);
  }

  protected filasDe(filas: FilaOpciones[]): FilaOpciones[] {
    return this.soloCambios() ? filas.filter((f) => !f.igual) : filas;
  }

  protected itemEditando(f: FilaOpciones): ItemPlan | null {
    return f.celdas[this.indice()]?.item ?? null;
  }

  protected claseCelda(cambia: boolean, k: number): string {
    if (cambia) return 'bg-[#FBF7EC] font-semibold';
    return k === this.indice() ? 'bg-acento-suave/60' : '';
  }

  protected descripcion(autor: string, nota: string): string {
    return [autor, nota].filter(Boolean).join(' · ');
  }

  protected cop(n: Pesos): string {
    return formatCop(n);
  }

  protected frenteA(d: Pesos): string {
    if (d === 0) return 'Lo mismo que la Opción A';
    return `${formatCop(Math.abs(d))} ${d > 0 ? 'más' : 'menos'} que la Opción A`;
  }

  /** Una celda de la opcion "Editando": cambia el monto o, si estaba en "—", agrega el gasto con los datos de la fila. */
  protected async guardarCelda(f: FilaOpciones, k: number, monto: Pesos | null): Promise<void> {
    const t = this.tabla();
    const celda = f.celdas[k];
    if (!t || !celda || monto === null || monto === celda.monto) return;
    const escenarioId = t.vistas[k]!.escenario.id;
    this.error.set('');
    try {
      if (celda.item) {
        await this.puertos.plan.guardarItem(this.planId(), escenarioId, { ...celda.item, monto });
      } else {
        const { id: _id, ...plantilla } = f.plantilla;
        await this.puertos.plan.guardarItem(this.planId(), escenarioId, { ...plantilla, monto, ingresoPlanId: null, aporteId: null, ingresoFijoId: null, ajustadoAMano: false });
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  /** Ctrl/Cmd + D duplica la opcion; N, desde una celda, agrega un gasto en su categoria (design D6). */
  protected tecla(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.duplicar.emit();
      return;
    }
    if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
    const fila = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-categoria]');
    if (!fila) return;
    e.preventDefault();
    this.abrirGasto.emit({ item: null, categoriaId: fila.dataset['categoria'] ?? null });
  }
}
