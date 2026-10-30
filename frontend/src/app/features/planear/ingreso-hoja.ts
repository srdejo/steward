import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import type { Id, IngresoPlan } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { SesionActual } from '../../core/sesion/sesion';
import { Hoja } from '../../shared/components/hoja';
import { Interruptor } from '../../shared/components/interruptor';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';

/**
 * Una linea de ingreso de la opcion, con "Guardar" (design D5 de usabilidad-plan): cerrar sin guardar no cambia nada. El bruto
 * se pide cuando importa para el diezmo; sin tocarlo, sigue al monto.
 */
@Component({
  selector: 'app-ingreso-hoja',
  imports: [Hoja, Interruptor, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="linea() ? 'Editar ingreso' : 'Nuevo ingreso'" [antetitulo]="'Opción ' + letra()" (cerrar)="cerrar.emit()">
      @if (quitando()) {
        <p class="text-[15px] text-secundario">¿Quitar {{ linea()!.nombre }} de la Opción {{ letra() }}?</p>
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande bg-negativo" [disabled]="guardando()" (click)="quitar()">Sí, quitar</button>
      } @else {
        <label class="flex flex-col gap-2">
          <span class="rotulo">Nombre</span>
          <input class="campo" placeholder="Ej: Venta bicicleta" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
        </label>
        <app-monto-input etiqueta="Monto" [(valor)]="monto" />
        @if (conBruto()) {
          <app-monto-input etiqueta="Bruto" [(valor)]="bruto" placeholder="Igual al monto" ayuda="Sobre este valor se calcula el diezmo cuando la regla usa el bruto." />
        }
        <app-segmentado etiqueta="Persona · Opcional" [chips]="true" [opcional]="true" [opciones]="personas()" [(valor)]="persona" />
        @if (!linea()) {
          <app-interruptor titulo="Aplicar diezmo" detalle="Agrega su diezmo al plan" [(activo)]="aplicarDiezmo" />
        }
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="!nombre().trim() || monto() === null || guardando()" (click)="guardar()">Guardar</button>
        @if (linea()) {
          <button type="button" class="boton-texto self-center font-normal text-negativo" (click)="quitando.set(true)">Quitar</button>
        }
      }
    </app-hoja>
  `,
})
export class IngresoHoja implements OnInit {
  private readonly puertos = inject(PUERTOS);
  private readonly miembros = inject(MiembrosHogar);
  private readonly sesion = inject(SesionActual);

  readonly planId = input.required<Id>();
  readonly escenarioId = input.required<Id>();
  readonly letra = input.required<string>();
  /** null: "+ Ingreso". */
  readonly linea = input<IngresoPlan | null>(null);
  readonly cerrar = output<void>();
  readonly guardado = output<void>();

  private readonly regla = consulta(() => null, (p) => p.ingresos.regla());
  protected readonly personas = computed<Opcion<Id>[]>(() => this.miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre })));

  protected readonly nombre = signal('');
  protected readonly monto = signal<number | null>(null);
  protected readonly bruto = signal<number | null>(null);
  protected readonly persona = signal<Id | null>(null);
  protected readonly aplicarDiezmo = signal(false);
  protected readonly quitando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  /** Solo se conoce la regla propia: una linea de un ingreso fijo o con un bruto distinto tambien lo muestra. */
  protected readonly conBruto = computed(() => {
    const l = this.linea();
    const r = this.regla.value();
    const propia = this.persona() === this.sesion.usuario()?.id && r?.activa === true && r.base === 'BRUTO';
    return l?.tipo === 'FIJO' || (l !== null && l.bruto !== l.monto) || propia;
  });

  ngOnInit(): void {
    const l = this.linea();
    this.nombre.set(l?.nombre ?? '');
    this.monto.set(l?.monto ?? null);
    this.bruto.set(l && l.bruto !== l.monto ? l.bruto : null);
    this.persona.set(l ? l.usuarioId : this.sesion.usuario()?.id ?? null);
  }

  protected guardar(): Promise<void> {
    const l = this.linea();
    const monto = this.monto()!;
    const datos: Omit<IngresoPlan, 'id'> & { id?: Id } = {
      id: l?.id, nombre: this.nombre(), monto, bruto: this.conBruto() ? this.bruto() ?? monto : monto,
      usuarioId: this.persona(), tipo: l?.tipo ?? 'OTRO', ingresoFijoId: l?.ingresoFijoId ?? null,
    };
    return this.ejecutar(() => this.puertos.plan.guardarIngreso(this.planId(), this.escenarioId(), datos, !l && this.aplicarDiezmo()));
  }

  protected quitar(): Promise<void> {
    return this.ejecutar(() => this.puertos.plan.quitarIngreso(this.planId(), this.escenarioId(), this.linea()!.id));
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await accion();
      this.guardado.emit();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
