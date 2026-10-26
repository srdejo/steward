import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Avatar } from '../../shared/components/avatar';
import { MiembrosHogar } from './miembros';

/** Grupo de avatares del hogar ("D E"): abre Ajustes del hogar. Va en Hoy y en la barra lateral. */
@Component({
  selector: 'app-avatares-hogar',
  imports: [RouterLink, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/ajustes" aria-label="Ajustes del hogar" class="flex min-h-11 items-center py-1.5" data-testid="avatares-hogar">
      @for (m of miembros(); track m.usuario.id; let primero = $first) {
        <app-avatar
          [inicial]="m.usuario.inicial"
          [variante]="m.variante"
          [class.-ml-2.5]="!primero"
          [class.border-2]="!primero"
          [class.border-fondo]="!primero"
        />
      }
    </a>
  `,
})
export class AvataresHogar {
  protected readonly miembros = inject(MiembrosHogar).miembros;
}
