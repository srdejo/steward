import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatCop, formatFechaCorta, mesDe, type FiltroTitular, type Id, type MovimientoCuenta } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Avatar } from '../../shared/components/avatar';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';
import { anchoEscritorio } from '../../shared/escritorio';
import { CreditosTab } from './creditos-tab';
import { EstadoCuadre } from './estado-cuadre';
import { FiltroTitularComponent } from './filtro-titular';
import { TarjetasTab } from './tarjetas-tab';

const CONJUNTA = '__conjunta__';
/** Movimientos que se ven en "Movimientos recientes" (design D4 de web-escritorio-completo). */
const RECIENTES = 20;

type Pestana = 'cuentas' | 'tarjetas' | 'creditos';
/** Un movimiento con la cuenta en la que se ve; `transferencia`: una transferencia mostrada una sola vez. */
interface MovimientoReciente extends MovimientoCuenta {
  cuentaId: Id;
  transferencia: boolean;
}

/** Color de cada cuenta en las listas (canvas Libreta clara), en el orden en que se crearon. */
const COLORES_CUENTA = ['#C2603A', '#6B5BA8', '#3F6E9E', '#8A8D85', '#2F7A4F', '#2C7A70'];
/** Subtitulo de cada pestaña en web (canvas WCuentas). */
const SUBTITULO: Record<Pestana, string> = {
  cuentas: 'Lo que hay, aproximado · cuadras cuando quieras',
  tarjetas: 'Pagan el valor del extracto · el uso de cada tarjeta es su etiqueta',
  creditos: 'Cada cuota baja sola según la tasa o el plan de pagos',
};

/**
 * Cuentas.dc.html: pestañas Cuentas, Tarjetas y Créditos (spec steward-cuentas, tarjetas-y-creditos); la pestaña va en
 * `?pestana=`. Cuentas tiene el saldo del hogar estimado y las cuentas con titular y cuadre; desde 1024 px
 * (CuentasWeb.dc.html), el cuadre en tabla, los movimientos recientes del hogar y los resumenes de tarjetas y creditos.
 */
