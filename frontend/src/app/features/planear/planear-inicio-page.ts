import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  claveMes,
  diasEntre,
  formatCop,
  mesDe,
  nombreMes,
  nombreMesApretado,
  nombreMesCapital,
  type MesRef,
  type ModoNuevoMes,
  type ResumenAnual,
  type ResumenMesPlan,
} from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { anchoEscritorio } from '../../shared/escritorio';

const INICIALES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/** Un mes que dejaria menos de este libre se marca en rojo, como "enero, $598.000" en el canvas. */
const APRETADO = 1_000_000;

/** Una tarjeta de mes de Planear (canvas Libreta clara, WPlanear y MPlanear). */
interface TarjetaMes {
  clave: string;
  ref: MesRef;
  nombre: string;
  estado: ResumenMesPlan['estado'];
  chip: string;
  claseChip: string;
  rotulo: string;
  valor: string;
  nota: string;
  accion: string;
  destino: string[];
  resumen: ResumenMesPlan;
}

/**
 * Planear (canvas Libreta clara): en web, los meses en una fila de tarjetas, de los cerrados a los que vienen, y el año
 * abajo con lo que dejaria libre cada mes. En móvil, el mes activo, los que vienen (el borrador con sus opciones y el
 * primero sin plan con lo que ya trae y cómo crearlo), el año en tarjeta verde y los meses cerrados.
 */
