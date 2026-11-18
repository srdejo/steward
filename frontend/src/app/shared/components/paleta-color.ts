import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { PALETA_CATEGORIAS } from '@steward/domain';

import { Icono } from './icono';

/**
 * La paleta de colores de categoria (color-categorias, design D4): un grupo de 10 opciones de 44 × 44 px con un circulo de
 * 28 px; el elegido lleva un anillo y un check. Las flechas mueven la eleccion como en cualquier grupo de radios.
 */
@Component({
  selector: 'app-paleta-color',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="radiogroup" aria-label="Color" class="flex flex-col gap-2">
      <span class="rotulo" aria-hidden="true">Color</span>
      <div class="grid grid-cols-5 justify-items-center gap-1" (keydown)="tecla($event)">
        @for (p of paleta; track p.color; let i = $index) {
          <button type="button" role="radio" class="flex size-11 items-center justify-center rounded-full" data-testid="color"
            [attr.aria-checked]="valor() === p.color" [attr.aria-label]="p.nombre" [attr.tabindex]="enfocable(i) ? 0 : -1" [attr.data-color]="p.color"
            (click)="valor.set(p.color)">
            <span class="flex size-7 items-center justify-center rounded-full text-white" [style.background]="p.color"
              [class]="valor() === p.color ? 'ring-2 ring-acento ring-offset-2 ring-offset-superficie' : ''">
              @if (valor() === p.color) {
                <app-icono nombre="check" [tamano]="16" />
              }
            </span>
          </button>
        }
      </div>
    </div>
  `,
})
export class PaletaColor {
  readonly valor = model<string | null>(null);
  protected readonly paleta = PALETA_CATEGORIAS;

  /** Solo el elegido (o el primero, si no hay) entra con Tab. */
  protected enfocable(i: number): boolean {
    const elegido = this.paleta.findIndex((p) => p.color === this.valor());
    return elegido === -1 ? i === 0 : i === elegido;
  }

  protected tecla(e: KeyboardEvent): void {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!paso) return;
    e.preventDefault();
    const actual = Math.max(0, this.paleta.findIndex((p) => p.color === this.valor()));
    const siguiente = (actual + paso + this.paleta.length) % this.paleta.length;
    this.valor.set(this.paleta[siguiente]!.color);
    const botones = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    botones[siguiente]?.focus();
  }
}
