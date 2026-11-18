import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { PUERTOS } from '../datos/puertos';
import { Icono, type NombreIcono } from '../../shared/components/icono';
import { Agregar, PARAM_AGREGAR, PARAM_ITEM, tipoAgregar } from '../../features/hoy/agregar';
import { AgregarHoja } from '../../features/hoy/agregar-hoja';
import { AvataresHogar } from './avatares-hogar';
import { MiembrosHogar } from './miembros';

interface Destino {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
}

/** Los cuatro destinos principales (spec "Navegación principal", rediseno-libreta-clara). */
export const DESTINOS: Destino[] = [
  { ruta: '/hoy', etiqueta: 'Hoy', icono: 'hoy' },
  { ruta: '/planear', etiqueta: 'Planear', icono: 'planear' },
  { ruta: '/cuentas', etiqueta: 'Cuentas', icono: 'cuentas' },
  { ruta: '/ajustes', etiqueta: 'Ajustes', icono: 'ajustes' },
];

/**
 * Una sola app responsive: por debajo de 1024 px, barra inferior de cinco espacios con el + en el centro; desde 1024 px,
 * menú lateral con el nombre del hogar, los cuatro destinos y Agregar. El + y Agregar abren la hoja Agregar sobre la
 * pantalla actual (`?agregar=` en la URL).
 * Las pantallas móviles se centran a 560 px; Comparar y Anual (data.ancho = 'completo') usan todo el ancho, y Hoy
 * (data.ancho = 'escritorio') lo usa desde 1024 px. El dato se hereda a las rutas hijas (las hojas de Hoy).
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, AvataresHogar, AgregarHoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a href="#contenido" class="sr-only-focusable absolute top-2 left-2 z-50 rounded-control bg-superficie px-3 py-2 font-semibold">
      Ir al contenido
    </a>
    <div class="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside class="hidden bg-superficie lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:px-4 lg:py-6" data-testid="menu-lateral">
        <div class="flex items-center gap-2.5 px-3">
          <span class="flex size-9 items-center justify-center rounded-[10px] bg-acento text-white"><app-icono nombre="casa" [tamano]="20" /></span>
          <span class="flex min-w-0 flex-col">
            <span class="text-[15px] font-bold">Presupuesto Hogar</span>
            @if (nombreHogar(); as nombre) {
              <span class="truncate text-xs text-secundario" data-testid="nombre-hogar">{{ nombre }}</span>
            }
          </span>
        </div>
        <nav aria-label="Navegación principal" class="flex flex-col gap-1">
          @for (d of destinos; track d.ruta) {
            <a
              [routerLink]="d.ruta"
              routerLinkActive="bg-acento-elegido text-acento font-semibold"
              ariaCurrentWhenActive="page"
              class="flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] text-texto-medio hover:bg-fondo"
            >
              <app-icono [nombre]="d.icono" />{{ d.etiqueta }}
            </a>
          }
        </nav>
        <button type="button" class="boton-primario h-11 rounded-control" data-testid="agregar-lateral" (click)="agregar.abrir()">
          <app-icono nombre="mas" [tamano]="18" />Agregar
        </button>
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
        <div class="mx-auto w-full" [class]="claseAncho()">
          <router-outlet />
        </div>
      </main>
    </div>

    <nav
      aria-label="Navegación principal"
      class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-borde bg-superficie px-1 pt-1.5 pb-[max(20px,env(safe-area-inset-bottom))] lg:hidden"
      data-testid="barra-inferior"
    >
      @for (d of destinos; track d.ruta; let i = $index) {
        @if (i === 2) {
          <button
            type="button"
            aria-label="Agregar gasto, aporte o pago"
            class="-mt-[18px] flex size-[52px] items-center justify-center justify-self-center rounded-full border-4 border-fondo bg-acento text-white"
            data-testid="agregar"
            (click)="agregar.abrir()"
          >
            <app-icono nombre="mas" [tamano]="24" />
          </button>
        }
        <a
          [routerLink]="d.ruta"
          routerLinkActive="font-semibold text-acento"
          ariaCurrentWhenActive="page"
          class="flex min-h-11 flex-col items-center gap-[3px] py-1.5 text-[11px] text-secundario"
        >
          <app-icono [nombre]="d.icono" />{{ d.etiqueta }}
        </a>
      }
    </nav>

    @if (hojaAgregar(); as h) {
      <app-agregar-hoja [tipo]="h.tipo" [item]="h.item" />
    }
  `,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly destinos = DESTINOS;
  protected readonly agregar = inject(Agregar);
  protected readonly esDemo = inject(PUERTOS).demo !== null;
  private readonly hogar = inject(MiembrosHogar).hogar;
  protected readonly nombreHogar = computed(() => this.hogar.value()?.hogar.nombre ?? '');

  private readonly datosRuta = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.datosHoja()),
    ),
    { initialValue: this.datosHoja() },
  );
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** La hoja Agregar abierta por `?agregar=` en la URL actual. */
  protected readonly hojaAgregar = computed(() => {
    const params = this.router.parseUrl(this.url()).queryParams;
    const tipo = tipoAgregar(params[PARAM_AGREGAR]);
    return tipo ? { tipo, item: (params[PARAM_ITEM] as string | undefined) ?? null } : null;
  });

  protected readonly claseAncho = computed(() => {
    const ancho = this.datosRuta()['ancho'];
    return ancho === 'completo' ? '' : ancho === 'escritorio' ? 'max-w-[560px] lg:max-w-[1360px]' : 'max-w-[560px]';
  });

  /** Datos de la ruta activa, de la raiz a la hoja: una ruta hija (una hoja de Hoy) conserva el ancho de su pantalla. */
  private datosHoja(): Record<string, unknown> {
    let r: ActivatedRoute | null = this.ruta;
    let datos: Record<string, unknown> = {};
    while (r) {
      datos = { ...datos, ...(r.snapshot?.data ?? {}) };
      r = r.firstChild;
    }
    return datos;
  }
}
