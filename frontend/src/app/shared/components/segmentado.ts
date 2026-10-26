import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface Opcion<T> {
  valor: T;
  etiqueta: string;
}

/**
 * Seleccion entre pocas opciones como los artboards: botones de 48 px en cuadricula ("Daniel / Esposa",
 * "Octubre / Noviembre") o, con `chips`, pildoras de 40 px que se pueden dejar sin elegir ("Davivienda · Nu · Su cuenta").
 */
@Component({
  selector: 'app-segmentado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    @if (etiqueta()) {
      <span class="rotulo" [id]="idEtiqueta">{{ etiqueta() }}</span>
    }
    <div
      role="radiogroup"
      [attr.aria-labelledby]="etiqueta() ? idEtiqueta : null"
      [attr.aria-label]="etiqueta() ? null : etiquetaAccesible()"
      [class]="chips() ? 'flex flex-wrap gap-2' : 'grid gap-2'"
      [style.grid-template-columns]="chips() ? null : 'repeat(' + opciones().length + ', minmax(0, 1fr))'"
    >
      @for (o of opciones(); track o.valor) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="o.valor === valor()"
          (click)="elegir(o.valor)"
          class="border text-[15px] transition-colors"
          [class]="chips() ? 'h-10 rounded-full px-3.5 text-sm tocable' : 'h-12 rounded-xl'"
          [class.border-2]="o.valor === valor()"
          [class.border-acento]="o.valor === valor()"
          [class.bg-acento-suave]="o.valor === valor()"
          [class.text-acento]="o.valor === valor()"
          [class.font-semibold]="o.valor === valor()"
          [class.border-borde]="o.valor !== valor()"
          [class.bg-superficie]="o.valor !== valor()"
          [class.font-medium]="o.valor !== valor()"
        >
          {{ o.etiqueta }}
        </button>
      }
    </div>
  `,
})
export class Segmentado<T> {
  private static siguiente = 0;
  protected readonly idEtiqueta = `seg-${++Segmentado.siguiente}`;
  readonly opciones = input.required<Opcion<T>[]>();
  readonly valor = model<T | null>(null);
  readonly etiqueta = input('');
  readonly etiquetaAccesible = input('');
  readonly chips = input(false);
  /** Con chips: tocar la elegida la desmarca (campo opcional). */
  readonly opcional = input(false);

  protected elegir(v: T): void {
    this.valor.set(this.opcional() && this.valor() === v ? null : v);
  }
}
