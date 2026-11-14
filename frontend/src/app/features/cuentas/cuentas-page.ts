import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCop, formatFechaCorta, formatTasa, sumar, type FiltroTitular, type Id, type MovimientoCuenta } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Avatar } from '../../shared/components/avatar';
import { Fila } from '../../shared/components/fila';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';
import { anchoEscritorio } from '../../shared/escritorio';
import { EstadoCuadre } from './estado-cuadre';
import { FiltroTitularComponent } from './filtro-titular';

const CONJUNTA = '__conjunta__';
/** Movimientos que se ven en "Movimientos recientes" (design D4 de web-escritorio-completo). */
const RECIENTES = 20;

type Pestana = 'cuentas' | 'tarjetas' | 'creditos';
/** Un movimiento con la cuenta en la que se ve; `transferencia`: una transferencia mostrada una sola vez. */
interface MovimientoReciente extends MovimientoCuenta {
  cuentaId: Id;
  transferencia: boolean;
}

/**
 * Cuentas.dc.html: saldo del hogar estimado, cuentas con titular y cuadre, y los créditos (spec steward-cuentas).
 * Desde 1024 px, CuentasWeb.dc.html: pestañas, el cuadre en tabla y los movimientos recientes del hogar.
 */
@Component({
  selector: 'app-cuentas-page',
  imports: [RouterLink, Avatar, Fila, Hoja, Monto, MontoInput, Segmentado, FiltroTitularComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-[22px] px-9 pt-7 pb-10' : 'flex flex-col gap-5 px-5 pt-6 pb-4'" },
  template: `
    @if (escritorio()) {
      <!-- CuentasWeb.dc.html: encabezado, pestañas, cuadre en tabla, movimientos recientes y créditos al lado (web-escritorio-completo). -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="rotulo">Saldo del hogar · estimado</h1>
          <span class="monto text-[30px] font-semibold" data-testid="saldo-hogar">≈ <app-monto [valor]="todas.value()?.total ?? 0" /></span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="boton h-10 rounded-[10px] border border-control bg-superficie px-3.5 text-sm" (click)="hoja.set('mover')">Mover dinero</button>
          <button type="button" class="boton h-10 rounded-[10px] border border-control bg-superficie px-3.5 text-sm" (click)="hoja.set(pestana() === 'cuentas' ? 'agregar' : 'credito')">{{ pestana() === 'cuentas' ? '+ Cuenta' : '+ Crédito' }}</button>
        </div>
      </div>

      <div role="tablist" aria-label="Cuentas, tarjetas y créditos" class="flex gap-1 border-b border-borde">
        @for (t of pestanas; track t.valor) {
          <button type="button" role="tab" [attr.aria-selected]="pestana() === t.valor" class="min-h-11 px-3.5 text-sm"
            [class]="pestana() === t.valor ? 'font-semibold text-texto shadow-[inset_0_-2px_0_var(--color-acento)]' : 'text-secundario'" (click)="pestana.set(t.valor)">{{ t.etiqueta }}</button>
        }
      </div>

      @if (pestana() === 'cuentas') {
        <div class="flex flex-wrap items-start gap-5">
          <div class="flex min-w-0 flex-[2_1_600px] flex-col gap-5">
            <section class="tarjeta overflow-hidden" aria-labelledby="titulo-cuadre" data-testid="tabla-cuadre">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-divisor px-5 py-4">
                <div class="flex flex-col gap-0.5">
                  <h2 id="titulo-cuadre" class="text-base font-semibold">Cuadrar cuentas</h2>
                  <p class="text-[13px] text-secundario">Escribe lo que dice cada banco. La diferencia se guarda sola.</p>
                </div>
                <app-filtro-titular [(valor)]="filtro" />
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr class="bg-fondo text-left text-[11px] font-semibold tracking-[0.06em] text-secundario">
                      <th scope="col" class="px-5 py-2.5">CUENTA</th>
                      <th scope="col" class="py-2.5 pr-3">TITULAR</th>
                      <th scope="col" class="py-2.5 pr-3 text-right">LA APP ESTIMA</th>
                      <th scope="col" class="w-[170px] py-2.5 pr-3">EL BANCO DICE</th>
                      <th scope="col" class="py-2.5 pr-3 text-right">DIFERENCIA</th>
                      <th scope="col" class="py-2.5 pr-5">ÚLTIMO CUADRE</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of datos.value()?.cuentas ?? []; track c.cuenta.id) {
                      <tr class="border-t border-divisor" [attr.data-cuenta]="c.cuenta.nombre">
                        <th scope="row" class="px-5 py-2.5 text-left font-medium"><a [routerLink]="['/cuentas/cuenta', c.cuenta.id]" class="hover:underline">{{ c.cuenta.nombre }}</a></th>
                        <td class="py-2.5 pr-3 text-[13px] text-[#3B3D39]">{{ c.titular }}</td>
                        <td class="monto py-2.5 pr-3 text-right text-[13px] text-secundario">{{ c.estimado ? '≈ ' : '' }}<app-monto [valor]="c.saldo" /></td>
                        <td class="py-2 pr-3">
                          <app-monto-input class="[&_input]:h-[38px] [&_input]:rounded-[9px] [&_input]:px-2.5 [&_input]:text-[13px]" [etiquetaAccesible]="'Saldo en el banco de ' + c.cuenta.nombre"
                            [placeholder]="c.aviso ? 'Opcional' : ''" [valor]="cuadre.saldos()[c.cuenta.id] ?? null" (valorChange)="cuadre.poner(c.cuenta.id, $event)" />
                        </td>
                        <td class="monto py-2.5 pr-3 text-right text-[13px]" data-testid="diferencia">
                          @let d = cuadre.diferencia(c);
                          @if (d === null) {
                            <span class="text-[#9A9C95]">—</span>
                          } @else if (d === 0) {
                            <span class="font-sans font-semibold text-positivo">Cuadra</span>
                          } @else {
                            <app-monto class="font-semibold" [class.text-negativo]="d > 0" [class.text-positivo]="d < 0" [valor]="-d" [signo]="true" [siempreVisible]="true" />
                          }
                        </td>
                        <td class="py-2.5 pr-5 text-[13px]" [class]="c.aviso ? 'font-medium text-aviso' : 'text-secundario'">{{ c.estadoCuadre }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" class="px-5 py-3 text-secundario">No hay cuentas{{ filtro() === 'TODAS' ? '' : ' con ese titular' }}.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3 border-t border-borde bg-fondo px-5 py-3.5">
                <span class="text-sm text-[#3B3D39]">Se guardan como <b>gastos sin registrar</b>: <app-monto class="font-semibold" [valor]="cuadre.sinRegistrar()" [siempreVisible]="true" data-testid="sin-registrar" /></span>
                @if (cuadre.error()) {
                  <p role="alert" class="text-sm text-negativo">{{ cuadre.error() }}</p>
                }
                <button type="button" class="boton h-10 rounded-[10px] bg-acento px-[18px] text-sm text-white" [disabled]="!cuadre.hayValores() || cuadre.guardando()" (click)="cuadre.guardar()">Guardar saldos</button>
              </div>
            </section>

            <section class="tarjeta overflow-hidden" aria-labelledby="titulo-movimientos" data-testid="movimientos-recientes">
              <div class="flex items-center justify-between gap-3 border-b border-divisor px-5 py-4">
                <h2 id="titulo-movimientos" class="text-base font-semibold">Movimientos recientes</h2>
                <label class="flex items-center gap-2 text-[13px] text-secundario">Cuenta
                  <select class="h-[34px] rounded-lg border border-borde bg-superficie px-2 text-[13px] font-medium text-texto" (change)="cuentaMovs.set($any($event.target).value)">
                    <option value="" [selected]="!cuentaMovs()">Todas</option>
                    @for (c of todas.value()?.cuentas ?? []; track c.cuenta.id) {
                      <option [value]="c.cuenta.id" [selected]="cuentaMovs() === c.cuenta.id">{{ c.cuenta.nombre }}</option>
                    }
                  </select>
                </label>
              </div>
              <div class="overflow-x-auto">
                <div class="min-w-[620px]">
                  @for (m of movimientosVisibles(); track m.movimiento.id + m.cuentaId) {
                    <a [routerLink]="m.corregible ? ['/cuentas/cuenta', m.cuentaId, 'registro', m.movimiento.id] : ['/cuentas/cuenta', m.cuentaId]"
                      class="grid grid-cols-[70px_minmax(200px,2fr)_44px_130px_130px] items-center gap-3 border-b border-divisor px-5 py-[11px] text-sm hover:bg-fondo" data-testid="movimiento">
                      <span class="text-[13px] text-secundario">{{ fecha(m.movimiento.fecha) }}</span>
                      <span class="flex min-w-0 flex-col gap-0.5"><span class="truncate">{{ m.descripcion }}</span>@if (m.movimiento.nota && m.movimiento.nota !== m.descripcion) {<span class="truncate text-xs text-secundario">{{ m.movimiento.nota }}</span>}</span>
                      <app-avatar [inicial]="miembros.inicialDe(m.movimiento.usuarioId)" [variante]="miembros.varianteDe(m.movimiento.usuarioId)" [tamano]="26" [nombre]="miembros.nombreDe(m.movimiento.usuarioId)" />
                      <span class="truncate text-[13px] text-secundario">{{ nombreCuenta(m.cuentaId) }}</span>
                      <app-monto class="text-right text-[13px] font-semibold" [class.text-positivo]="m.efecto > 0 && !m.transferencia" [class.text-secundario]="m.transferencia" [valor]="m.transferencia ? -m.efecto : m.efecto" [signo]="!m.transferencia" />
                    </a>
                  } @empty {
                    <p class="px-5 py-3 text-sm text-secundario">Sin movimientos desde el último cuadre.</p>
                  }
                </div>
              </div>
            </section>
          </div>

          <aside class="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
            <button type="button" class="tarjeta flex flex-col gap-1.5 px-[18px] py-4 text-left hover:bg-fondo" (click)="pestana.set('creditos')" data-testid="resumen-creditos">
              <span class="rotulo">Créditos</span>
              <app-monto class="text-[22px] font-semibold" [valor]="deuda()" />
              <span class="text-[13px] text-secundario">{{ (creditos.value() ?? []).length }} {{ (creditos.value() ?? []).length === 1 ? 'crédito' : 'créditos' }}</span>
              <span class="text-[13px] font-semibold text-acento">Ver créditos ›</span>
            </button>
          </aside>
        </div>
      } @else {
        <section class="tarjeta flex max-w-[720px] flex-col gap-1 px-5 py-3" aria-labelledby="titulo-creditos" data-testid="lista-creditos">
          <div class="flex items-center justify-between">
            <h2 id="titulo-creditos" class="text-base font-semibold">Créditos</h2>
            @if (deuda(); as total) {
              <span class="text-xs text-secundario">Debes <app-monto [valor]="total" /></span>
            }
          </div>
          @for (c of creditos.value() ?? []; track c.credito.id) {
            <a [routerLink]="['/cuentas/credito', c.credito.id]" class="block hover:bg-fondo">
              <app-fila [titulo]="c.credito.nombre" [detalle]="'Cuota ' + cop(c.credito.cuota) + ' · ' + tasa(c.credito.tasaEM) + (c.cuotasRestantes !== null ? ' · faltan ' + c.cuotasRestantes : '')">
                <span class="text-sm"><app-monto [valor]="c.credito.saldo" /> ›</span>
              </app-fila>
            </a>
          } @empty {
            <p class="py-2.5 text-sm text-secundario">Sin créditos.</p>
          }
          <p class="pt-2 text-xs leading-[1.45] text-secundario">Las tarjetas de crédito y compras a cuotas viven en el plan como gastos del mes. Aquí solo van las deudas con saldo y tasa.</p>
        </section>
      }
    } @else {
    @if (datos.value(); as d) {
      <div class="flex flex-col gap-1.5">
        <h1 class="rotulo">Saldo del hogar · estimado</h1>
        <span class="monto text-[30px] font-semibold" data-testid="saldo-hogar">≈ <app-monto [valor]="d.total" /></span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <a routerLink="/cuentas/cuadrar" class="boton h-[46px] rounded-xl bg-acento text-sm text-white">Cuadrar cuentas</a>
        <button type="button" class="boton h-[46px] rounded-xl border border-[#D9D8D2] bg-superficie text-sm" (click)="hoja.set('mover')">Mover dinero</button>
      </div>

      <section class="flex flex-col gap-2" aria-labelledby="titulo-cuentas">
        <div class="flex items-center justify-between">
          <h2 id="titulo-cuentas" class="text-base font-semibold">Cuentas</h2>
          <button type="button" class="boton-texto font-semibold" (click)="hoja.set('agregar')">+ Agregar</button>
        </div>
        <app-filtro-titular [(valor)]="filtro" />
        <div class="flex flex-col divide-y divide-divisor">
          @for (c of d.cuentas; track c.cuenta.id) {
            <a [routerLink]="['/cuentas/cuenta', c.cuenta.id]" class="block hover:bg-superficie">
              <app-fila [titulo]="c.cuenta.nombre" [detalle]="c.titular + ' · ' + c.estadoCuadre" [tonoDetalle]="c.aviso ? 'text-aviso' : 'text-secundario'" [attr.data-cuenta]="c.cuenta.nombre">
                <span class="monto text-sm" [class.text-secundario]="c.estimado">{{ c.estimado ? '≈ ' : '' }}<app-monto [valor]="c.saldo" /></span>
              </app-fila>
            </a>
          } @empty {
            <p class="py-2.5 text-sm text-secundario">No hay cuentas{{ filtro() === 'TODAS' ? '' : ' con ese titular' }}.</p>
          }
        </div>
      </section>

      <section class="flex flex-col gap-1" aria-labelledby="titulo-creditos">
        <div class="flex items-center justify-between">
          <h2 id="titulo-creditos" class="text-base font-semibold">Créditos</h2>
          <div class="flex items-center gap-3">
            @if (deuda(); as total) {
              <span class="text-xs text-secundario">Debes <app-monto [valor]="total" /></span>
            }
            <button type="button" class="boton-texto font-semibold" aria-label="Agregar crédito" (click)="hoja.set('credito')">+ Agregar</button>
          </div>
        </div>
        @for (c of creditos.value() ?? []; track c.credito.id) {
          <a [routerLink]="['/cuentas/credito', c.credito.id]" class="block hover:bg-superficie">
            <app-fila [titulo]="c.credito.nombre" [detalle]="'Cuota ' + cop(c.credito.cuota) + ' · ' + tasa(c.credito.tasaEM) + (c.cuotasRestantes !== null ? ' · faltan ' + c.cuotasRestantes : '')">
              <span class="text-sm"><app-monto [valor]="c.credito.saldo" /> ›</span>
            </app-fila>
          </a>
        } @empty {
          <p class="py-2.5 text-sm text-secundario">Sin créditos.</p>
        }
      </section>

      <p class="text-xs leading-[1.45] text-secundario">Las tarjetas de crédito y compras a cuotas viven en el plan como gastos del mes. Aquí solo van las deudas con saldo y tasa.</p>
    }
    }

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

    @if (hoja() === 'credito') {
      <!-- "+ Agregar" en Créditos: su cuota entra al plan del mes en curso (spec steward-cuentas, "Agregar crédito"). -->
      <app-hoja titulo="Nuevo crédito" (cerrar)="cerrarHoja()">
        <label class="flex flex-col gap-2">
          <span class="rotulo">Nombre</span>
          <input class="campo" placeholder="Ej: Libre inversión" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="rotulo">Entidad</span>
          <input class="campo" placeholder="Ej: Bancolombia" [value]="entidad()" (input)="entidad.set($any($event.target).value)" />
        </label>
        <app-monto-input etiqueta="Saldo" [(valor)]="saldo" />
        <app-monto-input etiqueta="Total original" [(valor)]="totalOriginal" />
        <app-monto-input etiqueta="Cuota" [(valor)]="cuota" />
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-2">
            <span class="rotulo">Tasa (% EM)</span>
            <input class="campo" inputmode="decimal" placeholder="1,6" [value]="tasaTexto()" (input)="tasaTexto.set($any($event.target).value)" />
          </label>
          <label class="flex flex-col gap-2">
            <span class="rotulo">Día de pago</span>
            <input class="campo" inputmode="numeric" placeholder="15" [value]="diaTexto()" (input)="diaTexto.set($any($event.target).value)" />
          </label>
        </div>
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="!creditoCompleto() || ocupado()" (click)="agregarCredito()">Agregar crédito</button>
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

  protected readonly pestanas: { valor: Pestana; etiqueta: string }[] = [
    { valor: 'cuentas', etiqueta: 'Cuentas' },
    { valor: 'tarjetas', etiqueta: 'Tarjetas' },
    { valor: 'creditos', etiqueta: 'Créditos' },
  ];
  /** Tarjetas y Créditos muestran la lista de créditos hasta el cambio de tarjetas (spec "Cuentas, cuadre y créditos"). */
  protected readonly pestana = signal<Pestana>('cuentas');

  /** Cuenta elegida en "Movimientos recientes"; vacio = todas. */
  protected readonly cuentaMovs = signal<Id | ''>('');
  /** Los movimientos de cada cuenta, solo en escritorio (design D4). */
  private readonly porCuenta = consulta(
    () => (this.escritorio() ? (this.todas.value()?.cuentas ?? []).map((c) => c.cuenta.id) : null),
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
  protected readonly creditos = consulta(() => null, (p) => p.cuentas.creditos());
  protected readonly deuda = computed(() => sumar((this.creditos.value() ?? []).map((c) => c.credito.saldo)));

  protected readonly hoja = signal<'agregar' | 'mover' | 'credito' | null>(null);
  protected readonly nombre = signal('');
  protected readonly titular = signal<string | null>(CONJUNTA);
  protected readonly saldo = signal<number | null>(null);
  protected readonly desde = signal<Id | null>(null);
  protected readonly hacia = signal<Id | null>(null);
  protected readonly error = signal('');
  protected readonly ocupado = signal(false);
  protected readonly entidad = signal('');
  protected readonly totalOriginal = signal<number | null>(null);
  protected readonly cuota = signal<number | null>(null);
  protected readonly tasaTexto = signal('');
  protected readonly diaTexto = signal('');
  private readonly tasaEM = computed(() => {
    const t = Number(this.tasaTexto().trim().replace(',', '.') || '0');
    return Number.isFinite(t) ? t : NaN;
  });
  private readonly dia = computed(() => Number(this.diaTexto().trim()));
  /** El total original es opcional: si falta, es el saldo. */
  protected readonly creditoCompleto = computed(
    () => !!this.nombre().trim() && this.saldo() !== null && !!this.cuota() && Number.isInteger(this.dia()) && this.dia() >= 1 && !Number.isNaN(this.tasaEM()),
  );

  protected readonly titulares = computed<Opcion<string>[]>(() => [
    ...this.miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre })),
    { valor: CONJUNTA, etiqueta: 'Conjunta' },
  ]);
  protected readonly opcionesCuenta = computed<Opcion<Id>[]>(() => (this.todas.value()?.cuentas ?? []).map((c) => ({ valor: c.cuenta.id, etiqueta: c.cuenta.nombre })));

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected nombreCuenta(id: Id): string {
    return this.todas.value()?.cuentas.find((c) => c.cuenta.id === id)?.cuenta.nombre ?? '';
  }

  protected cop(v: number): string {
    return formatCop(v);
  }

  protected tasa(t: number): string {
    return formatTasa(t);
  }

  protected cerrarHoja(): void {
    this.hoja.set(null);
    this.nombre.set('');
    this.saldo.set(null);
    this.desde.set(null);
    this.hacia.set(null);
    this.error.set('');
    this.entidad.set('');
    this.totalOriginal.set(null);
    this.cuota.set(null);
    this.tasaTexto.set('');
    this.diaTexto.set('');
  }

  protected async agregar(): Promise<void> {
    const titular = this.titular();
    await this.ejecutar(() => this.puertos.cuentas.agregar({ nombre: this.nombre(), titularId: titular === CONJUNTA ? null : titular, saldo: this.saldo()! }));
  }

  protected async agregarCredito(): Promise<void> {
    const saldo = this.saldo()!;
    await this.ejecutar(() =>
      this.puertos.cuentas.agregarCredito({
        nombre: this.nombre(), entidad: this.entidad(), saldo, totalOriginal: this.totalOriginal() ?? saldo, cuota: this.cuota()!,
        tasaEM: this.tasaEM(), diaPago: this.dia(),
      }),
    );
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
