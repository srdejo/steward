import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatFechaCorta, formatNumero, sumar, type FiltroTitular, type Id, type VistaCuenta } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { FiltroTitularComponent } from './filtro-titular';

/**
 * Cuadrar.dc.html: un campo por cuenta con lo que dice el banco. La diferencia contra el estimado se guarda sola
 * como ajuste ("Gastos sin registrar"), sin pedir explicacion. Las cuentas en blanco no cambian.
 */
@Component({
  selector: 'app-cuadrar-page',
  imports: [RouterLink, Monto, MontoInput, FiltroTitularComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[18px] px-5 pt-6 pb-4' },
  template: `
    <div class="flex items-center justify-between">
      <a routerLink="/cuentas" class="boton-texto -my-2 text-sm font-normal">‹ Cuentas</a>
      <span class="text-[13px] text-secundario">Hogar · {{ total() }} {{ total() === 1 ? 'cuenta' : 'cuentas' }}</span>
    </div>
    <div class="flex flex-col gap-1.5">
      <h1 class="text-[26px] font-bold">Cuadrar cuentas</h1>
      <p class="text-sm leading-[1.45] text-secundario">Escribe lo que dice cada banco. La diferencia se guarda sola, sin explicarla.</p>
    </div>
    <app-filtro-titular [(valor)]="filtro" />

    @for (c of cuentas.value()?.cuentas ?? []; track c.cuenta.id) {
      <section class="flex flex-col gap-2.5 rounded-[14px] bg-superficie px-4 py-3.5" [class]="c.aviso ? 'border border-dashed border-[#D9D8D2]' : 'border border-borde'" [attr.data-cuenta]="c.cuenta.nombre">
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col gap-0.5">
            <h2 class="text-[15px] font-semibold">{{ c.cuenta.nombre }}</h2>
            @if (c.aviso) {
              <span class="text-xs text-aviso">Sin cuadrar desde el {{ fecha(c.cuenta.fechaCuadre) }}</span>
            } @else {
              <span class="text-xs text-secundario">{{ c.titular }} · app estima ≈ <app-monto [valor]="c.saldo" /></span>
            }
          </div>
          @let d = diferencia(c);
          @if (d !== null) {
            @if (d === 0) {
              <span class="text-[13px] font-semibold text-positivo">Cuadra</span>
            } @else {
              <app-monto class="text-[13px]" [class.text-negativo]="d > 0" [class.text-positivo]="d < 0" [valor]="-d" [signo]="true" [siempreVisible]="true" />
            }
          } @else if (c.aviso) {
            <button type="button" class="boton-texto font-normal text-secundario" (click)="poner(c.cuenta.id, null)">Omitir</button>
          }
        </div>
        <app-monto-input
          [etiqueta]="esEfectivo(c) ? 'Hay en la billetera' : 'Banco dice'"
          [placeholder]="'≈ ' + cop(c.saldo)"
          [valor]="saldos()[c.cuenta.id] ?? null"
          (valorChange)="poner(c.cuenta.id, $event)"
        />
      </section>
    }

    <div class="flex items-center justify-between px-0.5 py-1">
      <span class="text-sm text-[#3B3D39]">Gastos sin registrar</span>
      <app-monto class="text-[15px] font-semibold" [valor]="sinRegistrar()" [siempreVisible]="true" data-testid="sin-registrar" />
    </div>
    @if (error()) {
      <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
    }
    <button type="button" class="boton-grande" [disabled]="!hayValores() || guardando()" (click)="guardar()">Guardar saldos</button>
  `,
})
export class CuadrarPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);

  protected readonly filtro = signal<FiltroTitular>('TODAS');
  protected readonly cuentas = consulta(() => this.filtro(), (p, f) => p.cuentas.cuentas(f));
  private readonly todas = consulta(() => null, (p) => p.cuentas.cuentas());
  protected readonly total = computed(() => this.todas.value()?.cuentas.length ?? 0);

  /** Lo escrito por cuenta (se conserva al cambiar el filtro). */
  protected readonly saldos = signal<Record<Id, number | null>>({});
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly hayValores = computed(() => Object.values(this.saldos()).some((v) => v !== null));
  /** Suma de las diferencias de las cuentas con valor: lo que salio sin registrar. */
  protected readonly sinRegistrar = computed(() => {
    const vistas = this.todas.value()?.cuentas ?? [];
    return sumar(vistas.map((c) => this.diferencia(c) ?? 0));
  });

  /** Estimado − banco: positivo = salio dinero sin registrar. null si no se ha escrito. */
  protected diferencia(c: VistaCuenta): number | null {
    const banco = this.saldos()[c.cuenta.id];
    return banco === undefined || banco === null ? null : c.saldo - banco;
  }

  protected esEfectivo(c: VistaCuenta): boolean {
    return c.cuenta.nombre.toLowerCase() === 'efectivo';
  }

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected cop(v: number): string {
    return formatNumero(v);
  }

  protected poner(cuentaId: Id, valor: number | null): void {
    this.saldos.update((s) => ({ ...s, [cuentaId]: valor }));
  }

  protected async guardar(): Promise<void> {
    const saldos = Object.entries(this.saldos())
      .filter((e): e is [Id, number] => e[1] !== null)
      .map(([cuentaId, saldoBanco]) => ({ cuentaId, saldoBanco }));
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.puertos.cuentas.cuadrar(saldos);
      await this.router.navigateByUrl('/cuentas');
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
