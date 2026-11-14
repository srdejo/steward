import { computed, signal, type Signal } from '@angular/core';
import { sumar, type Id, type Puertos, type VistaCuenta } from '@steward/domain';

import { mensajeDeError } from '../../core/datos/consulta';

/**
 * Lo escrito al cuadrar: el saldo del banco por cuenta, la diferencia y lo que sale sin registrar (spec "Cuadrar todas").
 * Lo usan el cuadre movil y la tabla de Cuentas en escritorio (design D3 de web-escritorio-completo).
 */
export class EstadoCuadre {
  /** Lo escrito por cuenta (se conserva al cambiar el filtro). */
  readonly saldos = signal<Record<Id, number | null>>({});
  readonly guardando = signal(false);
  readonly error = signal('');

  readonly hayValores = computed(() => Object.values(this.saldos()).some((v) => v !== null));
  /** Suma de las diferencias de las cuentas con valor: lo que salio sin registrar. */
  readonly sinRegistrar = computed(() => sumar((this.todas() ?? []).map((c) => this.diferencia(c) ?? 0)));

  /** `todas`: todas las cuentas del hogar, sin filtro, para sumar aunque el filtro oculte alguna. */
  constructor(
    private readonly puertos: Puertos,
    private readonly todas: Signal<VistaCuenta[] | undefined>,
  ) {}

  /** Estimado − banco: positivo = salio dinero sin registrar. null si no se ha escrito. */
  diferencia(c: VistaCuenta): number | null {
    const banco = this.saldos()[c.cuenta.id];
    return banco === undefined || banco === null ? null : c.saldo - banco;
  }

  poner(cuentaId: Id, valor: number | null): void {
    this.saldos.update((s) => ({ ...s, [cuentaId]: valor }));
  }

  /** Guarda los saldos escritos; true si se guardo (y deja el formulario limpio). */
  async guardar(): Promise<boolean> {
    const saldos = Object.entries(this.saldos())
      .filter((e): e is [Id, number] => e[1] !== null)
      .map(([cuentaId, saldoBanco]) => ({ cuentaId, saldoBanco }));
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.puertos.cuentas.cuadrar(saldos);
      this.saldos.set({});
      return true;
    } catch (e) {
      this.error.set(mensajeDeError(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }
}
