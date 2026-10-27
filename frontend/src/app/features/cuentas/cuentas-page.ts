import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCop, formatTasa, sumar, type FiltroTitular, type Id } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Fila } from '../../shared/components/fila';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';
import { FiltroTitularComponent } from './filtro-titular';

const CONJUNTA = '__conjunta__';

/** Cuentas.dc.html: saldo del hogar estimado, cuentas con titular y cuadre, y los créditos (spec steward-cuentas). */
@Component({
  selector: 'app-cuentas-page',
  imports: [RouterLink, Fila, Hoja, Monto, MontoInput, Segmentado, FiltroTitularComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5 px-5 pt-6 pb-4' },
  template: `
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
            <app-fila [titulo]="c.cuenta.nombre" [detalle]="c.titular + ' · ' + c.estadoCuadre" [tonoDetalle]="c.aviso ? 'text-aviso' : 'text-secundario'" [attr.data-cuenta]="c.cuenta.nombre">
              <span class="monto text-sm" [class.text-secundario]="c.estimado">{{ c.estimado ? '≈ ' : '' }}<app-monto [valor]="c.saldo" /></span>
            </app-fila>
          } @empty {
            <p class="py-2.5 text-sm text-secundario">No hay cuentas{{ filtro() === 'TODAS' ? '' : ' con ese titular' }}.</p>
          }
        </div>
      </section>

      <section class="flex flex-col gap-1" aria-labelledby="titulo-creditos">
        <div class="flex items-center justify-between">
          <h2 id="titulo-creditos" class="text-base font-semibold">Créditos</h2>
          @if (deuda(); as total) {
            <span class="text-xs text-secundario">Debes <app-monto [valor]="total" /></span>
          }
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
        <button type="button" class="boton-grande" [disabled]="!nombre().trim() || saldo() === null" (click)="agregar()">Agregar cuenta</button>
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
        <button type="button" class="boton-grande" [disabled]="!desde() || !hacia() || !saldo()" (click)="mover()">Mover</button>
      </app-hoja>
    }
  `,
})
export class CuentasPage {
  private readonly puertos = inject(PUERTOS);
  private readonly miembros = inject(MiembrosHogar);

  protected readonly filtro = signal<FiltroTitular>('TODAS');
  protected readonly datos = consulta(() => this.filtro(), (p, f) => p.cuentas.cuentas(f));
  private readonly todas = consulta(() => null, (p) => p.cuentas.cuentas());
  protected readonly creditos = consulta(() => null, (p) => p.cuentas.creditos());
  protected readonly deuda = computed(() => sumar((this.creditos.value() ?? []).map((c) => c.credito.saldo)));

  protected readonly hoja = signal<'agregar' | 'mover' | null>(null);
  protected readonly nombre = signal('');
  protected readonly titular = signal<string | null>(CONJUNTA);
  protected readonly saldo = signal<number | null>(null);
  protected readonly desde = signal<Id | null>(null);
  protected readonly hacia = signal<Id | null>(null);
  protected readonly error = signal('');

  protected readonly titulares = computed<Opcion<string>[]>(() => [
    ...this.miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre })),
    { valor: CONJUNTA, etiqueta: 'Conjunta' },
  ]);
  protected readonly opcionesCuenta = computed<Opcion<Id>[]>(() => (this.todas.value()?.cuentas ?? []).map((c) => ({ valor: c.cuenta.id, etiqueta: c.cuenta.nombre })));

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
  }

  protected async agregar(): Promise<void> {
    const titular = this.titular();
    await this.ejecutar(() => this.puertos.cuentas.agregar({ nombre: this.nombre(), titularId: titular === CONJUNTA ? null : titular, saldo: this.saldo()! }));
  }

  protected async mover(): Promise<void> {
    await this.ejecutar(() => this.puertos.cuentas.mover({ desde: this.desde()!, hacia: this.hacia()!, monto: this.saldo()! }));
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.error.set('');
    try {
      await accion();
      this.cerrarHoja();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }
}
