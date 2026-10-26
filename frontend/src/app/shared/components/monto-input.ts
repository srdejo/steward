import { ChangeDetectionStrategy, Component, effect, input, model, signal } from '@angular/core';
import { formatCop, parseMonto, type Pesos } from '@steward/domain';

let siguienteId = 0;

/** Campo de monto: solo digitos, se formatea en COP mientras se escribe y expone el entero (spec steward-ui-shell). */
@Component({
  selector: 'app-monto-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    @if (etiqueta()) {
      <label [for]="id" class="rotulo">{{ etiqueta() }}</label>
    }
    <input
      [id]="id"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      class="monto w-full rounded-xl border border-borde bg-fondo px-4 font-semibold text-texto focus:border-acento focus:outline-none"
      [class.h-16]="grande()"
      [class.text-[28px]]="grande()"
      [class.h-12]="!grande()"
      [class.text-base]="!grande()"
      [placeholder]="placeholder()"
      [value]="texto()"
      [attr.aria-describedby]="ayuda() ? id + '-ayuda' : null"
      (input)="escribir($any($event.target))"
    />
    @if (ayuda()) {
      <p [id]="id + '-ayuda'" class="text-xs text-secundario">{{ ayuda() }}</p>
    }
  `,
})
export class MontoInput {
  protected readonly id = `monto-${++siguienteId}`;
  readonly valor = model<Pesos | null>(null);
  readonly etiqueta = input('');
  readonly ayuda = input('');
  readonly grande = input(false);
  readonly placeholder = input('$0');
  protected readonly texto = signal('');

  constructor() {
    // Si el valor cambia desde fuera (prellenado con el plan), el texto lo sigue.
    effect(() => {
      const v = this.valor();
      const actual = parseMonto(this.texto()).valor;
      if (v !== actual) this.texto.set(v === null ? '' : formatCop(v));
    });
  }

  protected escribir(campo: HTMLInputElement): void {
    const { valor, texto } = parseMonto(campo.value);
    this.texto.set(texto);
    campo.value = texto;
    this.valor.set(valor);
  }
}
