import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { claveMes, formatCop, formatMesAnio, mesDe, type BaseAnual } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';

/** Una fuente de mes base: un mes con plan, solo fijos o desde cero. */
interface Fuente {
  clave: string;
  titulo: string;
  detalle: string;
  base: BaseAnual;
}

/**
 * "+ Nueva opción desde un mes base" y "Copiar otro mes" (AnualMesBaseWeb, design D4 de anual-mes-base-editable): elegir
 * la fuente del mes base. Por defecto, el mes en curso. Emite la fuente elegida; quien la abre crea o copia.
 */
@Component({
  selector: 'app-nueva-opcion-hoja',
  imports: [Hoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="titulo()" [antetitulo]="'Plan ' + anio()" (cerrar)="cerrar.emit()">
      <p class="text-sm leading-normal text-[#3B3D39]">{{ explicacion() }}</p>
      <div role="radiogroup" aria-label="Mes base" class="flex flex-col overflow-hidden rounded-xl border border-borde" data-testid="fuentes-mes-base">
        @for (f of fuentes(); track f.clave) {
          <label class="grid min-h-[52px] cursor-pointer grid-cols-[22px_1fr] items-center gap-3 border-t border-[#F1F0EB] px-3.5 py-2 first:border-t-0" [class.bg-[#F3F7F4]]="f.clave === elegida()">
            <input type="radio" name="fuente-mes-base" class="size-[18px] accent-acento" [checked]="f.clave === elegida()" (change)="elegida.set(f.clave)" />
            <span class="flex flex-col gap-0.5"><span class="text-sm font-semibold">{{ f.titulo }}</span><span class="text-xs text-secundario">{{ f.detalle }}</span></span>
          </label>
        }
      </div>
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
      <button type="button" class="boton-grande" [disabled]="guardando() || !elegida()" (click)="confirmar()">{{ boton() }}</button>
    </app-hoja>
  `,
})
export class NuevaOpcionHoja {
  private readonly puertos = inject(PUERTOS);

  readonly anio = input.required<number>();
  /** La letra de la opcion que se crea, o la que recibe la copia. */
  readonly letra = input.required<string>();
  /** CREAR: "Nueva opción desde un mes base"; COPIAR: "Copiar otro mes" en el mes base de una opcion. */
  readonly modo = input<'CREAR' | 'COPIAR'>('CREAR');
  /** Hace el trabajo con la fuente elegida; si falla, la hoja muestra el error. */
  readonly accion = input.required<(base: BaseAnual) => Promise<void>>();
  readonly cerrar = output<void>();

  private readonly inicio = consulta(() => null, (p) => p.plan.inicio());
  protected readonly fuentes = computed<Fuente[]>(() => {
    const i = this.inicio.value();
    const conPlan = i ? [...i.proximos.filter((m) => m.plan).reverse(), ...i.recientes.filter((m) => m.plan)] : [];
    const actual = claveMes(mesDe(this.puertos.hoy()));
    return [
      ...conPlan.map((m) => ({
        clave: claveMes(m.ref),
        titulo: `${formatMesAnio(m.ref)}${claveMes(m.ref) === actual ? ' · en curso' : ''}`,
        detalle: `${m.detalle} · ${m.estado === 'BORRADOR' ? 'dejaría' : 'deja'} libre ${m.libre.map((v) => formatCop(v)).join(' – ')}`,
        base: { tipo: 'MES' as const, ref: m.ref },
      })),
      { clave: 'FIJOS', titulo: 'Solo fijos e ingresos', detalle: 'Del último mes, sin los variables', base: { tipo: 'FIJOS' } },
      { clave: 'CERO', titulo: 'Desde cero', detalle: 'Un mes base vacío', base: { tipo: 'CERO' } },
    ];
  });
  /** Por defecto, el mes en curso (o el primero con plan). */
  protected readonly elegida = linkedSignal(() => {
    const actual = claveMes(mesDe(this.puertos.hoy()));
    const fuentes = this.fuentes();
    return (fuentes.find((f) => f.clave === actual) ?? fuentes[0])?.clave ?? null;
  });
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly titulo = computed(() => (this.modo() === 'CREAR' ? 'Nueva opción desde un mes base' : 'Copiar otro mes'));
  protected readonly explicacion = computed(() =>
    this.modo() === 'CREAR'
      ? `La Opción ${this.letra()} empieza con una copia de ese mes. Después la ajustas antes de llevarla al año.`
      : `Se reemplaza el mes base de la Opción ${this.letra()} por una copia de ese mes. Lo que ajustaste se pierde.`,
  );
  protected readonly boton = computed(() => (this.modo() === 'CREAR' ? `Crear la Opción ${this.letra()}` : 'Copiar este mes'));

  protected async confirmar(): Promise<void> {
    const f = this.fuentes().find((x) => x.clave === this.elegida());
    if (!f) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.accion()(f.base);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
