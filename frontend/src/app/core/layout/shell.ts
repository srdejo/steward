import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { PUERTOS } from '../datos/puertos';
import { Icono, type NombreIcono } from '../../shared/components/icono';
import { AvataresHogar } from './avatares-hogar';

interface Destino {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
}

/** Los tres destinos principales (HANDOFF, seccion 4). Ajustes se abre desde los avatares. */
export const DESTINOS: Destino[] = [
  { ruta: '/hoy', etiqueta: 'Ejecución', icono: 'hoy' },
  { ruta: '/planear', etiqueta: 'Plan', icono: 'planear' },
  { ruta: '/cuentas', etiqueta: 'Cuentas', icono: 'cuentas' },
];

/**
 * Una sola app responsive: por debajo de 1024 px, barra inferior (artboards móviles); desde 1024 px, menú lateral.
 * Las pantallas móviles se centran a 560 px; Comparar y Anual (data.ancho = 'completo') usan todo el ancho.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, AvataresHogar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a href="#contenido" class="sr-only-focusable absolute top-2 left-2 z-50 rounded-control bg-superficie px-3 py-2 font-semibold">
      Ir al contenido
    </a>
    <div class="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside class="hidden border-r border-borde bg-superficie lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:px-4 lg:py-6" data-testid="menu-lateral">
        <span class="px-3 text-[15px] font-bold">Presupuesto Hogar</span>
        <nav aria-label="Navegación principal" class="flex flex-col gap-1">
          @for (d of destinos; track d.ruta) {
            <a
              [routerLink]="d.ruta"
              routerLinkActive="bg-acento-suave text-texto font-semibold"
              ariaCurrentWhenActive="page"
              class="flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] text-secundario hover:bg-fondo"
            >
              <app-icono [nombre]="d.icono" />{{ d.etiqueta }}
            </a>
          }
        </nav>
        <div class="mt-auto flex items-center justify-between gap-2 border-t border-divisor px-3 pt-4">
          <app-avatares-hogar />
          <span class="text-[13px] text-secundario">Hogar</span>
        </div>
      </aside>

      <main id="contenido" class="min-w-0 pb-28 lg:pb-12">
        @if (esDemo) {
          <p class="bg-aviso-suave px-4 py-1.5 text-center text-xs font-medium text-aviso" role="note" data-testid="aviso-demo">
            Datos de prueba · se guardan solo en este dispositivo
          </p>
        }
        <div class="mx-auto w-full" [class.max-w-[560px]]="!anchoCompleto()">
          <router-outlet />
        </div>
      </main>
    </div>

    <nav
      aria-label="Navegación principal"
      class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-borde bg-superficie pt-2 pb-[max(20px,env(safe-area-inset-bottom))] lg:hidden"
      data-testid="barra-inferior"
    >
      @for (d of destinos; track d.ruta) {
        <a
          [routerLink]="d.ruta"
          routerLinkActive="font-semibold text-texto"
          ariaCurrentWhenActive="page"
          class="flex min-h-11 flex-col items-center gap-1 py-1.5 text-xs text-secundario"
        >
          <app-icono [nombre]="d.icono" />{{ d.etiqueta }}
        </a>
      }
    </nav>
  `,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly destinos = DESTINOS;
  protected readonly esDemo = inject(PUERTOS).demo !== null;

  private readonly datosRuta = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.datosHoja()),
    ),
    { initialValue: this.datosHoja() },
  );
  protected readonly anchoCompleto = computed(() => this.datosRuta()['ancho'] === 'completo');

  private datosHoja(): Record<string, unknown> {
    let r = this.ruta;
    while (r.firstChild) r = r.firstChild;
    return r.snapshot?.data ?? {};
  }
}
