import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { claveMes, formatFechaCorta, formatPorcentaje, mesDe, type BaseDiezmo, type Categoria, type IngresoFijo } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS, puertosConectados } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { SEGURIDAD_DISPONIBLE, SesionActual } from '../../core/sesion/sesion';
import { Avatar } from '../../shared/components/avatar';
import { Hoja } from '../../shared/components/hoja';
import { Interruptor } from '../../shared/components/interruptor';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';
import { anchoEscritorio } from '../../shared/escritorio';

type Dialogo =
  | { tipo: 'invitar' }
  /** `ingreso` null: "+ Agregar ingreso fijo", para quien no lo configuro en el onboarding. */
  | { tipo: 'ingreso'; ingreso: IngresoFijo | null }
  | { tipo: 'aportes' }
  | { tipo: 'categoria'; categoria: Categoria | null }
  | { tipo: 'confirmar'; accion: 'salir' | 'restablecer' | 'desde-cero' }
  | { tipo: 'empezar' }
  | { tipo: 'eliminar' };

const CONFIRMACIONES = {
  salir: { titulo: 'Salir del hogar', texto: 'Dejarás de ver y registrar en este presupuesto. Los demás miembros lo conservan.', boton: 'Salir del hogar' },
  restablecer: { titulo: 'Restablecer datos de prueba', texto: 'Se borra todo lo que registraste y vuelven los datos de ejemplo.', boton: 'Restablecer' },
  'desde-cero': { titulo: 'Probar desde cero', texto: 'Se borra el hogar de prueba y se cierra la sesión para recorrer el acceso y el onboarding.', boton: 'Empezar desde cero' },
} as const;

/**
 * Ajustes.dc.html: hogar y miembros, mis ingresos y diezmo, categorías, seguridad y privacidad (spec steward-ajustes).
 * Desde 1024 px, AjustesWeb.dc.html: las secciones como tarjetas en cuadrícula (spec "Ajustes en escritorio").
 */
