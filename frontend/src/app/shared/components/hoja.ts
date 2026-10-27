import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, inject, input, output, viewChild } from '@angular/core';

let siguienteId = 0;
const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja de registro (Aporte, Marcar pago, Registrar gasto): bottom sheet en móvil y diálogo centrado desde 1024 px.
 * Es modal: atrapa el foco, Escape o "Cancelar" la cierran y al cerrarse el foco vuelve a donde estaba.
 */
@Component({
  selector: 'app-hoja',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed inset-0 z-40 flex items-end justify-center lg:items-center', '(keydown)': 'teclado($event)' },
  template: `
    <div class="absolute inset-0 bg-[#3A3B38]/80" (click)="cerrar.emit()" aria-hidden="true"></div>
    <section
      #panel
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="id"
      tabindex="-1"
      class="relative flex max-h-[92dvh] w-full max-w-[480px] flex-col gap-[22px] overflow-y-auto rounded-t-[22px] bg-superficie px-5 pt-3 pb-8 focus:outline-none lg:rounded-[22px] lg:pt-6"
    >
      <span class="h-1 w-10 self-center rounded-sm bg-[#D9D8D2] lg:hidden" aria-hidden="true"></span>
      <header class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-1">
          @if (antetitulo()) {
            <span class="rotulo" [style.color]="colorAntetitulo()">{{ antetitulo() }}</span>
          }
          <h2 [id]="id" class="text-[22px] font-bold">{{ titulo() }}</h2>
          <ng-content select="[subtitulo]" />
        </div>
        <button type="button" class="boton-texto text-sm font-normal" (click)="cerrar.emit()">Cancelar</button>
      </header>
      <ng-content />
    </section>
  `,
})
export class Hoja implements OnDestroy {
  protected readonly id = `hoja-${++siguienteId}`;
  readonly titulo = input.required<string>();
  /** Rotulo sobre el titulo (la categoria en Marcar pago). */
  readonly antetitulo = input('');
  readonly colorAntetitulo = input<string | null>(null);
  readonly cerrar = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly anterior = (inject(ElementRef).nativeElement as HTMLElement).ownerDocument.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => {
      const primero = this.panel().nativeElement.querySelector<HTMLElement>('input, [role="radio"], textarea');
      (primero ?? this.panel().nativeElement).focus();
    });
  }

  protected teclado(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.cerrar.emit();
      return;
    }
    if (evento.key !== 'Tab') return;
    const enfocables = [...this.panel().nativeElement.querySelectorAll<HTMLElement>(ENFOCABLES)];
    if (!enfocables.length) return;
    const primero = enfocables[0]!;
    const ultimo = enfocables[enfocables.length - 1]!;
    const activo = this.panel().nativeElement.ownerDocument.activeElement;
    if (evento.shiftKey && (activo === primero || activo === this.panel().nativeElement)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  ngOnDestroy(): void {
    this.anterior?.focus?.();
  }
}
