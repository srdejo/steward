import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * Los datos de pago de un gasto en Marcar pago (gastos-datos-pago): "Abrir portal ↗" y el codigo con "Copiar". Sin datos no
 * muestra nada.
 */
@Component({
  selector: 'app-datos-pago',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enlace() || codigo()) {
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-nota px-4 py-3 text-[13px]" data-testid="datos-pago-hoja">
        @if (codigo(); as c) {
          <span class="flex min-w-0 items-center gap-2">
            <span class="text-secundario">Código</span>
            <span class="truncate font-semibold tabular-nums" data-testid="codigo-pago">{{ c }}</span>
            <button type="button" class="boton-texto font-semibold" (click)="copiar(c)">Copiar</button>
          </span>
        }
        @if (enlace(); as e) {
          <a [href]="e" target="_blank" rel="noopener noreferrer" class="font-semibold text-acento" data-testid="abrir-portal">Abrir portal ↗</a>
        }
        @if (copiado()) {
          <span role="status" class="basis-full text-xs text-positivo">Código copiado</span>
        }
      </div>
    }
  `,
})
export class DatosPago {
  readonly enlace = input<string | null | undefined>(null);
  readonly codigo = input<string | null | undefined>(null);
  protected readonly copiado = signal(false);

  protected async copiar(codigo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(codigo);
      this.copiado.set(true);
    } catch {
      this.copiado.set(false);
    }
  }
}
