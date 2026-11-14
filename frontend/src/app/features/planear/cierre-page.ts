import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReglaError, claveMes, compararMes, formatCop, formatNumero, mesDe, nombreMes, nombreMesCapital, parseClaveMes, repartoValido, sumarMeses, type Pesos, type VistaCierre } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS, puertosConectados } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { anchoEscritorio } from '../../shared/escritorio';

/** Una fila de "Plan frente a lo real" en escritorio (CierreWeb.dc.html). */
interface FilaEscritorio {
  nombre: string;
  nota: string;
  plan: Pesos | null;
  real: Pesos;
  /** Real − plan; null si no hay plan. */
  diferencia: Pesos | null;
  tono: 'bien' | 'mal' | '';
  /** Porcentaje del plan usado, de 0 a 100. */
  uso: number;
  color: string;
  ingreso: boolean;
}

/** Un aviso de "Para tener en cuenta" (design D5 de web-escritorio-completo). */
interface Aviso {
  titulo: string;
  texto: string;
  bien: boolean;
}

const SIN_COLOR = '#C9C8C2';

/**
 * Cierre.dc.html: plan vs real por categoria, "Sin registrar" (los ajustes de cuadre) y el reparto del sobrante
 * entre ahorro y el mes siguiente. Cerrar deja el mes en solo lectura (spec steward-planear).
 * Desde 1024 px, CierreWeb.dc.html: la tabla con diferencia y uso, "Para tener en cuenta" y el reparto al lado.
 */
