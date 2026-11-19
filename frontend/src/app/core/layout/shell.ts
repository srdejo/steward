import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { PUERTOS } from '../datos/puertos';
import { Icono, type NombreIcono } from '../../shared/components/icono';
import { Agregar, PARAM_AGREGAR, PARAM_ITEM, PARAM_MES, tipoAgregar } from '../../features/hoy/agregar';
import { AgregarHoja } from '../../features/hoy/agregar-hoja';
import { AvataresHogar } from './avatares-hogar';
import { Campana } from '../../shared/components/campana';
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
 * barra superior con el hogar, los cuatro destinos, Agregar y los avatares (canvas Libreta clara). El + y Agregar abren
 * la hoja Agregar sobre la pantalla actual (`?agregar=` en la URL).
 * Desde 1024 px todas las pantallas con vista de escritorio comparten un contenedor de 1320 px; en móvil se centran a
 * 560 px, salvo data.ancho = 'completo' (Mes, Comparar, Año), que usa todo el ancho. El dato se hereda a las rutas hijas.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, AvataresHogar, AgregarHoja, Campana],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a href="#contenido" class="sr-only-focusable absolute top-2 left-2 z-50 rounded-control bg-superficie px-3 py-2 font-semibold">
      Ir al contenido
    </a>
    <header class="hidden items-center gap-5 border-b border-borde bg-superficie px-8 py-3 lg:flex" data-testid="barra-superior">
      <a routerLink="/hoy" class="flex items-center gap-2.5 pr-2">
        <span class="flex size-8 items-center justify-center rounded-[9px] bg-acento text-white"><app-icono nombre="casa" [tamano]="18" /></span>
        <span class="flex min-w-0 flex-col">
          <span class="text-sm font-bold">Presupuesto Hogar</span>
          @if (nombreHogar(); as nombre) {
            <span class="truncate text-xs text-secundario" data-testid="nombre-hogar">{{ nombre }}</span>
          }
        </span>
      </a>
      <nav aria-label="Navegación principal" class="flex gap-1">
        @for (d of destinos; track d.ruta) {
          <a
            [routerLink]="d.ruta"
            routerLinkActive="bg-acento-elegido !font-semibold !text-acento"
            ariaCurrentWhenActive="page"
            class="flex h-10 items-center rounded-[10px] px-3.5 text-sm font-medium text-texto-medio hover:bg-fondo"
          >{{ d.etiqueta }}</a>
        }
      </nav>
      <div class="ml-auto flex items-center gap-3">
        <app-campana />
        <button type="button" class="boton-primario h-10 gap-2 rounded-control px-4 text-sm" data-testid="agregar-superior" (click)="agregar.abrir()">
          <app-icono nombre="mas" [tamano]="16" />Agregar
        </button>
        <app-avatares-hogar />
      </div>
    </header>

    <main id="contenido" class="min-h-dvh min-w-0 pb-28 lg:min-h-0 lg:pb-12">
      @if (esDemo) {
        <p class="bg-aviso-suave px-4 py-1.5 text-center text-xs font-medium text-aviso" role="note" data-testid="aviso-demo">
          Datos de prueba · se guardan solo en este dispositivo
        </p>
      }
      <div class="mx-auto w-full" [class]="claseAncho()">
        <router-outlet />
      </div>
    </main>

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
      <app-agregar-hoja [tipo]="h.tipo" [item]="h.item" [mes]="h.mes" />
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
    return tipo ? { tipo, item: (params[PARAM_ITEM] as string | undefined) ?? null, mes: (params[PARAM_MES] as string | undefined) ?? null } : null;
  });

  protected readonly claseAncho = computed(() => {
    const ancho = this.datosRuta()['ancho'];
    return ancho === 'completo' ? 'lg:max-w-[1320px]' : ancho === 'escritorio' ? 'max-w-[560px] lg:max-w-[1320px]' : 'max-w-[560px]';
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
