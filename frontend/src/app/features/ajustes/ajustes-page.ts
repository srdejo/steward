import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { formatFechaCorta, formatPorcentaje, type BaseDiezmo, type Categoria, type DiezmoEnHoy, type IngresoFijo } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { SesionActual } from '../../core/sesion/sesion';
import { Avatar } from '../../shared/components/avatar';
import { Hoja } from '../../shared/components/hoja';
import { Interruptor } from '../../shared/components/interruptor';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';

type Dialogo =
  | { tipo: 'invitar' }
  | { tipo: 'ingreso'; ingreso: IngresoFijo }
  | { tipo: 'aportes' }
  | { tipo: 'categoria'; categoria: Categoria | null }
  | { tipo: 'confirmar'; accion: 'salir' | 'restablecer' | 'desde-cero' };

const CONFIRMACIONES = {
  salir: { titulo: 'Salir del hogar', texto: 'Dejarás de ver y registrar en este presupuesto. Los demás miembros lo conservan.', boton: 'Salir del hogar' },
  restablecer: { titulo: 'Restablecer datos de prueba', texto: 'Se borra todo lo que registraste y vuelven los datos de ejemplo.', boton: 'Restablecer' },
  'desde-cero': { titulo: 'Probar desde cero', texto: 'Se borra el hogar de prueba y se cierra la sesión para recorrer el acceso y el onboarding.', boton: 'Empezar desde cero' },
} as const;

