import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  claveMes, diaDe, formatCop, formatMesAnio, mesDe, mismoMes, nombreMes, sumarMeses, type FilaMes, type GrupoMes, type Id, type IngresoPlan,
  type ItemPlan, type MesRef, type Pesos, type VistaMesEscritorio,
} from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';

/** Monto corto para el calendario: `375k`, `6,3M`. */
export function montoCorto(n: Pesos): string {
  const miles = Math.round(n / 1000);
  return miles >= 1000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')}M` : `${miles}k`;
}

/** Una diferencia frente al mes anterior: "—" si es igual. */
export function textoDiferencia(d: Pesos | null): string {
  if (d === null) return '';
  return d === 0 ? '—' : formatCop(d, { signo: true });
}

/** Color de una diferencia: en gastos subir es malo; en ingresos, bueno. */
export function claseDiferencia(d: Pesos | null, ingresos: boolean): string {
  if (!d) return 'text-[#A5A79F]';
  return d > 0 === ingresos ? 'font-semibold text-positivo' : 'font-semibold text-negativo';
}

const ETIQUETAS = { SOLO_MES: '', PROYECTADO: 'Proyectado', ULTIMO: 'Último' } as const;

/**
 * Un mes con una opcion en escritorio (MesWeb.dc.html, design D2, D4 y D5 de plan-mes-escritorio): indicadores, la tabla
 * del mes frente al anterior con los montos editables en la celda, el calendario de pagos, la plata en cuentas dia a dia
 * y lo que se libera. Las hojas (gasto, ingreso) las abre la pagina del mes.
 */