@Component({
  selector: 'app-planear-inicio-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-6 px-8 pt-7 pb-12' : 'flex flex-col gap-4 px-4 pt-5 pb-6'" },
  template: `
    @if (escritorio()) {
      <div class="flex flex-col gap-0.5">
        <span class="text-[13px] text-secundario" data-testid="planear-sub">{{ subtitulo() }}</span>
        <h1 class="titular text-[32px] font-bold">Planear</h1>
      </div>
    } @else {
      <h1 class="titular px-1 text-[28px] font-bold">Planear</h1>
    }

    @if (error()) {
      <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
    }

    @if (inicio.value(); as i) {
      @if (escritorio()) {
        <section aria-label="Meses" class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]" data-testid="meses">
          @for (m of tarjetas(); track m.clave) {
            <a [routerLink]="m.destino" class="flex flex-col gap-2 rounded-[18px] p-4 text-texto hover:brightness-[0.98]" [attr.data-mes]="m.clave"
              [class]="m.estado === 'ACTIVO' ? 'bg-superficie shadow-[inset_0_0_0_2px_var(--color-acento)]' : m.estado === 'SIN_PLAN' ? 'shadow-[inset_0_0_0_1px_var(--color-borde-campo)]' : 'bg-superficie'">
              <span class="flex items-center justify-between gap-2">
                <span class="text-base font-semibold">{{ m.nombre }}</span>
                <span class="rounded-full px-2.5 py-[3px] text-[11px] font-semibold" [class]="m.claseChip">{{ m.chip }}</span>
              </span>
              <span class="text-xs text-secundario">{{ m.rotulo }}</span>
              <span class="titular text-[22px] font-bold" [class]="m.valor === '—' ? 'text-[#A5A79F]' : m.estado === 'ACTIVO' ? 'text-acento' : 'text-texto'" data-testid="valor-mes">{{ m.valor }}</span>
              <span class="min-h-8 text-xs text-texto-medio">{{ m.nota }}</span>
              <span class="text-[13px] font-semibold text-acento">{{ m.accion }}</span>
            </a>
          }
        </section>

        <section class="flex flex-wrap items-center gap-7 rounded-[22px] bg-superficie px-7 py-6" aria-labelledby="titulo-anio" data-testid="tarjeta-anio">
          <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            <span class="text-[13px] font-semibold" [class]="i.anual ? 'text-positivo' : 'text-aviso'">{{ estadoAnio(i.anual) }}</span>
            <h2 id="titulo-anio" class="titular text-[26px] leading-[1.15] font-bold">{{ i.anual ? 'El plan de ' + anio(i.anual) : 'Planea ' + anioSiguiente() + ' partiendo de un mes que ya conoces' }}</h2>
            <p class="text-[15px] leading-normal text-texto-medio">
              {{ i.anual ? 'Libre proyectado en el año ' + cop(i.anual.kpis.libreAnio) + '. Ajusta lo que cambia mes a mes.' : 'Eliges un mes base, se replica en los 12 y solo agregas lo que cambia: primas, matrícula, SOAT, Navidad.' }}
            </p>
            <a [routerLink]="['/planear/anual', i.anual?.anio ?? anioSiguiente()]" class="boton-primario mt-2 h-11 self-start rounded-control px-[18px] text-sm">
              {{ i.anual ? 'Abrir ' + i.anual.anio : 'Planear ' + anioSiguiente() }} ›
            </a>
          </div>
          @if (i.anual; as a) {
            <div class="flex min-w-0 flex-[1.4_1_420px] flex-col gap-2" data-testid="barras-anio">
              <span class="text-xs text-secundario">Libre por mes · opción {{ a.opcion.letra }}</span>
              <div class="flex h-[120px] items-end gap-2" aria-hidden="true">
                @for (b of barras(a); track $index) {
                  <span class="flex-1 rounded-t-md" [style.height.px]="b.alto" [style.background]="b.color"></span>
                }
              </div>
              <div class="grid grid-cols-12 gap-2 text-center text-[11px] text-secundario" aria-hidden="true">
                @for (n of iniciales; track n) {
                  <span>{{ n }}</span>
                }
              </div>
              <span class="text-[13px] text-texto-medio">Libre en el año ≈ <b>{{ cop(a.kpis.libreAnio) }}</b> · mes más apretado: <b class="text-negativo">{{ apretado(a) }}</b></span>
            </div>
          } @else {
            <ol class="grid min-w-0 flex-[1.4_1_420px] grid-cols-3 gap-3">
              <li class="flex flex-col gap-1 rounded-xl bg-acento-suave p-3.5"><span class="text-xs font-semibold text-acento">1</span><span class="text-sm font-semibold">Mes base</span><span class="text-xs text-secundario">El mes que ya conoces</span></li>
              <li class="flex flex-col gap-1 rounded-xl bg-hueco p-3.5"><span class="text-xs font-semibold text-secundario">2</span><span class="text-sm font-semibold">Replicar</span><span class="text-xs text-secundario">En los 12 meses</span></li>
              <li class="flex flex-col gap-1 rounded-xl bg-hueco p-3.5"><span class="text-xs font-semibold text-secundario">3</span><span class="text-sm font-semibold">Lo que cambia</span><span class="text-xs text-secundario">Primas, matrícula, Navidad</span></li>
            </ol>
          }
        </section>
      } @else {
        @for (m of tarjetasMovil(); track m.clave) {
          @switch (m.estado) {
            @case ('ACTIVO') {
              <a [routerLink]="m.destino" class="tarjeta flex items-center justify-between gap-3 p-4" [attr.data-mes]="m.clave">
                <span class="flex flex-col gap-1">
                  <span class="flex items-center gap-2"><span class="text-base font-semibold">{{ m.nombre }}</span><span class="rounded-full px-2 py-[3px] text-[11px] font-semibold" [class]="m.claseChip">{{ m.chip }}</span></span>
                  <span class="text-[13px] text-secundario">{{ m.nota }} · te queda libre {{ m.valor }}</span>
                </span>
                <span class="shrink-0 text-sm font-semibold text-acento">{{ m.accion }}</span>
              </a>
            }
            @case ('BORRADOR') {
              <a [routerLink]="m.destino" class="tarjeta flex flex-col gap-2.5 p-4" [attr.data-mes]="m.clave">
                <span class="flex items-center justify-between gap-2">
                  <span class="flex items-center gap-2"><span class="text-base font-semibold">{{ m.nombre }}</span><span class="rounded-full px-2 py-[3px] text-[11px] font-semibold" [class]="m.claseChip">{{ m.chip }}</span></span>
                  <span class="text-[13px] text-secundario">{{ empieza(m.ref) }}</span>
                </span>
                <span class="flex gap-1.5">
                  @for (o of m.resumen.opciones; track o.letra) {
                    <span class="flex min-w-0 flex-1 flex-col gap-0.5 rounded-[10px] bg-fondo px-2.5 py-2">
                      <span class="truncate text-[11px] text-secundario">{{ o.letra }}{{ o.nota ? ' · ' + o.nota : '' }}</span>
                      <span class="text-sm font-semibold" [class.text-negativo]="o.libre < 0">{{ cop(o.libre) }}</span>
                    </span>
                  }
                </span>
                <span class="text-[13px] font-semibold text-acento">{{ m.accion }}</span>
              </a>
            }
            @default {
              @if (m.clave === primeroSinPlan()?.clave) {
                <section class="tarjeta flex flex-col gap-3 p-4" [attr.data-mes]="m.clave" data-testid="sin-plan">
                  <span class="flex items-center gap-2"><span class="text-base font-semibold">{{ m.nombre }}</span><span class="rounded-full px-2 py-[3px] text-[11px] font-semibold" [class]="m.claseChip">{{ m.chip }}</span></span>
                  @if (traeTexto(); as t) {
                    <span class="text-[13px] leading-normal text-texto-medio">Ya trae {{ t }}.</span>
                  }
                  <div class="flex flex-col gap-1.5">
                    @if (copiaDe(m.ref); as c) {
                      <button type="button" class="boton-primario h-12 justify-between rounded-control px-3.5 text-sm" [disabled]="guardando()" (click)="crear(m.ref, 'COPIAR')">
                        Copiar {{ c }}<span aria-hidden="true">›</span>
                      </button>
                    }
                    <div class="grid grid-cols-2 gap-1.5">
                      <button type="button" class="boton-secundario h-11 rounded-control text-[13px]" [disabled]="guardando()" (click)="crear(m.ref, 'FIJOS')">Solo fijos e ingresos</button>
                      <button type="button" class="boton-secundario h-11 rounded-control text-[13px]" [disabled]="guardando()" (click)="crear(m.ref, 'CERO')">Desde cero</button>
                    </div>
                  </div>
                </section>
              } @else {
                <a [routerLink]="m.destino" class="tarjeta flex items-center justify-between gap-3 p-4" [attr.data-mes]="m.clave">
                  <span class="flex items-center gap-2"><span class="text-base font-semibold">{{ m.nombre }}</span><span class="rounded-full px-2 py-[3px] text-[11px] font-semibold" [class]="m.claseChip">{{ m.chip }}</span></span>
                  <span class="text-sm font-semibold text-acento">{{ m.accion }}</span>
                </a>
              }
            }
          }
        }

        <a [routerLink]="['/planear/anual', i.anual?.anio ?? anioSiguiente()]" class="flex flex-col gap-1.5 rounded-tarjeta bg-acento p-4 text-white" data-testid="tarjeta-anio">
          <span class="text-[13px] text-[#CFE0D6]">{{ estadoAnio(i.anual) }}</span>
          <span class="titular text-xl leading-[1.2] font-bold">{{ i.anual ? 'El plan de ' + i.anual.anio : 'Planea el año partiendo de ' + nombreMes(mesActual().mes) }}</span>
          <span class="text-[13px] text-[#CFE0D6]">{{ i.anual ? 'Libre proyectado ' + cop(i.anual.kpis.libreAnio) : 'Replicas un mes en los 12 y agregas solo lo que cambia.' }}</span>
          <span class="pt-1 text-sm font-semibold">{{ i.anual ? 'Abrir' : 'Empezar' }} ›</span>
        </a>

        @if (cerrados().length) {
          <section class="tarjeta px-4 py-1" aria-labelledby="cerrados">
            <h2 id="cerrados" class="pt-3 pb-1 text-sm font-semibold text-texto-medio">Meses cerrados</h2>
            @for (m of cerrados(); track m.clave) {
              <a [routerLink]="m.destino" class="flex items-center justify-between border-t border-divisor py-3" [attr.data-mes]="m.clave">
                <span class="text-[15px]">{{ m.nombre }}</span>
                <span class="text-sm font-semibold" [class]="(m.resumen.libre[0] ?? 0) < 0 ? 'text-negativo' : 'text-positivo'">{{ (m.resumen.libre[0] ?? 0) < 0 ? 'Faltó' : 'Sobró' }} {{ cop(m.resumen.libre[0] ?? 0) }} ›</span>
              </a>
            }
          </section>
        }
      }
    }
  `,
})
export class PlanearInicioPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);
  protected readonly inicio = consulta(() => null, (p) => p.plan.inicio());
  protected readonly escritorio = anchoEscritorio();
  protected readonly iniciales = INICIALES;
  protected readonly nombreMes = nombreMes;
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly mesActual = computed(() => mesDe(this.puertos.hoy()));
  /** El año que muestra la tarjeta cuando aun no hay plan anual: el siguiente al en curso, como `plan.inicio()`. */
  protected readonly anioSiguiente = computed(() => this.mesActual().anio + 1);

  /** "Octubre en curso · noviembre empieza en 6 días". */
  protected readonly subtitulo = computed(() => {
    const actual = this.mesActual();
    const siguiente = { anio: actual.mes === 12 ? actual.anio + 1 : actual.anio, mes: actual.mes === 12 ? 1 : actual.mes + 1 };
    return `${nombreMesCapital(actual.mes)} en curso · ${nombreMes(siguiente.mes)} ${this.empieza(siguiente).replace('Empieza ', 'empieza ')}`;
  });

  /** De los cerrados a los que vienen (canvas WPlanear). */
  protected readonly tarjetas = computed<TarjetaMes[]>(() => {
    const i = this.inicio.value();
    if (!i) return [];
    return [...i.recientes].reverse().concat(i.proximos).map((m) => this.tarjeta(m));
  });

  /** Móvil: el mes activo y los que vienen; los cerrados van en su lista. */
  protected readonly tarjetasMovil = computed(() => this.tarjetas().filter((m) => m.estado !== 'CERRADO'));
  protected readonly cerrados = computed(() => this.tarjetas().filter((m) => m.estado === 'CERRADO').reverse());
  protected readonly primeroSinPlan = computed(() => this.tarjetasMovil().find((m) => m.estado === 'SIN_PLAN' && !m.resumen.libre.length) ?? null);

  private readonly trae = consulta(
    () => this.primeroSinPlan()?.ref ?? null,
    (p, ref) => (ref ? p.plan.loQueTrae(ref) : Promise.resolve([])),
  );
  /** "la prima de $3.500.000 con su diezmo de $350.000, y el sobrante de noviembre cuando lo cierren". */
  protected readonly traeTexto = computed(() => {
    const lineas = this.trae.value() ?? [];
    const partes = lineas.map((l) => (l.monto === null ? `${l.nombre.toLowerCase()} ${l.detalle}`.trim() : `${l.nombre.toLowerCase()} de ${formatCop(Math.abs(l.monto))}`));
    if (!partes.length) return '';
    return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
  });

  protected cop(v: number): string {
    return formatCop(v);
  }

  protected anio(a: ResumenAnual): number {
    return a.anio;
  }

  protected estadoAnio(a: ResumenAnual | null): string {
    if (!a) return `Año ${this.anioSiguiente()} · sin plan`;
    return `Año ${a.anio} · ${a.estado === 'BORRADOR' ? 'borrador' : 'meses creados'}`;
  }

  protected barras(a: ResumenAnual): { alto: number; color: string }[] {
    const max = Math.max(1, ...a.libre);
    return a.libre.map((v) => ({
      alto: Math.max(4, Math.round((120 * Math.max(0, v)) / max)),
      color: v < APRETADO ? '#E8A496' : v >= max * 0.75 ? 'var(--color-acento)' : '#B9CBBE',
    }));
  }

  protected apretado(a: ResumenAnual): string {
    return `${nombreMesApretado(a)}, ${formatCop(a.kpis.mesApretado.libre)}`;
  }

  /** "Empieza en 6 días", "Empieza mañana", "Empieza hoy". */
  protected empieza(ref: MesRef): string {
    const dias = diasEntre(this.puertos.hoy(), `${ref.anio}-${String(ref.mes).padStart(2, '0')}-01`);
    if (dias <= 0) return 'Empieza hoy';
    return dias === 1 ? 'Empieza mañana' : `Empieza en ${dias} días`;
  }

  /** "noviembre · opción A": el mes anterior con plan, de donde copia. */
  protected copiaDe(ref: MesRef): string {
    const anterior = this.tarjetas().find((m) => m.ref.anio * 12 + m.ref.mes === ref.anio * 12 + ref.mes - 1);
    if (!anterior?.resumen.plan) return '';
    const letra = anterior.estado === 'ACTIVO' ? anterior.nota.replace('Opción ', '') : 'A';
    return `${nombreMes(anterior.ref.mes)} · opción ${letra}`;
  }

  protected async crear(ref: MesRef, modo: ModoNuevoMes): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.puertos.plan.crearMes(ref, modo);
      await this.router.navigate(['/planear', claveMes(ref)]);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  private nombre(ref: MesRef): string {
    return ref.anio === this.mesActual().anio ? nombreMesCapital(ref.mes) : `${nombreMesCapital(ref.mes)} ${ref.anio}`;
  }

  private tarjeta(m: ResumenMesPlan): TarjetaMes {
    const clave = claveMes(m.ref);
    const base = { clave, ref: m.ref, nombre: this.nombre(m.ref), estado: m.estado, resumen: m };
    const rango = m.libre.map((v) => formatCop(v)).join(' – ');
    switch (m.estado) {
      case 'CERRADO': {
        const v = m.libre[0] ?? 0;
        return { ...base, chip: 'Cerrado', claseChip: 'bg-hueco text-texto-medio', rotulo: v < 0 ? 'Faltó' : 'Sobró', valor: formatCop(Math.abs(v)), nota: '', accion: 'Ver cierre', destino: ['/planear', clave, 'cierre'] };
      }
      case 'ACTIVO':
        return { ...base, chip: 'Activo', claseChip: 'bg-acento-elegido text-acento', rotulo: 'Te queda libre', valor: rango || '—', nota: m.detalle.replace('Activo · ', ''), accion: 'Ver hoy ›', destino: ['/hoy'] };
      case 'BORRADOR': {
        const varias = m.opciones.length > 1;
        return {
          ...base, chip: 'Borrador', claseChip: 'bg-aviso-suave text-aviso',
          rotulo: varias ? `${m.opciones.length} opciones · dejarían` : 'Dejaría libre',
          valor: rango || '—',
          nota: varias ? `Elijan antes del 1 de ${nombreMes(m.ref.mes)}` : m.opciones[0]?.nota ?? '',
          accion: varias ? 'Comparar y elegir ›' : 'Ver plan ›',
          destino: varias ? ['/planear', clave, 'comparar'] : ['/planear', clave],
        };
      }
      default:
        return {
          ...base, chip: 'Sin plan', claseChip: 'shadow-[inset_0_0_0_1px_var(--color-borde-campo)] text-secundario',
          rotulo: m.libre.length ? `Saldrá del plan de ${m.ref.anio}` : 'Aún sin plan',
          valor: m.libre.length ? rango : '—',
          nota: m.libre.length ? 'Lo crean desde el plan del año' : 'Cópienlo de un mes o empiecen de cero',
          accion: 'Planear ›',
          destino: ['/planear', clave],
        };
    }
  }
}