@Component({
  selector: 'app-ajustes-page',
  imports: [NgTemplateOutlet, RouterLink, Avatar, Hoja, Interruptor, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-[22px] px-9 pt-7 pb-10' : 'flex flex-col gap-[22px] px-5 pt-6 pb-4'" },
  template: `
    @if (escritorio()) {
      <h1 class="text-[28px] font-bold">Ajustes</h1>
    } @else {
    <div class="grid grid-cols-[1fr_auto_1fr] items-center">
      <a routerLink="/hoy" class="boton-texto -my-2 self-start text-sm font-normal">‹ Ejecución</a>
      <h1 class="text-[17px] font-semibold">Ajustes</h1>
    </div>
    }

    @if (escritorio()) {
      <!-- AjustesWeb.dc.html: las mismas secciones como tarjetas en cuadrícula (web-escritorio-completo). -->
      <div class="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(420px,1fr))]" data-testid="ajustes-cuadricula">
        @if (hogar.value(); as h) {
          <section class="tarjeta flex flex-col gap-3.5 p-5" aria-labelledby="ajustes-hogar">
            <div class="flex flex-col gap-0.5">
              <h2 id="ajustes-hogar" class="text-base font-semibold">Hogar · {{ h.hogar.nombre }}</h2>
              <p class="text-[13px] text-secundario">Todos los miembros tienen los mismos permisos.</p>
            </div>
            <div class="flex flex-col">
              @for (m of miembros.miembros(); track m.usuario.id) {
                <div class="flex items-center gap-3 border-t border-divisor py-2.5" data-testid="miembro">
                  <app-avatar [inicial]="m.usuario.inicial" [variante]="m.variante" />
                  <span class="grow text-sm">{{ m.usuario.nombre }}@if (m.esActual) {<span class="ml-1 text-secundario">(tú)</span>}</span>
                  @if (!m.esActual && m.unidoEn) {
                    <span class="text-xs text-secundario">Se unió el {{ fecha(m.unidoEn) }}</span>
                  }
                </div>
              }
              @for (inv of pendientes(); track inv.id) {
                <div class="flex items-center gap-3 border-t border-divisor py-2.5" data-testid="invitacion-pendiente">
                  <app-avatar [inicial]="inv.email.charAt(0).toUpperCase()" variante="suave" />
                  <span class="flex min-w-0 grow flex-col"><span class="truncate text-sm">{{ inv.email }}</span><span class="text-xs text-aviso">Invitación pendiente</span></span>
                </div>
              }
            </div>
            <form class="flex gap-2" (submit)="$event.preventDefault(); invitarDirecto()">
              <input type="email" class="h-10 min-w-0 grow rounded-control border border-[#D9D8D2] bg-superficie px-3 text-sm" placeholder="Invitar por correo" aria-label="Invitar por correo"
                [value]="correoInvitar()" (input)="correoInvitar.set($any($event.target).value)" />
              <button type="submit" class="boton h-10 rounded-control bg-acento px-3.5 text-sm text-white" [disabled]="!correoInvitar().trim() || ocupado()">Invitar</button>
            </form>
            @if (errorInvitar()) {
              <p role="alert" class="text-sm text-negativo">{{ errorInvitar() }}</p>
            }
          </section>
        }

        <section class="tarjeta flex flex-col gap-3.5 p-5" aria-labelledby="ajustes-ingresos">
          <div class="flex flex-col gap-0.5">
            <h2 id="ajustes-ingresos" class="text-base font-semibold">Mis ingresos y diezmo</h2>
            <p class="text-[13px] text-secundario">Cada persona configura su propio diezmo.</p>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl bg-diezmo-suave px-3 py-2.5">
            <span class="text-[13px] font-medium text-diezmo" data-testid="regla-diezmo">{{ textoDiezmo() === 'sin diezmo' ? 'Sin diezmo' : 'Diezmo ' + textoDiezmo().replace('diezmo ', '') }}</span>
            <button type="button" class="boton-texto font-semibold" (click)="abrir({ tipo: 'aportes' })">Cambiar</button>
          </div>
          <table class="w-full border-collapse text-sm" data-testid="tabla-ingresos">
            <thead>
              <tr class="text-left text-[11px] font-semibold tracking-[0.06em] text-secundario">
                <th scope="col" class="py-2">INGRESO</th>
                <th scope="col" class="w-[110px] py-2 text-right">BRUTO</th>
                <th scope="col" class="w-[110px] py-2 text-right">ENTRA</th>
                <th scope="col" class="w-[70px] py-2"><span class="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              @for (f of fijos.value() ?? []; track f.id) {
                <tr class="border-t border-divisor" [attr.data-ingreso]="f.nombre">
                  <th scope="row" class="py-2.5 text-left font-normal">{{ f.nombre }}<span class="block text-xs text-diezmo">Fijo · día {{ f.diaPago }}</span></th>
                  <td class="monto py-2.5 text-right text-[13px]"><app-monto [valor]="f.bruto" /></td>
                  <td class="monto py-2.5 text-right text-[13px]"><app-monto [valor]="f.neto" /></td>
                  <td class="py-1 text-right"><button type="button" class="boton-texto font-semibold" [attr.aria-label]="'Editar ' + f.nombre" (click)="abrir({ tipo: 'ingreso', ingreso: f })">Editar</button></td>
                </tr>
              }
              <tr class="border-t border-divisor">
                <th scope="row" class="py-2.5 text-left font-normal">Aportes variables<span class="block text-xs text-secundario">Contratos, negocio · {{ textoDiezmoAportes() }}</span></th>
                <td class="py-2.5 text-right text-[13px] text-[#9A9C95]">—</td>
                <td class="py-2.5 text-right text-[13px] text-[#9A9C95]">—</td>
                <td class="py-1 text-right"><button type="button" class="boton-texto font-semibold" aria-label="Editar aportes variables" (click)="abrir({ tipo: 'aportes' })">Editar</button></td>
              </tr>
            </tbody>
          </table>
          <button type="button" class="boton-texto self-start font-semibold" (click)="abrir({ tipo: 'ingreso', ingreso: null })">+ Agregar ingreso fijo</button>
        </section>

        <section class="tarjeta flex flex-col gap-3 p-5" aria-labelledby="ajustes-categorias">
          <div class="flex items-center justify-between">
            <h2 id="ajustes-categorias" class="text-base font-semibold">Categorías</h2>
            <button type="button" class="boton-texto font-semibold" (click)="abrir({ tipo: 'categoria', categoria: null })">+ Nueva</button>
          </div>
          <div class="flex flex-col">
            @for (c of categorias.value() ?? []; track c.id) {
              <div class="flex items-center gap-3 border-t border-divisor py-2" data-testid="categoria">
                <span class="h-3 w-3 shrink-0 rounded-[4px]" [style.background]="c.color" aria-hidden="true"></span>
                <span class="grow text-sm font-medium">{{ c.nombre }}</span>
                @if (c.tipo === 'DIEZMO') {
                  <span class="text-xs text-secundario">Del sistema</span>
                } @else {
                  <button type="button" class="boton-texto font-normal text-secundario" [attr.aria-label]="'Editar ' + c.nombre" (click)="abrir({ tipo: 'categoria', categoria: c })">Editar</button>
                }
              </div>
            }
          </div>
        </section>

        @if (seguridadDisponible) {
          <section class="tarjeta flex flex-col gap-1 p-5" aria-labelledby="ajustes-seguridad">
            <h2 id="ajustes-seguridad" class="pb-2 text-base font-semibold">Seguridad y privacidad</h2>
            <app-interruptor class="border-t border-divisor py-2.5" titulo="Face ID al abrir" detalle="Tras 5 min sin usar" [activo]="preferencias().faceIdAlAbrir" (activoChange)="preferir({ faceIdAlAbrir: $event })" />
            <app-interruptor class="border-t border-divisor py-2.5" titulo="Ocultar montos" detalle="Muestra $•••• hasta tocar" [activo]="preferencias().ocultarMontos" (activoChange)="preferir({ ocultarMontos: $event })" />
          </section>
        }
      </div>
    } @else {

    @if (hogar.value(); as h) {
      <section class="flex flex-col gap-2" aria-labelledby="ajustes-hogar">
        <h2 id="ajustes-hogar" class="rotulo">Hogar · {{ h.hogar.nombre }}</h2>
        <div class="flex flex-col divide-y divide-divisor rounded-[14px] border border-borde bg-superficie px-4 py-1">
          @for (m of miembros.miembros(); track m.usuario.id) {
            <div class="flex items-center gap-3 py-3" data-testid="miembro">
              <app-avatar [inicial]="m.usuario.inicial" [variante]="m.variante" />
              <span class="grow text-[15px]">{{ m.usuario.nombre }}@if (m.esActual) {<span class="ml-1 text-secundario">(tú)</span>}</span>
              @if (!m.esActual && m.unidoEn) {
                <span class="text-xs text-secundario">Se unió el {{ fecha(m.unidoEn) }}</span>
              }
            </div>
          }
          @for (inv of pendientes(); track inv.id) {
            <div class="flex items-center gap-3 py-3">
              <app-avatar [inicial]="inv.email.charAt(0).toUpperCase()" variante="suave" />
              <span class="flex min-w-0 grow flex-col"><span class="truncate text-[15px]">{{ inv.email }}</span><span class="text-xs text-aviso">Invitación pendiente</span></span>
            </div>
          }
          <button type="button" class="h-[46px] text-left text-sm font-semibold text-acento" (click)="abrir({ tipo: 'invitar' })">+ Invitar a alguien más</button>
        </div>
      </section>
    }

    <section class="flex flex-col gap-2" aria-labelledby="ajustes-ingresos">
      <h2 id="ajustes-ingresos" class="rotulo">Mis ingresos y diezmo</h2>
      <div class="flex flex-col divide-y divide-divisor rounded-[14px] border border-borde bg-superficie px-4 py-1">
        @for (f of fijos.value() ?? []; track f.id) {
          <button type="button" class="flex items-center justify-between gap-3 py-3 text-left" (click)="abrir({ tipo: 'ingreso', ingreso: f })">
            <span class="flex flex-col gap-0.5"><span class="text-[15px]">{{ f.nombre }}</span><span class="text-xs text-diezmo">Fijo · {{ textoDiezmo() }}</span></span>
            <span class="text-[13px]"><app-monto [valor]="f.neto" /> ›</span>
          </button>
        }
        <button type="button" class="h-[46px] text-left text-sm font-semibold text-acento" (click)="abrir({ tipo: 'ingreso', ingreso: null })">+ Agregar ingreso fijo</button>
        <button type="button" class="flex items-center justify-between gap-3 py-3 text-left" (click)="abrir({ tipo: 'aportes' })">
          <span class="flex flex-col gap-0.5"><span class="text-[15px]">Aportes variables</span><span class="text-xs text-diezmo">Contratos, negocio · {{ textoDiezmoAportes() }}</span></span>
          <span class="text-[13px] text-secundario">Editar ›</span>
        </button>
      </div>
      <p class="text-xs text-secundario" data-testid="nota-regla">Cada persona configura su propio diezmo. La regla sugiere el monto de los ítems de diezmo de cada mes nuevo; cambiarla no cambia los meses ya creados.</p>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="ajustes-categorias">
      <div class="flex items-center justify-between">
        <h2 id="ajustes-categorias" class="rotulo">Categorías</h2>
        <button type="button" class="boton-texto font-semibold" (click)="abrir({ tipo: 'categoria', categoria: null })">+ Nueva</button>
      </div>
      <div class="flex flex-col divide-y divide-divisor rounded-[14px] border border-borde bg-superficie px-4 py-1">
        @for (c of categorias.value() ?? []; track c.id) {
          <div class="flex items-center gap-2.5 py-3" data-testid="categoria">
            <span class="h-2.5 w-2.5 rounded-[3px]" [style.background]="c.color" aria-hidden="true"></span>
            <span class="grow text-[15px]">{{ c.nombre }}</span>
            <!-- Diezmo es la categoria del sistema y no se renombra (diezmo-como-gasto). -->
            @if (c.tipo === 'DIEZMO') {
              <span class="text-xs text-secundario">Del sistema</span>
            } @else {
              <button type="button" class="boton-texto font-normal text-secundario" [attr.aria-label]="'Editar ' + c.nombre" (click)="abrir({ tipo: 'categoria', categoria: c })">Editar</button>
            }
          </div>
        }
      </div>
    </section>

    @if (seguridadDisponible) {
      <section class="flex flex-col gap-2" aria-labelledby="ajustes-seguridad">
        <h2 id="ajustes-seguridad" class="rotulo">Seguridad y privacidad</h2>
        <div class="flex flex-col divide-y divide-divisor rounded-[14px] border border-borde bg-superficie px-4 py-1">
          <app-interruptor class="py-3" titulo="Face ID al abrir" detalle="Tras 5 min sin usar" [activo]="preferencias().faceIdAlAbrir" (activoChange)="preferir({ faceIdAlAbrir: $event })" />
          <app-interruptor class="py-3" titulo="Ocultar montos" detalle="Muestra $•••• hasta tocar" [activo]="preferencias().ocultarMontos" (activoChange)="preferir({ ocultarMontos: $event })" />
        </div>
      </section>
    }

    }

    @if (esDemo) {
      <section class="flex flex-col gap-2" aria-labelledby="ajustes-demo">
        <h2 id="ajustes-demo" class="rotulo text-aviso">Datos de prueba</h2>
        <div class="flex flex-col divide-y divide-divisor rounded-[14px] border border-dashed border-control bg-superficie px-4 py-1">
          <button type="button" class="h-[46px] text-left text-sm font-semibold text-acento" (click)="abrir({ tipo: 'confirmar', accion: 'restablecer' })">Restablecer datos de prueba</button>
          @if (!conectado) {
            <button type="button" class="h-[46px] text-left text-sm font-semibold text-acento" (click)="abrir({ tipo: 'confirmar', accion: 'desde-cero' })">Probar desde cero</button>
          }
        </div>
      </section>
    }

    @if (mensaje()) {
      <p role="status" class="text-sm text-positivo">{{ mensaje() }}</p>
    }

    <div class="mt-auto flex flex-col gap-1">
      <button type="button" class="boton h-12 rounded-[14px] border border-[#D9D8D2] bg-superficie" (click)="cerrarSesion()">Cerrar sesión</button>
      <button type="button" class="flex min-h-11 items-center justify-center text-sm font-medium text-negativo" (click)="abrir({ tipo: 'empezar' })">Empezar de nuevo</button>
      <button type="button" class="flex min-h-11 items-center justify-center text-sm font-medium text-negativo" (click)="abrir({ tipo: 'eliminar' })">Eliminar mi cuenta</button>
      <a class="flex min-h-11 items-center justify-center text-sm text-secundario underline" href="https://srdejo.github.io/steward-privacy" target="_blank" rel="noopener">Política de privacidad</a>
      <button type="button" class="flex min-h-11 items-center justify-center text-sm font-medium text-negativo" (click)="abrir({ tipo: 'confirmar', accion: 'salir' })">Salir del hogar</button>
    </div>

    @if (dialogo(); as d) {
      @switch (d.tipo) {
        @case ('invitar') {
          <app-hoja titulo="Invitar al hogar" (cerrar)="cerrar()">
            <label class="flex flex-col gap-2">
              <span class="rotulo">Correo</span>
              <input type="email" class="campo" placeholder="correo@ejemplo.com" [value]="texto()" (input)="texto.set($any($event.target).value)" />
            </label>
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: 'Invitar', listo: !!texto().trim() }" />
          </app-hoja>
        }
        @case ('ingreso') {
          <app-hoja [titulo]="d.ingreso ? 'Editar ' + d.ingreso.nombre : 'Nuevo ingreso fijo'" (cerrar)="cerrar()">
            <label class="flex flex-col gap-2">
              <span class="rotulo">Nombre</span>
              <input class="campo" placeholder="Ej: Salario" [value]="texto()" (input)="texto.set($any($event.target).value)" />
            </label>
            <div class="grid grid-cols-2 gap-2.5">
              <app-monto-input etiqueta="Bruto" [(valor)]="bruto" />
              <app-monto-input etiqueta="Entra (neto)" [(valor)]="neto" />
            </div>
            <label class="flex flex-col gap-2">
              <span class="rotulo">Día de pago</span>
              <input class="campo" inputmode="numeric" [value]="dia()" (input)="dia.set(+$any($event.target).value.replace(/\\D/g, '') || 1)" />
            </label>
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: d.ingreso ? 'Guardar' : 'Agregar ingreso', listo: !!texto().trim() && !!neto() }" />
          </app-hoja>
        }
        @case ('aportes') {
          <app-hoja titulo="Mi diezmo" (cerrar)="cerrar()">
            <app-interruptor titulo="Diezmar de mis ingresos" detalle="Sugiere el diezmo de cada ingreso al crear el mes" [(activo)]="reglaActiva" />
            @if (reglaActiva()) {
              <label class="flex items-center justify-between gap-3">
                <span class="text-sm font-medium">Porcentaje</span>
                <input class="monto h-11 w-20 rounded-control border border-borde-campo bg-fondo text-center focus:border-acento focus:outline-none" inputmode="numeric"
                  [value]="porcentaje() + '%'" (input)="porcentaje.set(+$any($event.target).value.replace(/\\D/g, '') || 0)" />
              </label>
              <app-segmentado etiqueta="Calcular sobre" [opciones]="bases" [(valor)]="base" />
              <app-interruptor titulo="También de mis aportes variables" detalle="Contratos, negocio" [(activo)]="aplicaAportes" />
            }
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: 'Guardar', listo: true }" />
          </app-hoja>
        }
        @case ('categoria') {
          <app-hoja [titulo]="d.categoria ? 'Editar categoría' : 'Nueva categoría'" (cerrar)="cerrar()">
            <label class="flex flex-col gap-2">
              <span class="rotulo">Nombre</span>
              <input class="campo" placeholder="Ej: Educación" [value]="texto()" (input)="texto.set($any($event.target).value)" />
            </label>
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: d.categoria ? 'Guardar' : 'Crear categoría', listo: !!texto().trim() }" />
          </app-hoja>
        }
        @case ('eliminar') {
          <app-hoja titulo="Eliminar mi cuenta" (cerrar)="cerrar()">
            <p class="text-[15px] text-secundario">Se borran tu cuenta y tus datos personales, y no se puede deshacer. Si eres el único miembro, también se borra el hogar con todo lo suyo. Si compartes el hogar, lo que registraste se queda para los demás a nombre de "Ex miembro".</p>
            <label class="flex flex-col gap-2">
              <span class="rotulo">Escribe ELIMINAR para confirmar</span>
              <input class="campo" autocomplete="off" [value]="texto()" (input)="texto.set($any($event.target).value)" />
            </label>
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: 'Eliminar mi cuenta', listo: texto().trim() === 'ELIMINAR', peligro: true }" />
          </app-hoja>
        }
        @case ('empezar') {
          <app-hoja titulo="Empezar de nuevo" (cerrar)="cerrar()">
            <p class="text-[15px] text-secundario">Se borran todos los planes, los cierres, el plan anual y lo registrado. Se conservan los miembros, los ingresos, las reglas, las categorías, las cuentas con su saldo de hoy y los créditos.</p>
            <label class="flex flex-col gap-2">
              <span class="rotulo">Escribe EMPEZAR para confirmar</span>
              <input class="campo" autocomplete="off" [value]="texto()" (input)="texto.set($any($event.target).value)" />
            </label>
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: 'Empezar de nuevo', listo: texto().trim() === 'EMPEZAR', peligro: true }" />
          </app-hoja>
        }
        @case ('confirmar') {
          <app-hoja [titulo]="confirmaciones[d.accion].titulo" (cerrar)="cerrar()">
            <p class="text-[15px] text-secundario">{{ confirmaciones[d.accion].texto }}</p>
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: confirmaciones[d.accion].boton, listo: true, peligro: d.accion === 'salir' }" />
          </app-hoja>
        }
      }
    }

    <ng-template #pie let-boton="boton" let-listo="listo" let-peligro="peligro">
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
      <button type="button" class="boton-grande" [class.bg-negativo]="peligro" [disabled]="!listo || ocupado()" (click)="confirmar()">{{ boton }}</button>
    </ng-template>
  `,
})
export class AjustesPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionActual);
  protected readonly miembros = inject(MiembrosHogar);
  protected readonly esDemo = this.puertos.demo !== null;
  protected readonly escritorio = anchoEscritorio();
  /** Modo conectado: el hogar es real, asi que no hay "Probar desde cero" (spec steward-ui-shell). */
  protected readonly conectado = puertosConectados(this.puertos) !== null;
  protected readonly confirmaciones = CONFIRMACIONES;
  protected readonly seguridadDisponible = SEGURIDAD_DISPONIBLE;

  protected readonly hogar = this.miembros.hogar;
  protected readonly fijos = consulta(() => null, (p) => p.ingresos.fijos());
  private readonly regla = consulta(() => null, (p) => p.ingresos.regla());
  protected readonly categorias = consulta(() => null, (p) => p.hogar.categorias());
  protected readonly preferencias = this.sesion.preferencias;

  protected readonly pendientes = computed(() => (this.hogar.value()?.invitaciones ?? []).filter((i) => i.estado === 'PENDIENTE'));
  protected readonly textoDiezmo = computed(() => {
    const r = this.regla.value();
    return r?.activa ? `diezmo ${formatPorcentaje(r.porcentaje)} del ${r.base === 'BRUTO' ? 'bruto' : 'neto'}` : 'sin diezmo';
  });
  protected readonly textoDiezmoAportes = computed(() => {
    const r = this.regla.value();
    return r?.activa && r.aplicaAportes ? `diezmo ${formatPorcentaje(r.porcentaje)}` : 'sin diezmo';
  });

  protected readonly bases: Opcion<BaseDiezmo>[] = [
    { valor: 'BRUTO', etiqueta: 'Bruto' },
    { valor: 'NETO', etiqueta: 'Neto' },
  ];

  protected readonly dialogo = signal<Dialogo | null>(null);
  protected readonly texto = signal('');
  protected readonly bruto = signal<number | null>(null);
  protected readonly neto = signal<number | null>(null);
  protected readonly dia = signal(1);
  protected readonly reglaActiva = signal(true);
  protected readonly porcentaje = signal(10);
  protected readonly base = signal<BaseDiezmo | null>('BRUTO');
  protected readonly aplicaAportes = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  /** "Invitar por correo" de la tarjeta Hogar en escritorio. */
  protected readonly correoInvitar = signal('');
  protected readonly errorInvitar = signal('');
  /** Mientras la peticion va en camino el boton no responde: un doble toque no invita ni guarda dos veces. */
  protected readonly ocupado = signal(false);

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  /** Invita desde la tarjeta Hogar, sin hoja (spec "Ajustes en escritorio"). */
  protected async invitarDirecto(): Promise<void> {
    const correo = this.correoInvitar().trim();
    if (!correo || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorInvitar.set('');
    this.mensaje.set('');
    try {
      await this.puertos.hogar.invitar(correo);
      this.correoInvitar.set('');
      this.mensaje.set(`Invitación enviada a ${correo}.`);
    } catch (e) {
      this.errorInvitar.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected abrir(d: Dialogo): void {
    this.error.set('');
    this.mensaje.set('');
    this.texto.set('');
    if (d.tipo === 'ingreso') {
      this.texto.set(d.ingreso?.nombre ?? '');
      this.bruto.set(d.ingreso?.bruto ?? null);
      this.neto.set(d.ingreso?.neto ?? null);
      this.dia.set(d.ingreso?.diaPago ?? 1);
    }
    if (d.tipo === 'categoria' && d.categoria) this.texto.set(d.categoria.nombre);
    if (d.tipo === 'aportes') {
      const r = this.regla.value();
      this.reglaActiva.set(r?.activa ?? false);
      this.porcentaje.set(r?.porcentaje ?? 10);
      this.base.set(r?.base ?? 'BRUTO');
      this.aplicaAportes.set(r?.aplicaAportes ?? false);
    }
    this.dialogo.set(d);
  }

  protected cerrar(): void {
    this.dialogo.set(null);
  }

  protected async preferir(cambios: { faceIdAlAbrir?: boolean; ocultarMontos?: boolean }): Promise<void> {
    await this.sesion.guardarPreferencias(cambios);
  }

  protected async cerrarSesion(): Promise<void> {
    await this.sesion.cerrar();
    await this.router.navigateByUrl('/acceso');
  }

  protected async confirmar(): Promise<void> {
    const d = this.dialogo();
    if (!d || this.ocupado()) return;
    this.error.set('');
    this.ocupado.set(true);
    try {
      switch (d.tipo) {
        case 'invitar':
          await this.puertos.hogar.invitar(this.texto());
          this.mensaje.set(`Invitación enviada a ${this.texto().trim()}.`);
          break;
        case 'ingreso':
          await this.puertos.ingresos.guardarFijo({ id: d.ingreso?.id, nombre: this.texto(), bruto: this.bruto() ?? this.neto()!, neto: this.neto()!, diaPago: this.dia(), cuentaId: d.ingreso?.cuentaId ?? null });
          break;
        case 'aportes':
          await this.puertos.ingresos.guardarRegla({ activa: this.reglaActiva(), porcentaje: this.porcentaje() || 10, base: this.base() ?? 'BRUTO', aplicaAportes: this.reglaActiva() && this.aplicaAportes() });
          break;
        case 'categoria':
          await this.puertos.hogar.guardarCategoria({ id: d.categoria?.id, nombre: this.texto() });
          break;
        case 'confirmar':
          await this.ejecutarConfirmacion(d.accion);
          return;
        case 'eliminar':
          await this.puertos.sesion.eliminarCuenta();
          this.sesion.establecer(null);
          this.cerrar();
          await this.router.navigateByUrl('/acceso');
          return;
        case 'empezar':
          await this.puertos.hogar.empezarDeNuevo();
          this.cerrar();
          await this.router.navigate(['/planear', claveMes(mesDe(this.puertos.hoy()))]);
          return;
      }
      this.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  private async ejecutarConfirmacion(accion: 'salir' | 'restablecer' | 'desde-cero'): Promise<void> {
    if (accion === 'restablecer') {
      await this.puertos.demo!.restablecer();
      this.cerrar();
      this.mensaje.set('Volvieron los datos de ejemplo.');
      return;
    }
    if (accion === 'salir' && this.conectado) {
      // La sesion sigue: sin hogar, el onboarding permite crear otro o unirse a uno.
      await this.puertos.hogar.salir();
      this.cerrar();
      await this.sesion.recargar();
      await this.router.navigateByUrl('/onboarding/1');
      return;
    }
    if (accion === 'desde-cero') await this.puertos.demo!.probarDesdeCero();
    else await this.puertos.hogar.salir();
    this.sesion.establecer(null);
    this.cerrar();
    await this.router.navigateByUrl('/acceso');
  }
}