@Component({
  selector: 'app-mes-una-opcion',
  imports: [RouterLink, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5', 'data-testid': 'mes-una-opcion' },
  template: `
    <a routerLink="/planear" class="boton-texto -my-2 self-start text-sm font-normal">‹ Planear</a>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <a [routerLink]="['/planear', claveDe(-1)]" class="flecha-mes" [attr.aria-label]="tituloDe(-1)">‹</a>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs font-semibold tracking-[0.08em] uppercase" [class]="estado() === 'BORRADOR' ? 'text-aviso' : 'text-secundario'" data-testid="estado-mes">{{ v()?.estadoTexto }}</span>
          <h1 class="titular text-[28px] font-bold">{{ titulo() }}</h1>
        </div>
        <a [routerLink]="['/planear', claveDe(1)]" class="flecha-mes" [attr.aria-label]="tituloDe(1)">›</a>
      </div>
      <div class="flex flex-wrap gap-2">
        @switch (estado()) {
          @case ('BORRADOR') {
            <button type="button" class="boton-secundario h-10 rounded-control px-3.5 text-sm font-semibold" (click)="duplicar.emit()">Crear otra opción</button>
            <button type="button" class="boton-primario h-10 rounded-control px-4 text-sm font-semibold" (click)="usar.emit()">Usar este plan en {{ mesMin() }}</button>
          }
          @case ('ACTIVO') {
            <button type="button" class="boton-secundario h-10 rounded-control px-3.5 text-sm font-semibold" (click)="verEjecucion.emit()">Ver ejecución</button>
            <a [routerLink]="['/planear', clave(), 'cierre']" class="boton-primario h-10 rounded-control px-4 text-sm font-semibold">Cierre de mes</a>
          }
          @default {
            <a [routerLink]="['/planear', clave(), 'cierre']" class="boton-secundario h-10 rounded-control px-3.5 text-sm font-semibold">Ver cierre</a>
          }
        }
      </div>
    </div>

    @if (v(); as v) {
      <div class="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3" data-testid="indicadores">
        <div class="flex flex-col gap-1 rounded-tarjeta bg-superficie px-[18px] py-4">
          <span class="text-xs font-semibold tracking-[0.06em] text-positivo">ENTRA</span>
          <app-monto class="text-[22px] font-semibold" [valor]="v.entra" />
          <span class="text-xs text-secundario" data-testid="nota-entra">{{ v.notaEntra }}</span>
        </div>
        <div class="flex flex-col gap-1 rounded-tarjeta bg-superficie px-[18px] py-4">
          <span class="text-xs font-semibold tracking-[0.06em] text-negativo">SALE</span>
          <app-monto class="text-[22px] font-semibold" [valor]="v.sale" />
          <span class="text-xs text-secundario" data-testid="nota-sale">{{ v.notaSale }}</span>
        </div>
        <div class="flex flex-col gap-1 rounded-[14px] px-[18px] py-4" [class]="v.libre < 0 ? 'bg-negativo' : 'bg-acento'">
          <span class="text-xs font-semibold tracking-[0.06em] text-[#C9DACD]">{{ v.libre < 0 ? 'FALTARÍA' : estado() === 'BORRADOR' ? 'QUEDARÍA LIBRE' : 'LIBRE' }}</span>
          <app-monto class="text-[22px] font-semibold text-white" [valor]="v.libre < 0 ? -v.libre : v.libre" data-testid="quedaria-libre" />
          @if (sobranteEsperado()) {
            <span class="text-xs text-[#C9DACD]">Más el sobrante de {{ nombreAnterior() }}</span>
          }
        </div>
        <div class="flex flex-col gap-1 rounded-[14px] bg-[#E3EFEC] px-[18px] py-4 text-[#1E5A4C]">
          <span class="text-xs font-semibold tracking-[0.06em]">DIEZMO</span>
          <app-monto class="text-[22px] font-semibold" [valor]="v.diezmo.total" />
          <span class="text-xs" data-testid="detalle-diezmo">{{ v.diezmo.detalle || 'Sin diezmo este mes' }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-start gap-5">
        <section [attr.aria-label]="'Plan de ' + mesMin()" class="min-w-0 flex-[3_1_600px] overflow-x-auto rounded-tarjeta bg-superficie">
          <div class="min-w-[600px]">
            <div class="fila-mes border-b border-borde bg-fondo py-2.5 text-[11px] font-semibold tracking-[0.06em] text-secundario">
              <span></span><span>DÍA</span><span class="text-right">{{ mesMay() }}</span><span class="text-right">{{ v.conAnterior ? 'VS ' + anteriorMay() : '' }}</span>
            </div>
            @for (g of v.grupos; track g.titulo) {
              <div class="fila-mes border-b border-divisor bg-[#FCFCFA] py-2.5" [attr.data-grupo]="g.titulo">
                <span class="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-[#4A4E48] uppercase"><span class="h-2 w-2 shrink-0 rounded-[2px]" [style.background]="g.color" aria-hidden="true"></span>{{ g.titulo }}</span>
                <span></span>
                <app-monto class="text-right text-[13px] font-semibold" [valor]="g.total" />
                <span class="monto text-right text-xs" [class]="claseDif(g.diferencia, g.ingresos)" data-testid="diferencia">{{ dif(g.diferencia) }}</span>
              </div>
              @for (f of g.filas; track f.clave) {
                <div class="fila-mes border-b border-[#F0EEE9] py-[5px]" [class]="f.dia !== null && f.dia === dia() ? 'bg-[#F3F7F4] shadow-[inset_3px_0_0_var(--color-acento)]' : 'bg-superficie'"
                  [attr.data-fila]="f.nombre" (click)="f.dia !== null && dia.set(f.dia)">
                  <span class="flex min-w-0 flex-col gap-0.5 pl-4">
                    <span class="flex items-center gap-1.5 text-sm">
                      @if (abreHoja(f)) {
                        <button type="button" class="truncate text-left hover:underline" (click)="abrir(f)">{{ f.nombre }}</button>
                      } @else {
                        <span class="truncate" [class.italic]="f.etiqueta === 'PROYECTADO'" [class.text-secundario]="f.etiqueta === 'PROYECTADO'">{{ f.nombre }}</span>
                      }
                      @if (f.etiqueta) {
                        <span class="shrink-0 rounded-lg px-[7px] py-0.5 text-[10px] font-semibold" [class]="claseEtiqueta(f)" data-testid="etiqueta">{{ etiqueta(f) }}</span>
                      }
                    </span>
                    <span class="truncate text-xs text-secundario">{{ f.detalle }}</span>
                  </span>
                  <span class="text-[13px] text-[#4A4E48]">{{ f.dia ?? '' }}</span>
                  @if (f.monto === null) {
                    <span class="monto text-right text-[13px] text-secundario">—</span>
                  } @else if (editableEnCelda(f)) {
                    <app-monto-input [compacto]="true" [valor]="f.monto" [etiquetaAccesible]="f.nombre + ' en ' + mesMin()" (confirmado)="guardarMonto(f, $event)" />
                  } @else {
                    <app-monto class="text-right text-[13px]" [class]="f.etiqueta === 'PROYECTADO' ? 'italic text-[#8A8C85]' : f.ingreso ? 'text-positivo' : ''" [valor]="f.monto" />
                  }
                  <span class="monto text-right text-xs" [class]="claseDif(f.diferencia, f.ingreso)" data-testid="diferencia">{{ dif(f.diferencia) }}</span>
                </div>
              }
              @if (editable() && (g.ingresos || g.categoriaId)) {
                <div class="border-b border-divisor py-1.5 pr-5 pl-9">
                  <button type="button" class="h-[30px] text-[13px] font-medium text-acento hover:text-acento-oscuro" (click)="agregar(g)">+ Agregar a {{ g.titulo }}</button>
                </div>
              }
            }
          </div>
        </section>

        <aside class="flex min-w-0 flex-[2_1_380px] flex-col gap-4">
          <section aria-labelledby="calendario-pagos" class="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-4">
            <div class="flex items-baseline justify-between">
              <h2 id="calendario-pagos" class="text-[15px] font-semibold">Calendario de pagos</h2>
              <span class="text-xs text-secundario">Toca un día</span>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-secundario" aria-hidden="true">
              <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
            </div>
            <div class="grid grid-cols-7 gap-1" data-testid="calendario">
              @for (c of celdas(); track $index) {
                @if (c) {
                  <button type="button" class="flex min-h-[58px] flex-col gap-0.5 rounded-lg px-1 py-1.5" [attr.aria-label]="c.aria" [attr.aria-pressed]="c.dia === dia()"
                    [class]="c.dia === dia() ? 'border-2 border-acento bg-[#F3F7F4]' : c.entra || c.sale ? 'border border-borde bg-superficie' : 'border border-[#F0EEE9] bg-[#FCFCFA]'"
                    (click)="dia.set(c.dia)">
                    <span class="text-left text-xs" [class]="c.entra || c.sale ? 'font-bold text-texto' : 'text-secundario'">{{ c.dia }}</span>
                    @if (c.entra) {
                      <span class="monto text-right text-[10px] font-semibold text-positivo">+{{ corto(c.entra) }}</span>
                    }
                    @if (c.sale) {
                      <span class="monto text-right text-[10px] font-semibold text-negativo">−{{ corto(c.sale) }}</span>
                    }
                  </button>
                } @else {
                  <span></span>
                }
              }
            </div>
            <div class="flex gap-3.5 text-[11px] text-secundario">
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-[2px] bg-positivo"></span>Entra</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-[2px] bg-negativo"></span>Sale</span>
            </div>
            <div class="flex flex-col gap-1.5 border-t border-divisor pt-2.5" data-testid="dia-elegido">
              <span class="text-[13px] font-semibold">{{ dia() }} de {{ mesMin() }}</span>
              @for (m of v.porDia[dia()] ?? []; track $index) {
                <div class="flex justify-between gap-2 text-[13px]">
                  <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-[2px]" [style.background]="m.color" aria-hidden="true"></span>{{ m.nombre }}</span>
                  <span class="monto font-semibold" [class.text-positivo]="m.ingreso">{{ m.ingreso ? '+' : '−' }}<app-monto [valor]="m.monto" /></span>
                </div>
              } @empty {
                <span class="text-[13px] text-secundario">Nada programado este día.</span>
              }
            </div>
          </section>

          @if (v.minimo; as min) {
            <section aria-labelledby="plata-dia" class="flex flex-col gap-2.5 rounded-tarjeta bg-superficie p-4" data-testid="saldo-diario">
              <div class="flex flex-col gap-0.5">
                <h2 id="plata-dia" class="text-[15px] font-semibold">Plata en cuentas, día a día</h2>
                <span class="text-xs text-secundario">{{ textoInicio() }}</span>
              </div>
              <div class="flex h-24 items-end gap-0.5" aria-hidden="true">
                @for (b of barras(); track $index) {
                  <span class="flex-1 rounded-t-[2px]" [style.height.px]="b.alto" [style.background]="b.color"></span>
                }
              </div>
              <div class="flex justify-between text-[11px] text-secundario">
                <span>1 {{ mesCorto() }}</span><span>15</span><span>{{ v.saldoDiario.length }} {{ mesCorto() }}</span>
              </div>
              <div class="flex gap-2.5 rounded-[10px] bg-[#FBF1DC] px-3 py-2.5 text-xs leading-[1.45] text-[#6B4A00]" data-testid="punto-bajo">
                <span class="font-bold" aria-hidden="true">!</span>
                <span>Punto más bajo el <b>{{ min.dia }} {{ mesCorto() }}</b>, con ≈ <b><app-monto [valor]="min.saldo" /></b>.</span>
              </div>
            </section>
          }

          @for (l of v.seLibera; track l.nombre) {
            <section class="flex flex-col gap-1 rounded-[14px] bg-acento-suave px-4 py-3.5 text-acento-oscuro" data-testid="se-libera">
              <span class="text-[13px] font-semibold">Se libera <app-monto [valor]="l.monto" /></span>
              <span class="text-xs leading-[1.45]">{{ l.nombre }} termina en {{ mesMin() }}: desde {{ nombreDe(l.desde) }} queda libre esa plata.</span>
            </section>
          }
        </aside>
      </div>
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    }
  `,
  styles: `
    .fila-mes { display: grid; grid-template-columns: minmax(230px, 2fr) 70px 130px 120px; gap: 12px; align-items: center; padding-inline: 20px; }
    .flecha-mes { display: flex; height: 36px; width: 36px; align-items: center; justify-content: center; border-radius: 10px; border: 1px solid var(--color-borde-campo); background: var(--color-superficie); font-size: 16px; font-weight: 600; color: #4A4E48; }
  `,
})
export class MesUnaOpcion {
  private readonly puertos = inject(PUERTOS);

  readonly ref = input.required<MesRef>();
  /** BORRADOR, ACTIVO o CERRADO (estado efectivo). */
  readonly estado = input.required<string>();
  readonly planId = input.required<Id>();
  readonly escenarioId = input.required<Id>();
  readonly lineas = input<IngresoPlan[]>([]);
  readonly duplicar = output<void>();
  readonly usar = output<void>();
  readonly verEjecucion = output<void>();
  /** Abrir la hoja de un gasto (null: nuevo, en la categoria). */
  readonly abrirGasto = output<{ item: ItemPlan | null; categoriaId: Id | null }>();
  /** Abrir la hoja de una linea de ingreso (null: "+ Ingreso"). */
  readonly abrirIngreso = output<IngresoPlan | null>();

  private readonly vista = consulta(() => ({ ref: this.ref(), esc: this.escenarioId() }), (p, x) => p.plan.mesEscritorio(x.ref, x.esc));
  protected readonly v = computed<VistaMesEscritorio | null>(() => this.vista.value() ?? null);
  protected readonly editable = computed(() => this.estado() !== 'CERRADO');
  protected readonly error = signal('');

  protected readonly clave = computed(() => claveMes(this.ref()));
  protected readonly titulo = computed(() => formatMesAnio(this.ref()));
  protected readonly mesMin = computed(() => nombreMes(this.ref().mes));
  protected readonly mesMay = computed(() => this.mesMin().toUpperCase());
  protected readonly mesCorto = computed(() => this.mesMin().slice(0, 3));
  protected readonly nombreAnterior = computed(() => nombreMes(sumarMeses(this.ref(), -1).mes));
  protected readonly anteriorMay = computed(() => this.nombreAnterior().toUpperCase());
  protected readonly sobranteEsperado = computed(() => this.v()?.grupos[0]?.filas.some((f) => f.clave === 'sobrante' && f.monto === null) ?? false);

  /** El dia elegido: al abrir, el primero con movimientos desde hoy (o el 1). */
  protected readonly dia = linkedSignal(() => {
    const v = this.v();
    if (!v) return 1;
    const hoy = this.puertos.hoy();
    const desde = mismoMes(this.ref(), mesDe(hoy)) ? diaDe(hoy) : 1;
    const dias = Object.keys(v.porDia).map(Number).filter((d) => d >= desde).sort((a, b) => a - b);
    return dias[0] ?? desde;
  });

  /** La cuadricula del mes, empezando en lunes; null en los huecos. */
  protected readonly celdas = computed(() => {
    const v = this.v();
    if (!v) return [];
    const { anio, mes } = this.ref();
    const hueco = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7;
    const celdas: ({ dia: number; entra: Pesos; sale: Pesos; aria: string } | null)[] = Array.from({ length: hueco }, () => null);
    for (let d = 1; d <= v.saldoDiario.length; d++) {
      const movs = v.porDia[d] ?? [];
      const entra = movs.filter((m) => m.ingreso).reduce((a, m) => a + m.monto, 0);
      const sale = movs.filter((m) => !m.ingreso).reduce((a, m) => a + m.monto, 0);
      const partes = [entra ? `entra ${formatCop(entra)}` : '', sale ? `sale ${formatCop(sale)}` : ''].filter(Boolean).join(', ');
      celdas.push({ dia: d, entra, sale, aria: `${d} de ${this.mesMin()}${partes ? `: ${partes}` : ''}` });
    }
    return celdas;
  });

  protected readonly barras = computed(() => {
    const v = this.v();
    if (!v) return [];
    const valores = v.saldoDiario.filter((x): x is Pesos => x !== null);
    const max = Math.max(1, ...valores.map(Math.abs));
    return v.saldoDiario.map((s, i) => {
      if (s === null) return { alto: 4, color: 'var(--color-divisor)' };
      const color = s < 0 ? 'var(--color-negativo)' : v.minimo?.dia === i + 1 ? '#C9781F' : i + 1 === this.dia() ? 'var(--color-acento)' : '#B9CBBE';
      return { alto: Math.max(4, Math.round((96 * Math.abs(s)) / max)), color };
    });
  });

  protected readonly textoInicio = computed(() => {
    const v = this.v();
    if (!v) return '';
    const desde = mismoMes(this.ref(), mesDe(this.puertos.hoy())) ? `Desde hoy, con ≈ ${formatCop(v.inicio)} en cuentas.` : `Empiezan con ≈ ${formatCop(v.inicio)}.`;
    const fuera = [v.sinFecha ? `los gastos sin fecha (${formatCop(v.sinFecha)})` : '', v.ingresosSinFecha ? `los ingresos sin fecha (${formatCop(v.ingresosSinFecha)})` : ''].filter(Boolean);
    return fuera.length ? `${desde} ${fuera.join(' y ').replace(/^l/, 'L')} no están aquí.` : desde;
  });

  protected claveDe(n: number): string {
    return claveMes(sumarMeses(this.ref(), n));
  }

  protected tituloDe(n: number): string {
    return formatMesAnio(sumarMeses(this.ref(), n));
  }

  protected nombreDe(ref: MesRef): string {
    return nombreMes(ref.mes);
  }

  protected corto(n: Pesos): string {
    return montoCorto(n);
  }

  protected dif(d: Pesos | null): string {
    return textoDiferencia(d);
  }

  protected claseDif(d: Pesos | null, ingresos: boolean): string {
    return claseDiferencia(d, ingresos);
  }

  protected etiqueta(f: FilaMes): string {
    return f.etiqueta === 'SOLO_MES' ? `Solo ${this.mesMin()}` : f.etiqueta ? ETIQUETAS[f.etiqueta] : '';
  }

  protected claseEtiqueta(f: FilaMes): string {
    if (f.etiqueta === 'ULTIMO') return 'bg-acento-suave text-acento-oscuro';
    if (f.etiqueta === 'PROYECTADO') return 'bg-[#F3F2EE] text-secundario';
    return 'bg-[#FBF1DC] text-[#6B4A00]';
  }

  /** La linea de la opcion detras de una fila de ingreso (los aportes y el sobrante no tienen). */
  private lineaDe(f: FilaMes): IngresoPlan | null {
    return this.lineas().find((l) => l.id === f.linea?.lineaId) ?? null;
  }

  protected abreHoja(f: FilaMes): boolean {
    return this.editable() && (f.item !== null || this.lineaDe(f) !== null);
  }

  /** El diezmo se edita en su hoja; los aportes proyectados y el sobrante, en otro lado. */
  protected editableEnCelda(f: FilaMes): boolean {
    if (!this.editable()) return false;
    if (f.item) return f.item.tipo !== 'DIEZMO';
    return this.lineaDe(f) !== null;
  }

  protected abrir(f: FilaMes): void {
    if (f.item) this.abrirGasto.emit({ item: f.item, categoriaId: f.item.categoriaId });
    else this.abrirIngreso.emit(this.lineaDe(f));
  }

  protected agregar(g: GrupoMes): void {
    if (g.ingresos) this.abrirIngreso.emit(null);
    else this.abrirGasto.emit({ item: null, categoriaId: g.categoriaId });
  }

  protected async guardarMonto(f: FilaMes, monto: Pesos | null): Promise<void> {
    if (monto === null || monto === f.monto) return;
    this.error.set('');
    try {
      if (f.item) {
        await this.puertos.plan.guardarItem(this.planId(), this.escenarioId(), { ...f.item, monto });
      } else {
        const l = this.lineaDe(f);
        // El bruto sigue al monto salvo en las lineas de un ingreso fijo, que guardan el suyo.
        if (l) await this.puertos.plan.guardarIngreso(this.planId(), this.escenarioId(), { ...l, monto, bruto: l.bruto === l.monto ? monto : l.bruto });
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }
}
