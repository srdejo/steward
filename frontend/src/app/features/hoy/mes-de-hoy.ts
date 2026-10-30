import { Injectable, computed, inject, signal } from '@angular/core';
import { claveMes, mesDe, nombreMes, nombreMesCapital, sumarMeses, type MesRef } from '@steward/domain';

import { PUERTOS } from '../../core/datos/puertos';
import type { Opcion } from '../../shared/components/segmentado';

const CLAVE = 'steward/mes-hoy';

/**
 * El mes que se ejecuta en Hoy: el mes en curso o el siguiente (design D2 de plan-mes-siguiente). Se recuerda en el
 * dispositivo; si lo recordado ya no es uno de los dos, vuelve al mes en curso.
 */
@Injectable({ providedIn: 'root' })
export class MesDeHoy {
  private readonly enCurso = mesDe(inject(PUERTOS).hoy());
  private readonly siguiente = sumarMeses(this.enCurso, 1);
  private readonly elegido = signal(this.leer());

  readonly opciones: Opcion<string>[] = [this.enCurso, this.siguiente].map((m) => ({ valor: claveMes(m), etiqueta: nombreMesCapital(m.mes) }));
  readonly clave = this.elegido.asReadonly();
  readonly ref = computed<MesRef>(() => (this.elegido() === claveMes(this.siguiente) ? this.siguiente : this.enCurso));
  /** "Se registra en noviembre" cuando no es el mes en curso. */
  readonly aviso = computed(() => (this.elegido() === claveMes(this.siguiente) ? `Se registra en ${nombreMes(this.siguiente.mes)}` : ''));

  elegir(clave: string): void {
    this.elegido.set(clave);
    try {
      localStorage.setItem(CLAVE, clave);
    } catch {
      // Sin almacenamiento, vale solo mientras la app esta abierta.
    }
  }

  /** Si un mes se puede ejecutar en Hoy. */
  seEjecuta(ref: MesRef): boolean {
    return this.opciones.some((o) => o.valor === claveMes(ref));
  }

  private leer(): string {
    const actual = claveMes(this.enCurso);
    try {
      const guardado = localStorage.getItem(CLAVE);
      return guardado === claveMes(this.siguiente) ? guardado : actual;
    } catch {
      return actual;
    }
  }
}
