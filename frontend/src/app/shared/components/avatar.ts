import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Inicial de un miembro. El primero del hogar va en acento ("D"), los demas en acento suave ("E"). */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
    '[class.bg-acento]': 'variante() === "fuerte"',
    '[class.text-white]': 'variante() === "fuerte"',
    '[class.bg-avatar-suave]': 'variante() === "suave"',
    '[class.text-acento]': 'variante() === "suave"',
    '[style.width.px]': 'tamano()',
    '[style.height.px]': 'tamano()',
    '[style.font-size.px]': 'tamano() * 0.42',
    '[attr.aria-label]': 'nombre() || null',
    '[attr.role]': 'nombre() ? "img" : null',
  },
  template: '{{ inicial() }}',
})
export class Avatar {
  readonly inicial = input.required<string>();
  readonly variante = input<'fuerte' | 'suave'>('fuerte');
  readonly tamano = input(32);
  readonly nombre = input('');
}