@Component({
  selector: 'app-cierre-page',
  imports: [RouterLink, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-[22px] px-9 pt-6 pb-10' : 'flex flex-col gap-[18px] px-5 pt-6 pb-4'" },
  template: `
    @if (escritorio()) {
      <!-- CierreWeb.dc.html: plan frente a lo real, "para tener en cuenta" y el reparto al lado (web-escritorio-completo). -->
      <a [routerLink]="volver()" class="boton-texto -my-2 self-start text-sm font-normal">‹ {{ nombreCapital() }}</a>
      @if (vista.value(); as v) {
        <div class="flex flex-col gap-1">
          <span class="rotulo">Cierre de mes{{ v.cerrado ? ' · cerrado' : '' }}</span>
          <h1 class="text-[28px] font-bold">{{ nombreCapital() }} {{ anio() }} terminó con
            <app-monto [class.text-acento]="v.sobrante >= 0" [class.text-negativo]="v.sobrante < 0" [valor]="v.sobrante" data-testid="sobrante" /></h1>
          <span class="text-sm text-secundario">El plan esperaba <app-monto [valor]="v.librePlaneado" /> libres ·
            @let mejor = v.sobrante - v.librePlaneado;
            <span class="font-semibold" [class]="mejor >= 0 ? 'text-positivo' : 'text-negativo'" data-testid="frente-al-plan"><app-monto [valor]="mejor" [signo]="true" /> {{ mejor >= 0 ? 'mejor' : 'menos' }} de lo planeado</span>
          </span>
        </div>

        <div class="flex flex-wrap items-start gap-5">
          <div class="flex min-w-0 flex-[2_1_600px] flex-col gap-5">
            <section class="tarjeta overflow-hidden" aria-labelledby="plan-real">
              <h2 id="plan-real" class="border-b border-divisor px-5 py-4 text-base font-semibold">Plan frente a lo real</h2>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[640px] border-collapse text-sm" data-testid="tabla-cierre">
                  <thead>
                    <tr class="bg-fondo text-[11px] font-semibold tracking-[0.06em] text-secundario">
                      <th scope="col" class="px-5 py-2.5 text-left"><span class="sr-only">Categoría</span></th>
                      <th scope="col" class="w-[120px] py-2.5 pr-3 text-right">PLAN</th>
                      <th scope="col" class="w-[120px] py-2.5 pr-3 text-right">REAL</th>
                      <th scope="col" class="w-[120px] py-2.5 pr-3 text-right">DIFERENCIA</th>
                      <th scope="col" class="py-2.5 pr-5 text-left">USO DEL PLAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (f of filasEscritorio(v); track f.nombre) {
                      <tr class="border-t border-divisor" [class.bg-[#FAFCFA]]="f.ingreso" [attr.data-fila]="f.nombre">
                        <th scope="row" class="px-5 py-[11px] text-left font-medium">
                          <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-[2px]" [style.background]="f.color" aria-hidden="true"></span>{{ f.nombre }}</span>
                          @if (f.nota) {
                            <span class="block text-xs font-normal text-secundario">{{ f.nota }}</span>
                          }
                        </th>
                        <td class="monto py-[11px] pr-3 text-right text-[13px] text-secundario">{{ f.plan === null ? '—' : cop(f.plan) }}</td>
                        <td class="monto py-[11px] pr-3 text-right text-[13px]">{{ cop(f.real) }}</td>
                        <td class="monto py-[11px] pr-3 text-right text-[13px] font-semibold" [class]="f.tono === 'bien' ? 'text-positivo' : f.tono === 'mal' ? 'text-negativo' : 'font-medium text-[#9A9C95]'" data-testid="diferencia">
                          {{ f.diferencia === null || f.diferencia === 0 ? '—' : copSigno(f.diferencia) }}
                        </td>
                        <td class="py-[11px] pr-5">
                          <div class="flex h-1.5 rounded-[3px] bg-[#EFEEEA]"><span class="rounded-[3px]" [style.width.%]="f.uso" [style.background]="f.tono === 'mal' ? 'var(--color-negativo)' : f.color"></span></div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            @if (avisos(v); as lista) {
              @if (lista.length) {
                <section class="tarjeta flex flex-col gap-3 px-5 py-[18px]" aria-labelledby="tener-en-cuenta" data-testid="tener-en-cuenta">
                  <h2 id="tener-en-cuenta" class="text-base font-semibold">Para tener en cuenta en {{ siguiente() }}</h2>
                  <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                    @for (a of lista; track a.titulo) {
                      <div class="flex flex-col gap-1 rounded-xl p-3.5" [class]="a.bien ? 'bg-acento-suave text-[#1F3328]' : 'bg-[#FBF7EC] text-[#6B4A00]'">
                        <span class="text-[13px] font-semibold">{{ a.titulo }}</span>
                        <span class="text-xs leading-[1.45]">{{ a.texto }}</span>
                      </div>
                    }
                  </div>
                </section>
              }
            }
          </div>

          <aside class="tarjeta flex min-w-0 flex-[1_1_320px] flex-col gap-4 p-5" aria-labelledby="que-hacemos">
            @if (v.cerrado) {
              <h2 id="que-hacemos" class="text-base font-semibold">Así se repartió</h2>
              <span class="flex justify-between text-sm">A ahorro <app-monto [valor]="v.aAhorro" /></span>
              <span class="flex justify-between text-sm">Pasó a {{ siguiente() }} <app-monto [valor]="v.aSiguiente" /></span>
              <span class="text-xs text-secundario">El mes está cerrado: queda en solo lectura.</span>
              <a [routerLink]="['/planear', mes()]" class="boton-texto text-sm">Ver el plan del mes</a>
            } @else {
              <div class="flex flex-col gap-1">
                <h2 id="que-hacemos" class="text-base font-semibold">¿Qué hacemos con lo que sobró?</h2>
                <span class="text-[13px] text-secundario">Reparte los <app-monto [valor]="v.sobrante" /> como quieran.</span>
              </div>
              @let total = (aAhorro() ?? 0) + (aSiguiente() ?? 0);
              <div class="flex h-3 overflow-hidden rounded-md bg-[#EFEEEA]" aria-hidden="true">
                <span class="bg-[#3B6EA8]" [style.width.%]="total ? (100 * (aAhorro() ?? 0)) / total : 0"></span>
                <span class="bg-acento" [style.width.%]="total ? (100 * (aSiguiente() ?? 0)) / total : 0"></span>
              </div>
              <div class="flex items-center justify-between gap-2.5 rounded-xl border border-[#E2E1DC] px-3.5 py-3">
                <span class="flex items-center gap-2 text-sm font-medium"><span class="h-2.5 w-2.5 rounded-[3px] bg-[#3B6EA8]" aria-hidden="true"></span>A ahorro</span>
                <app-monto-input class="w-[130px] [&_input]:h-[38px] [&_input]:rounded-[9px] [&_input]:px-2.5 [&_input]:text-right [&_input]:text-[13px]" [(valor)]="aAhorro" etiquetaAccesible="A ahorro" />
              </div>
              <div class="flex items-center justify-between gap-2.5 rounded-xl border border-[#E2E1DC] px-3.5 py-3">
                <span class="flex items-center gap-2 text-sm font-medium"><span class="h-2.5 w-2.5 rounded-[3px] bg-acento" aria-hidden="true"></span>Pasar a {{ siguiente() }}</span>
                <app-monto-input class="w-[130px] [&_input]:h-[38px] [&_input]:rounded-[9px] [&_input]:px-2.5 [&_input]:text-right [&_input]:text-[13px]" [(valor)]="aSiguiente" [etiquetaAccesible]="'Pasar a ' + siguiente()" />
              </div>
              <div class="flex justify-between border-t border-divisor pt-1 text-[13px]">
                <span class="text-secundario">Sin asignar</span>
                @let sinAsignar = Math.max(0, v.sobrante) - total;
                <app-monto class="font-semibold" [class]="sinAsignar === 0 ? 'text-positivo' : 'text-negativo'" [valor]="sinAsignar" [siempreVisible]="true" data-testid="sin-asignar" />
              </div>
              <span class="text-xs leading-normal text-secundario">Lo que pasa a {{ siguiente() }} aparece como ingreso "Sobrante de {{ nombreMin() }}" en todas sus opciones.</span>
              @if (error()) {
                <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
              }
              @if (puedeCerrar()) {
                <button type="button" class="boton h-[46px] rounded-xl bg-acento text-white" [disabled]="!valido() || guardando()" (click)="cerrar()">Cerrar {{ nombreMin() }}</button>
                <span class="text-center text-xs text-secundario">Queda en solo lectura.</span>
              } @else {
                <p class="text-xs text-secundario" data-testid="cierre-futuro">{{ nombreCapital() }} se cierra cuando llegue.</p>
              }
            }
          </aside>
        </div>
      }
    } @else {
    <a [routerLink]="volver()" class="boton-texto -my-2 self-start text-sm font-normal">‹ {{ nombreCapital() }}</a>

    @if (vista.value(); as v) {
      <div class="flex flex-col gap-1.5">
        <span class="rotulo">Cierre de mes{{ v.cerrado ? ' · cerrado' : '' }}</span>
        <h1 class="text-[26px] font-bold">{{ nombreCapital() }} terminó con</h1>
        <app-monto class="text-[34px] font-semibold" [class.text-acento]="v.sobrante >= 0" [class.text-negativo]="v.sobrante < 0" [valor]="v.sobrante" data-testid="sobrante" />
        <span class="text-sm text-secundario">El plan esperaba {{ cop(v.librePlaneado) }} libres.</span>
      </div>

      <div class="rounded-[14px] border border-borde bg-superficie px-4 py-1.5">
        <table class="w-full border-collapse text-sm" data-testid="tabla-cierre">
          <thead>
            <tr class="border-b border-divisor text-[11px] font-semibold tracking-[0.06em] text-secundario">
              <th scope="col" class="py-2.5 text-left"><span class="sr-only">Categoría</span></th>
              <th scope="col" class="w-[84px] py-2.5 text-right">PLAN</th>
              <th scope="col" class="w-[84px] py-2.5 text-right">REAL</th>
            </tr>
          </thead>
          <tbody>
            @for (f of v.filas; track f.nombre; let primero = $first) {
              <tr class="border-b border-divisor">
                <th scope="row" class="py-2.5 text-left" [class.font-semibold]="primero" [class.font-normal]="!primero">{{ f.nombre }}</th>
                <td class="monto py-2.5 text-right text-xs text-secundario">{{ f.plan === null ? '—' : numero(f.plan) }}</td>
                <td class="monto py-2.5 text-right text-xs" [class]="tonoReal(f.plan, f.real, primero)">{{ numero(f.real) }}</td>
              </tr>
            }
            <tr>
              <th scope="row" class="py-2.5 text-left font-normal">Sin registrar<span class="block text-[11px] text-secundario">de cuadrar cuentas</span></th>
              <td class="monto py-2.5 text-right text-xs text-secundario">—</td>
              <td class="monto py-2.5 text-right text-xs">{{ numero(v.sinRegistrar) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      @if (v.cerrado) {
        <div class="nota">
          <span class="text-[13px] font-semibold">Así se repartió</span>
          <span class="flex justify-between text-sm">A ahorro <app-monto [valor]="v.aAhorro" /></span>
          <span class="flex justify-between text-sm">Pasó a {{ siguiente() }} <app-monto [valor]="v.aSiguiente" /></span>
          <span class="text-xs text-secundario">El mes está cerrado: queda en solo lectura.</span>
          <a [routerLink]="['/planear', mes()]" class="boton-texto text-sm">Ver el plan del mes</a>
        </div>
      } @else {
        <div class="flex flex-col gap-2.5">
          <h2 class="text-base font-semibold">¿Qué hacemos con lo que sobró?</h2>
          <div class="flex items-center justify-between gap-3 rounded-xl border-2 border-acento bg-acento-suave px-4 py-2.5">
            <span class="text-[15px] font-medium" id="a-ahorro">A ahorro</span>
            <app-monto-input class="w-40" [(valor)]="aAhorro" etiquetaAccesible="A ahorro" />
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border-2 border-acento bg-acento-suave px-4 py-2.5">
            <span class="text-[15px] font-medium" id="a-siguiente">Pasar a {{ siguiente() }}</span>
            <app-monto-input class="w-40" [(valor)]="aSiguiente" [etiquetaAccesible]="'Pasar a ' + siguiente()" />
          </div>
          @if (!valido()) {
            <p class="text-xs text-aviso" data-testid="aviso-reparto">El reparto debe sumar {{ cop(v.sobrante) }} (va en {{ cop((aAhorro() ?? 0) + (aSiguiente() ?? 0)) }}).</p>
          }
        </div>
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        @if (puedeCerrar()) {
          <button type="button" class="boton-grande" [disabled]="!valido() || guardando()" (click)="cerrar()">Cerrar {{ nombreMin() }}</button>
        } @else {
          <!-- Modo conectado: un mes futuro no se cierra (spec steward-planear). -->
          <p class="text-xs text-secundario" data-testid="cierre-futuro">{{ nombreCapital() }} se cierra cuando llegue.</p>
        }
      }
    }
    }
  `,
})
export class CierrePage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);
  protected readonly escritorio = anchoEscritorio();
  protected readonly Math = Math;
  private readonly categorias = consulta(() => null, (p) => p.hogar.categorias());

  /** Parametro de la ruta (`/planear/:mes/cierre`). */
  readonly mes = input.required<string>();
  private readonly ref = computed(() => parseClaveMes(this.mes()) ?? mesDe(this.puertos.hoy()));
  protected readonly nombreCapital = computed(() => nombreMesCapital(this.ref().mes));
  protected readonly nombreMin = computed(() => nombreMes(this.ref().mes));
  protected readonly anio = computed(() => this.ref().anio);
  protected readonly siguiente = computed(() => nombreMes(sumarMeses(this.ref(), 1).mes));
  private readonly conectado = puertosConectados(this.puertos) !== null;
  protected readonly puedeCerrar = computed(() => !this.conectado || compararMes(this.ref(), mesDe(this.puertos.hoy())) <= 0);
  protected readonly volver = computed(() => (claveMes(this.ref()) === claveMes(mesDe(this.puertos.hoy())) ? '/hoy' : '/planear'));

  protected readonly vista = consulta(() => this.ref(), (p, ref) => p.cierre.vista(ref));
  protected readonly aAhorro = signal<number | null>(null);
  protected readonly aSiguiente = signal<number | null>(0);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  private readonly reproponer = signal(false);
  private propuesto: number | null = null;
  protected readonly valido = computed(() => {
    const v = this.vista.value();
    return Boolean(v) && repartoValido(v!.sobrante, this.aAhorro() ?? 0, this.aSiguiente() ?? 0);
  });

  constructor() {
    // Por defecto todo lo que sobro va a ahorro; se ajusta moviendo una parte al mes siguiente.
    // Si el cierre estaba desactualizado, se vuelve a proponer cuando llegue la vista con el sobrante nuevo.
    effect(() => {
      const v = this.vista.value();
      if (!v || v.cerrado) return;
      if (this.aAhorro() === null || (this.reproponer() && v.sobrante !== this.propuesto)) {
        this.propuesto = v.sobrante;
        this.reproponer.set(false);
        this.aAhorro.set(Math.max(0, v.sobrante));
        this.aSiguiente.set(0);
      }
    });
  }

  protected numero(v: number): string {
    return formatNumero(v);
  }

  protected cop(v: number): string {
    return formatCop(v);
  }

  protected copSigno(v: number): string {
    return formatCop(v, { signo: true });
  }

  /** Filas de la tabla de escritorio: la primera es Ingresos; al final, "Sin registrar". */
  protected filasEscritorio(v: VistaCierre): FilaEscritorio[] {
    const colores = new Map((this.categorias.value() ?? []).map((c) => [c.nombre, c.color]));
    const filas = v.filas.map((f, i): FilaEscritorio => {
      const ingreso = i === 0;
      const diferencia = f.plan === null ? f.real || null : f.real - f.plan;
      const arriba = (diferencia ?? 0) > 0;
      const tono = !diferencia ? '' : ingreso === arriba ? 'bien' : 'mal';
      const uso = f.plan ? Math.min(100, Math.round((100 * f.real) / f.plan)) : 0;
      const color = ingreso ? 'var(--color-positivo)' : (colores.get(f.nombre) ?? SIN_COLOR);
      return { nombre: f.nombre, nota: '', plan: f.plan, real: f.real, diferencia, tono, uso, color, ingreso };
    });
    const sin = v.sinRegistrar;
    filas.push({ nombre: 'Sin registrar', nota: 'De cuadrar cuentas', plan: null, real: sin, diferencia: sin || null, tono: sin > 0 ? 'mal' : '', uso: 0, color: SIN_COLOR, ingreso: false });
    return filas;
  }

  /** Lo sin registrar, los gastos que pasaron su plan y la diferencia de ingresos (design D5). */
  protected avisos(v: VistaCierre): Aviso[] {
    const avisos: Aviso[] = [];
    if (v.sinRegistrar > 0) avisos.push({ titulo: `${formatCop(v.sinRegistrar)} sin registrar`, texto: 'Salió de cuadrar cuentas. Si se repite, súmalo a Variables.', bien: false });
    for (const f of v.filas.slice(1)) {
      if (f.plan !== null && f.real > f.plan) avisos.push({ titulo: `${f.nombre} ${formatCop(f.real - f.plan, { signo: true })}`, texto: 'Se pasó del plan este mes.', bien: false });
    }
    const ingresos = v.filas[0];
    const dif = ingresos && ingresos.plan !== null ? ingresos.real - ingresos.plan : 0;
    if (dif) avisos.push({ titulo: `Ingresos ${formatCop(dif, { signo: true })}`, texto: dif > 0 ? 'Entró más de lo planeado.' : 'Entró menos de lo planeado.', bien: dif > 0 });
    return avisos;
  }

  /** Ingresos por encima del plan en verde; un gasto por encima de su plan en rojo. */
  protected tonoReal(plan: number | null, real: number, esIngreso: boolean): string {
    if (plan === null) return '';
    if (esIngreso) return real >= plan ? 'text-positivo' : 'text-negativo';
    return real > plan ? 'text-negativo' : '';
  }

  protected async cerrar(): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      // El mes siguiente se calcula antes: tras cerrar, la vista se recarga y su valor no esta mientras tanto.
      const siguiente = claveMes(sumarMeses(this.ref(), 1));
      await this.puertos.cierre.cerrar(this.ref(), { aAhorro: this.aAhorro() ?? 0, aSiguiente: this.aSiguiente() ?? 0 });
      await this.router.navigate(['/planear', siguiente]);
    } catch (e) {
      this.error.set(mensajeDeError(e));
      // Las cifras ya se recalcularon: el reparto vuelve a proponerse con el sobrante nuevo.
      if (e instanceof ReglaError && e.codigo === 'CIERRE_DESACTUALIZADO') this.reproponer.set(true);
    } finally {
      this.guardando.set(false);
    }
  }
}