@Component({
  selector: 'app-cuentas-page',
  imports: [NgTemplateOutlet, RouterLink, Avatar, Hoja, Monto, MontoInput, Segmentado, FiltroTitularComponent, TarjetasTab, CreditosTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-5 px-8 pt-7 pb-12' : 'flex flex-col gap-5 px-5 pt-6 pb-4'" },
  template: `
    @if (escritorio()) {
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <span class="text-[13px] text-secundario" data-testid="cuentas-sub">{{ subtitulo() }}</span>
          <h1 class="titular text-[32px] font-bold">Cuentas</h1>
        </div>
        <div class="flex flex-wrap gap-2">
          @switch (pestana()) {
            @case ('tarjetas') {
              <button type="button" class="boton-secundario h-[42px] rounded-control px-4 text-sm" (click)="tabTarjetas()?.abrir(null)">+ Agregar tarjeta</button>
            }
            @case ('creditos') {
              <button type="button" class="boton-secundario h-[42px] rounded-control px-4 text-sm" (click)="tabCreditos()?.nuevo?.set(true)">+ Agregar crédito</button>
            }
            @default {
              <button type="button" class="boton-secundario h-[42px] rounded-control px-4 text-sm" (click)="hoja.set('mover')">Mover dinero</button>
              <button type="button" class="boton-secundario h-[42px] rounded-control px-4 text-sm" (click)="hoja.set('agregar')">+ Agregar cuenta</button>
            }
          }
        </div>
      </div>
      <div role="tablist" aria-label="Cuentas, tarjetas y créditos" class="flex gap-1 border-b border-[#E2DFD8]">
        @for (t of pestanas; track t.valor) {
          <button type="button" role="tab" [attr.aria-selected]="pestana() === t.valor" class="flex h-11 items-center px-4 text-[15px]"
            [class]="pestana() === t.valor ? 'font-semibold text-texto shadow-[inset_0_-2px_0_var(--color-acento)]' : 'font-medium text-secundario'" (click)="elegirPestana(t.valor)">{{ t.etiqueta }}
            @if (t.valor === 'tarjetas' && tarjetas.value()?.pagoPronto; as p) {
              <span class="ml-2 rounded-full bg-aviso-suave px-2 py-0.5 text-[11px] font-semibold text-aviso" data-testid="pago-pronto">{{ textoPagoPronto(p.dias) }}</span>
            }
          </button>
        }
      </div>
    } @else {
      <h1 class="titular px-1 text-[28px] font-bold">Cuentas</h1>
      <div role="tablist" aria-label="Cuentas, tarjetas y créditos" class="grid grid-cols-3 gap-1 rounded-control bg-hueco p-1">
        @for (t of pestanas; track t.valor) {
          <button type="button" role="tab" [attr.aria-selected]="pestana() === t.valor" class="flex h-10 items-center justify-center rounded-[9px] text-sm text-texto"
            [class]="pestana() === t.valor ? 'bg-superficie font-semibold' : 'font-medium'" (click)="elegirPestana(t.valor)">{{ t.etiqueta }}
            @if (t.valor === 'tarjetas' && tarjetas.value()?.pagoPronto; as p) {
              <span class="ml-1.5 rounded-full bg-negativo-suave px-1.5 py-0.5 text-[10px] font-bold text-negativo" data-testid="pago-pronto">{{ textoPagoPronto(p.dias) }}</span>
            }
          </button>
        }
      </div>
    }

    @switch (pestana()) {
    @case ('tarjetas') {
      <app-tarjetas-tab [escritorio]="escritorio()" />
    }
    @case ('creditos') {
      <app-creditos-tab [escritorio]="escritorio()" />
    }
    @default {
    @if (escritorio()) {
      <!-- Canvas Libreta clara (WCuentas): indicadores, cuadre y movimientos recientes al lado. -->
      <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <div class="flex flex-col gap-1 rounded-[18px] bg-acento px-5 py-4 text-white">
          <span class="text-[13px] text-[#CFE0D6]">Plata del hogar</span>
          <span class="titular text-[26px] font-bold" data-testid="saldo-hogar">≈ {{ cop(todas.value()?.total ?? 0) }}</span>
          <span class="text-xs text-[#CFE0D6]">{{ notaCuadradas() }}</span>
        </div>
        <div class="flex flex-col gap-1 rounded-[18px] bg-superficie px-5 py-4">
          <span class="text-[13px] text-secundario">Después de pagar lo pendiente</span>
          <span class="titular text-[26px] font-bold" data-testid="despues-de-pagar">≈ {{ cop((todas.value()?.total ?? 0) - faltaPagar()) }}</span>
          <span class="text-xs text-secundario">Faltan {{ cop(faltaPagar()) }} este mes</span>
        </div>
        <div class="flex flex-col gap-1 rounded-[18px] bg-superficie px-5 py-4">
          <span class="text-[13px] text-secundario">Sin registrar al cuadrar</span>
          <app-monto class="titular text-[26px] font-bold text-aviso" [valor]="cuadre.sinRegistrar()" [siempreVisible]="true" data-testid="sin-registrar" />
          <span class="text-xs text-secundario">Pasa al cierre como gasto</span>
        </div>
      </div>

      <div class="flex flex-wrap items-start gap-5">
        <section class="min-w-0 flex-[3_1_640px] overflow-x-auto rounded-[18px] bg-superficie" aria-labelledby="titulo-cuadre" data-testid="tabla-cuadre">
          <div class="min-w-[680px]">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-divisor px-6 py-3.5">
              <h2 id="titulo-cuadre" class="text-[15px] font-semibold">Cuadrar</h2>
              <span class="text-[13px] text-secundario">Escribe lo que dice el banco. No hace falta buscar cada movimiento.</span>
            </div>
            <div class="px-6 pt-3"><app-filtro-titular [(valor)]="filtro" /></div>
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-left text-xs text-secundario">
                  <th scope="col" class="px-6 py-2.5 font-normal">Cuenta</th>
                  <th scope="col" class="w-[140px] py-2.5 pr-3 text-right font-normal">La app calcula</th>
                  <th scope="col" class="w-[170px] py-2.5 pr-3 text-right font-normal">El banco dice</th>
                  <th scope="col" class="w-[120px] py-2.5 pr-3 text-right font-normal">Diferencia</th>
                  <th scope="col" class="w-[110px] py-2.5 pr-6"><span class="sr-only">Estado</span></th>
                </tr>
              </thead>
              <tbody>
                @for (c of datos.value()?.cuentas ?? []; track c.cuenta.id) {
                  <tr class="border-t border-fondo" [attr.data-cuenta]="c.cuenta.nombre">
                    <th scope="row" class="px-6 py-2.5 text-left font-normal">
                      <span class="flex min-w-0 items-center gap-2.5">
                        <span class="size-2.5 shrink-0 rounded-[3px]" [style.background]="colorCuenta(c.cuenta.id)" aria-hidden="true"></span>
                        <span class="flex min-w-0 flex-col">
                          <a [routerLink]="['/cuentas/cuenta', c.cuenta.id]" class="text-sm font-semibold hover:underline">{{ c.cuenta.nombre }}</a>
                          <span class="text-xs" [class]="c.aviso ? 'text-aviso' : 'text-secundario'">{{ c.titular }} · {{ c.estadoCuadre }}</span>
                        </span>
                      </span>
                    </th>
                    <td class="py-2.5 pr-3 text-right text-sm text-secundario">{{ c.estimado ? '≈ ' : '' }}<app-monto [valor]="c.saldo" /></td>
                    <td class="py-2 pr-3">
                      <app-monto-input class="[&_input]:h-10 [&_input]:rounded-[10px] [&_input]:px-2.5 [&_input]:text-right [&_input]:text-sm" [etiquetaAccesible]="'Saldo en el banco de ' + c.cuenta.nombre"
                        [placeholder]="c.aviso ? 'Opcional' : ''" [valor]="cuadre.saldos()[c.cuenta.id] ?? null" (valorChange)="cuadre.poner(c.cuenta.id, $event)" />
                    </td>
                    <td class="py-2.5 pr-3 text-right text-sm font-semibold" data-testid="diferencia">
                      @let d = cuadre.diferencia(c);
                      @if (d === null) {
                        <span class="text-[#A5A79F]">—</span>
                      } @else if (d === 0) {
                        <span class="text-positivo">Cuadra</span>
                      } @else {
                        <app-monto [class.text-negativo]="d > 0" [class.text-positivo]="d < 0" [valor]="-d" [signo]="true" [siempreVisible]="true" />
                      }
                    </td>
                    <td class="py-2.5 pr-6 text-right">
                      <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="c.estimado ? 'bg-aviso-suave text-aviso' : 'bg-acento-elegido text-acento'">{{ c.estimado ? 'Aproximada' : 'Cuadrada' }}</span>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-6 py-3 text-secundario">No hay cuentas{{ filtro() === 'TODAS' ? '' : ' con ese titular' }}.</td></tr>
                }
              </tbody>
            </table>
            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-divisor px-6 py-3.5">
              <span class="text-[13px] text-texto-medio">Las diferencias se guardan como “Sin registrar”. Una cuenta sin cuadrar puede quedar aproximada.</span>
              @if (cuadre.error()) {
                <p role="alert" class="text-sm text-negativo">{{ cuadre.error() }}</p>
              }
              <button type="button" class="boton-primario h-10 rounded-[10px] px-4 text-sm" [disabled]="!cuadre.hayValores() || cuadre.guardando()" (click)="cuadre.guardar()">Guardar cuadre</button>
            </div>
          </div>
        </section>

        <aside class="flex min-w-0 flex-[1_1_320px] flex-col gap-1 rounded-[18px] bg-superficie px-5 py-[18px]" aria-labelledby="titulo-movimientos" data-testid="movimientos-recientes">
          <div class="mb-1.5 flex items-center justify-between gap-3">
            <h2 id="titulo-movimientos" class="text-[15px] font-semibold">Movimientos recientes</h2>
            <select class="h-8 rounded-lg border border-borde bg-superficie px-2 text-xs font-medium text-texto" aria-label="Cuenta" (change)="cuentaMovs.set($any($event.target).value)">
              <option value="" [selected]="!cuentaMovs()">Todas</option>
              @for (c of todas.value()?.cuentas ?? []; track c.cuenta.id) {
                <option [value]="c.cuenta.id" [selected]="cuentaMovs() === c.cuenta.id">{{ c.cuenta.nombre }}</option>
              }
            </select>
          </div>
          @for (m of movimientosVisibles(); track m.movimiento.id + m.cuentaId) {
            <ng-container *ngTemplateOutlet="filaMovimiento; context: { $implicit: m }" />
          } @empty {
            <p class="border-t border-divisor py-2.5 text-sm text-secundario">Sin movimientos desde el último cuadre.</p>
          }
        </aside>
      </div>
    } @else {
    @if (datos.value(); as d) {
      <section class="flex flex-col gap-3.5 rounded-panel bg-superficie p-[18px]">
        <span class="flex flex-col gap-1">
          <span class="text-[13px] text-secundario">Saldo del hogar · estimado</span>
          <span class="titular text-[34px] font-bold tracking-[-0.02em]" data-testid="saldo-hogar">≈ {{ cop(todas.value()?.total ?? d.total) }}</span>
        </span>
        <div class="grid grid-cols-2 gap-2">
          <a routerLink="/cuentas/cuadrar" class="boton-primario h-[46px] rounded-control text-sm">Cuadrar</a>
          <button type="button" class="boton-secundario h-[46px] rounded-control text-sm" (click)="hoja.set('mover')">Mover dinero</button>
        </div>
      </section>

      <section class="tarjeta px-4 py-1" aria-label="Cuentas">
        <div class="pt-3 pb-1"><app-filtro-titular [(valor)]="filtro" /></div>
        @for (c of d.cuentas; track c.cuenta.id) {
          <a [routerLink]="['/cuentas/cuenta', c.cuenta.id]" class="flex items-center gap-3 border-b border-divisor py-3" [attr.data-cuenta]="c.cuenta.nombre">
            <span class="size-2.5 shrink-0 rounded-[3px]" [style.background]="colorCuenta(c.cuenta.id)" aria-hidden="true"></span>
            <span class="flex min-w-0 grow flex-col gap-0.5">
              <span class="text-[15px] font-medium">{{ c.cuenta.nombre }}</span>
              <span class="text-xs" [class]="c.aviso ? 'text-aviso' : 'text-secundario'">{{ c.titular }} · {{ c.estadoCuadre }}</span>
            </span>
            <span class="text-[15px] font-semibold" [class]="c.estimado ? 'text-secundario' : 'text-texto'">{{ c.estimado ? '≈ ' : '' }}<app-monto [valor]="c.saldo" /></span>
          </a>
        } @empty {
          <p class="border-b border-divisor py-2.5 text-sm text-secundario">No hay cuentas{{ filtro() === 'TODAS' ? '' : ' con ese titular' }}.</p>
        }
        <button type="button" class="h-11 text-sm font-semibold text-acento" (click)="hoja.set('agregar')">+ Cuenta</button>
      </section>

      <section class="tarjeta px-4 py-1" aria-labelledby="titulo-movimientos" data-testid="movimientos-recientes">
        <h2 id="titulo-movimientos" class="pt-3 pb-1 text-sm font-semibold text-texto-medio">Movimientos recientes</h2>
        @for (m of movimientosVisibles().slice(0, 4); track m.movimiento.id + m.cuentaId) {
          <ng-container *ngTemplateOutlet="filaMovimiento; context: { $implicit: m }" />
        } @empty {
          <p class="border-t border-divisor py-2.5 text-sm text-secundario">Sin movimientos desde el último cuadre.</p>
        }
      </section>
    }
    }
    }
    }

    <ng-template #filaMovimiento let-m>
      <a [routerLink]="m.corregible ? ['/cuentas/cuenta', m.cuentaId, 'registro', m.movimiento.id] : ['/cuentas/cuenta', m.cuentaId]"
        class="flex items-start gap-2.5 border-t border-divisor py-2.5 hover:bg-fondo" data-testid="movimiento">
        <app-avatar [inicial]="miembros.inicialDe(m.movimiento.usuarioId)" [variante]="miembros.varianteDe(m.movimiento.usuarioId)" [tamano]="28" [nombre]="miembros.nombreDe(m.movimiento.usuarioId)" />
        <span class="flex min-w-0 grow flex-col">
          <span class="truncate text-sm font-medium">{{ m.descripcion }}</span>
          <span class="truncate text-xs text-secundario">{{ fecha(m.movimiento.fecha) }} · {{ m.movimiento.nota && m.movimiento.nota !== m.descripcion ? m.movimiento.nota : nombreCuenta(m.cuentaId) }}</span>
        </span>
        <app-monto class="text-sm font-semibold whitespace-nowrap" [class.text-positivo]="m.efecto > 0 && !m.transferencia" [class.text-secundario]="m.transferencia" [valor]="m.transferencia ? -m.efecto : m.efecto" [signo]="!m.transferencia" />
      </a>
    </ng-template>

    @if (hoja() === 'agregar') {
      <app-hoja titulo="Nueva cuenta" (cerrar)="cerrarHoja()">
        <label class="flex flex-col gap-2">
          <span class="rotulo">Nombre</span>
          <input class="campo" placeholder="Ej: Bancolombia" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
        </label>
        <app-segmentado etiqueta="Titular" [chips]="true" [opciones]="titulares()" [(valor)]="titular" />
        <app-monto-input etiqueta="Saldo aproximado" [(valor)]="saldo" />
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="!nombre().trim() || saldo() === null || ocupado()" (click)="agregar()">Agregar cuenta</button>
      </app-hoja>
    }

    @if (hoja() === 'mover') {
      <app-hoja titulo="Mover dinero" (cerrar)="cerrarHoja()">
        <app-segmentado etiqueta="Desde" [chips]="true" [opciones]="opcionesCuenta()" [(valor)]="desde" />
        <app-segmentado etiqueta="Hacia" [chips]="true" [opciones]="opcionesCuenta()" [(valor)]="hacia" />
        <app-monto-input etiqueta="¿Cuánto?" [grande]="true" [(valor)]="saldo" />
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="!desde() || !hacia() || !saldo() || ocupado()" (click)="mover()">Mover</button>
      </app-hoja>
    }
  `,
})
export class CuentasPage {
  private readonly puertos = inject(PUERTOS);
  protected readonly miembros = inject(MiembrosHogar);
  protected readonly escritorio = anchoEscritorio();

  protected readonly filtro = signal<FiltroTitular>('TODAS');
  protected readonly datos = consulta(() => this.filtro(), (p, f) => p.cuentas.cuentas(f));
  protected readonly todas = consulta(() => null, (p) => p.cuentas.cuentas());
  protected readonly cuadre = new EstadoCuadre(this.puertos, computed(() => this.todas.value()?.cuentas));

  private readonly router = inject(Router);
  protected readonly pestanas: { valor: Pestana; etiqueta: string }[] = [
    { valor: 'cuentas', etiqueta: 'Cuentas' },
    { valor: 'tarjetas', etiqueta: 'Tarjetas' },
    { valor: 'creditos', etiqueta: 'Créditos' },
  ];
  /** `?pestana=tarjetas|creditos` (los enlaces de otras pantallas abren la pestaña); sin el parametro, Cuentas. */
  readonly pestanaRuta = input<string | undefined>(undefined, { alias: 'pestana' });
  protected readonly pestana = linkedSignal<Pestana>(() => (['tarjetas', 'creditos'].includes(this.pestanaRuta() ?? '') ? (this.pestanaRuta() as Pestana) : 'cuentas'));
  protected readonly tarjetas = consulta(() => null, (p) => p.tarjetas.vista());
  /** La tarjeta que se paga mas pronto, para el resumen de escritorio. */
  protected readonly subtitulo = computed(() => SUBTITULO[this.pestana()]);
  protected readonly tabTarjetas = viewChild(TarjetasTab);
  protected readonly tabCreditos = viewChild(CreditosTab);
  /** Lo que falta pagar del mes en curso: "Después de pagar lo pendiente". */
  private readonly resumenMes = consulta(() => (this.escritorio() ? mesDe(this.puertos.hoy()) : null), (p, ref) => (ref ? p.movimientos.resumenMes(ref) : Promise.resolve(null)));
  protected readonly faltaPagar = computed(() => this.resumenMes.value()?.faltaPagar ?? 0);
  /** "4 cuentas · 3 cuadradas hoy". */
  protected readonly notaCuadradas = computed(() => {
    const cuentas = this.todas.value()?.cuentas ?? [];
    const hoy = cuentas.filter((c) => c.estadoCuadre === 'cuadrada hoy').length;
    return `${cuentas.length} ${cuentas.length === 1 ? 'cuenta' : 'cuentas'} · ${hoy} ${hoy === 1 ? 'cuadrada' : 'cuadradas'} hoy`;
  });

  /** Cuenta elegida en "Movimientos recientes"; vacio = todas. */
  protected readonly cuentaMovs = signal<Id | ''>('');
  /** Los movimientos de cada cuenta (design D4); en móvil se ven los 4 más recientes. */
  private readonly porCuenta = consulta(
    () => (this.todas.value()?.cuentas ?? []).map((c) => c.cuenta.id),
    async (p, ids) => {
      if (!ids) return [];
      const listas = await Promise.all(ids.map(async (id) => (await p.cuentas.movimientos(id)).map((m) => ({ ...m, cuentaId: id, transferencia: false }))));
      return listas.flat();
    },
  );
  /** Del mas reciente al mas antiguo. Con todas las cuentas, una transferencia se ve una vez, con su cuenta de origen. */
  protected readonly movimientosVisibles = computed<MovimientoReciente[]>(() => {
    const todos = this.porCuenta.value() ?? [];
    const cuenta = this.cuentaMovs();
    let lista: MovimientoReciente[];
    if (cuenta) {
      lista = todos.filter((m) => m.cuentaId === cuenta);
    } else {
      const unicos = new Map<Id, MovimientoReciente>();
      for (const m of todos) {
        const previo = unicos.get(m.movimiento.id);
        if (!previo) unicos.set(m.movimiento.id, m);
        else unicos.set(m.movimiento.id, { ...(previo.efecto < 0 ? previo : m), transferencia: true });
      }
      lista = [...unicos.values()];
    }
    return lista.sort((a, b) => b.movimiento.seq - a.movimiento.seq).slice(0, RECIENTES);
  });

  protected readonly hoja = signal<'agregar' | 'mover' | null>(null);
  protected readonly nombre = signal('');
  protected readonly titular = signal<string | null>(CONJUNTA);
  protected readonly saldo = signal<number | null>(null);
  protected readonly desde = signal<Id | null>(null);
  protected readonly hacia = signal<Id | null>(null);
  protected readonly error = signal('');
  protected readonly ocupado = signal(false);

  protected readonly titulares = computed<Opcion<string>[]>(() => [
    ...this.miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre })),
    { valor: CONJUNTA, etiqueta: 'Conjunta' },
  ]);
  protected readonly opcionesCuenta = computed<Opcion<Id>[]>(() => (this.todas.value()?.cuentas ?? []).map((c) => ({ valor: c.cuenta.id, etiqueta: c.cuenta.nombre })));

  protected elegirPestana(p: Pestana): void {
    this.pestana.set(p);
    void this.router.navigate([], { queryParams: { pestana: p === 'cuentas' ? null : p }, replaceUrl: true });
  }

  protected cop(v: number): string {
    return formatCop(v);
  }

  protected colorCuenta(id: Id): string {
    const i = (this.todas.value()?.cuentas ?? []).findIndex((c) => c.cuenta.id === id);
    return COLORES_CUENTA[Math.max(0, i) % COLORES_CUENTA.length]!;
  }

  /** "2 días", "1 día", "hoy". */
  protected textoPagoPronto(dias: number): string {
    return dias === 0 ? 'hoy' : dias === 1 ? '1 día' : `${dias} días`;
  }

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected nombreCuenta(id: Id): string {
    return this.todas.value()?.cuentas.find((c) => c.cuenta.id === id)?.cuenta.nombre ?? '';
  }

  protected cerrarHoja(): void {
    this.hoja.set(null);
    this.nombre.set('');
    this.saldo.set(null);
    this.desde.set(null);
    this.hacia.set(null);
    this.error.set('');
  }

  protected async agregar(): Promise<void> {
    const titular = this.titular();
    await this.ejecutar(() => this.puertos.cuentas.agregar({ nombre: this.nombre(), titularId: titular === CONJUNTA ? null : titular, saldo: this.saldo()! }));
  }

  protected async mover(): Promise<void> {
    await this.ejecutar(() => this.puertos.cuentas.mover({ desde: this.desde()!, hacia: this.hacia()!, monto: this.saldo()! }));
  }

  /** Mientras la peticion va en camino no sale otra: un doble toque no crea la cuenta dos veces. */
  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    try {
      await accion();
      this.cerrarHoja();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