/** Ajustes.dc.html: hogar y miembros, mis ingresos y diezmo, categorías, seguridad y privacidad (spec steward-ajustes). */
@Component({
  selector: 'app-ajustes-page',
  imports: [NgTemplateOutlet, RouterLink, Avatar, Hoja, Interruptor, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[22px] px-5 pt-6 pb-4' },
  template: `
    <div class="grid grid-cols-[1fr_auto_1fr] items-center">
      <a routerLink="/hoy" class="boton-texto -my-2 self-start text-sm font-normal">‹ Hoy</a>
      <h1 class="text-[17px] font-semibold">Ajustes</h1>
    </div>

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
        <button type="button" class="flex items-center justify-between gap-3 py-3 text-left" (click)="abrir({ tipo: 'aportes' })">
          <span class="flex flex-col gap-0.5"><span class="text-[15px]">Aportes variables</span><span class="text-xs text-diezmo">Contratos, negocio · {{ textoDiezmoAportes() }}</span></span>
          <span class="text-[13px] text-secundario">Editar ›</span>
        </button>
        <div class="flex items-center justify-between gap-3 py-3">
          <span class="flex flex-col gap-0.5"><span class="text-[15px]" id="diezmo-en-hoy">Diezmo en Hoy</span><span class="text-xs text-secundario">{{ diezmoEnHoy() === 'AGRUPADO' ? 'Uno solo con la suma' : 'Uno por cada ingreso recibido' }}</span></span>
          <div class="grid grid-cols-2 gap-1 rounded-control bg-[#F1F0EB] p-[3px]" role="radiogroup" aria-labelledby="diezmo-en-hoy">
            @for (o of modosDiezmo; track o.valor) {
              <button type="button" role="radio" [attr.aria-checked]="diezmoEnHoy() === o.valor" (click)="definirDiezmoEnHoy(o.valor)"
                class="tocable h-8 rounded-lg px-2.5 text-xs" [class]="diezmoEnHoy() === o.valor ? 'bg-superficie font-semibold' : 'font-medium text-secundario'">{{ o.etiqueta }}</button>
            }
          </div>
        </div>
      </div>
      <p class="text-xs text-secundario">Cada persona configura su propio diezmo.</p>
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
            <button type="button" class="boton-texto font-normal text-secundario" [attr.aria-label]="'Editar ' + c.nombre" (click)="abrir({ tipo: 'categoria', categoria: c })">Editar</button>
          </div>
        }
      </div>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="ajustes-seguridad">
      <h2 id="ajustes-seguridad" class="rotulo">Seguridad y privacidad</h2>
      <div class="flex flex-col divide-y divide-divisor rounded-[14px] border border-borde bg-superficie px-4 py-1">
        <app-interruptor class="py-3" titulo="Face ID al abrir" detalle="Tras 5 min sin usar" [activo]="preferencias().faceIdAlAbrir" (activoChange)="preferir({ faceIdAlAbrir: $event })" />
        <app-interruptor class="py-3" titulo="Ocultar montos" detalle="Muestra $•••• hasta tocar" [activo]="preferencias().ocultarMontos" (activoChange)="preferir({ ocultarMontos: $event })" />
      </div>
    </section>

    @if (esDemo) {
      <section class="flex flex-col gap-2" aria-labelledby="ajustes-demo">
        <h2 id="ajustes-demo" class="rotulo text-aviso">Datos de prueba</h2>
        <div class="flex flex-col divide-y divide-divisor rounded-[14px] border border-dashed border-control bg-superficie px-4 py-1">
          <button type="button" class="h-[46px] text-left text-sm font-semibold text-acento" (click)="abrir({ tipo: 'confirmar', accion: 'restablecer' })">Restablecer datos de prueba</button>
          <button type="button" class="h-[46px] text-left text-sm font-semibold text-acento" (click)="abrir({ tipo: 'confirmar', accion: 'desde-cero' })">Probar desde cero</button>
        </div>
      </section>
    }

    @if (mensaje()) {
      <p role="status" class="text-sm text-positivo">{{ mensaje() }}</p>
    }

    <div class="mt-auto flex flex-col gap-1">
      <button type="button" class="boton h-12 rounded-[14px] border border-[#D9D8D2] bg-superficie" (click)="cerrarSesion()">Cerrar sesión</button>
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
          <app-hoja [titulo]="'Editar ' + d.ingreso.nombre" (cerrar)="cerrar()">
            <label class="flex flex-col gap-2">
              <span class="rotulo">Nombre</span>
              <input class="campo" [value]="texto()" (input)="texto.set($any($event.target).value)" />
            </label>
            <div class="grid grid-cols-2 gap-2.5">
              <app-monto-input etiqueta="Bruto" [(valor)]="bruto" />
              <app-monto-input etiqueta="Entra (neto)" [(valor)]="neto" />
            </div>
            <label class="flex flex-col gap-2">
              <span class="rotulo">Día de pago</span>
              <input class="campo" inputmode="numeric" [value]="dia()" (input)="dia.set(+$any($event.target).value.replace(/\\D/g, '') || 1)" />
            </label>
            <ng-container [ngTemplateOutlet]="pie" [ngTemplateOutletContext]="{ boton: 'Guardar', listo: !!texto().trim() && !!neto() }" />
          </app-hoja>
        }
        @case ('aportes') {
          <app-hoja titulo="Mi diezmo" (cerrar)="cerrar()">
            <app-interruptor titulo="Diezmar de mis ingresos" detalle="Se calcula solo al recibir cada ingreso" [(activo)]="reglaActiva" />
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
      <button type="button" class="boton-grande" [class.bg-negativo]="peligro" [disabled]="!listo" (click)="confirmar()">{{ boton }}</button>
    </ng-template>
  `,
})
export class AjustesPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionActual);
  protected readonly miembros = inject(MiembrosHogar);
  protected readonly esDemo = this.puertos.demo !== null;
  protected readonly confirmaciones = CONFIRMACIONES;

  protected readonly hogar = this.miembros.hogar;
  protected readonly fijos = consulta(() => null, (p) => p.ingresos.fijos());
  private readonly regla = consulta(() => null, (p) => p.ingresos.regla());
  protected readonly categorias = consulta(() => null, (p) => p.hogar.categorias());
  protected readonly preferencias = this.sesion.preferencias;

  protected readonly pendientes = computed(() => (this.hogar.value()?.invitaciones ?? []).filter((i) => i.estado === 'PENDIENTE'));
  protected readonly diezmoEnHoy = computed<DiezmoEnHoy>(() => this.hogar.value()?.hogar.diezmoEnHoy ?? 'SEPARADO');
  protected readonly textoDiezmo = computed(() => {
    const r = this.regla.value();
    return r?.activa ? `diezmo ${formatPorcentaje(r.porcentaje)} del ${r.base === 'BRUTO' ? 'bruto' : 'neto'}` : 'sin diezmo';
  });
  protected readonly textoDiezmoAportes = computed(() => {
    const r = this.regla.value();
    return r?.activa && r.aplicaAportes ? `diezmo ${formatPorcentaje(r.porcentaje)}` : 'sin diezmo';
  });

  protected readonly modosDiezmo: Opcion<DiezmoEnHoy>[] = [
    { valor: 'SEPARADO', etiqueta: 'Separado' },
    { valor: 'AGRUPADO', etiqueta: 'Agrupado' },
  ];
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

  protected fecha(f: string): string {
    return formatFechaCorta(f);
  }

  protected abrir(d: Dialogo): void {
    this.error.set('');
    this.mensaje.set('');
    this.texto.set('');
    if (d.tipo === 'ingreso') {
      this.texto.set(d.ingreso.nombre);
      this.bruto.set(d.ingreso.bruto);
      this.neto.set(d.ingreso.neto);
      this.dia.set(d.ingreso.diaPago);
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

  protected async definirDiezmoEnHoy(modo: DiezmoEnHoy): Promise<void> {
    await this.puertos.hogar.definirDiezmoEnHoy(modo);
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
    if (!d) return;
    this.error.set('');
    try {
      switch (d.tipo) {
        case 'invitar':
          await this.puertos.hogar.invitar(this.texto());
          this.mensaje.set(`Invitación enviada a ${this.texto().trim()}.`);
          break;
        case 'ingreso':
          await this.puertos.ingresos.guardarFijo({ id: d.ingreso.id, nombre: this.texto(), bruto: this.bruto() ?? this.neto()!, neto: this.neto()!, diaPago: this.dia(), cuentaId: d.ingreso.cuentaId });
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
      }
      this.cerrar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  private async ejecutarConfirmacion(accion: 'salir' | 'restablecer' | 'desde-cero'): Promise<void> {
    if (accion === 'restablecer') {
      await this.puertos.demo!.restablecer();
      this.cerrar();
      this.mensaje.set('Volvieron los datos de ejemplo.');
      return;
    }
    if (accion === 'desde-cero') await this.puertos.demo!.probarDesdeCero();
    else await this.puertos.hogar.salir();
    this.sesion.establecer(null);
    this.cerrar();
    await this.router.navigateByUrl('/acceso');
  }
}
