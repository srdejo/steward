import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, resource, signal } from '@angular/core';
import { nombreMes, nombreMesCapital, type Categoria, type DatosEvento, type EventoAnual, type Id, type TipoEvento } from '@steward/domain';

import { mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { Hoja } from '../../shared/components/hoja';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * "Algo distinto en un mes" (AnualCambios.dc.html, AnualCambioMovil.dc.html): un ingreso o un gasto del año, en su categoria,
 * solo ese mes o de ese mes en adelante. Antes de guardar dice en cuanto queda el mes (spec steward-planear, "Plan anual").
 */
@Component({
  selector: 'app-cambio-hoja',
  imports: [Hoja, Monto, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="'Algo distinto en ' + nombreMes(mes())" [antetitulo]="'Plan ' + anio()" (cerrar)="cerrar.emit()">
      @if (quitando()) {
        <p class="text-[15px] text-secundario">¿Quitar {{ evento()!.nombre }} del plan {{ anio() }}?</p>
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande bg-negativo" [disabled]="guardando()" (click)="quitar()">Sí, quitar</button>
      } @else {
        <app-segmentado etiqueta="Tipo" [opciones]="tipos" [valor]="tipo()" (valorChange)="$event && tipo.set($event)" />
        <label class="flex flex-col gap-2">
          <span class="rotulo">¿Qué es?</span>
          <input class="campo" [placeholder]="tipo() === 'GASTO' ? 'Ej: SOAT' : 'Ej: Prima'" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-2">
            <span class="rotulo">Mes</span>
            <select class="campo" [value]="mes()" (change)="mes.set(+$any($event.target).value)">
              @for (m of meses; track m) {
                <option [value]="m" [selected]="m === mes()">{{ nombreMesCapital(m) }}</option>
              }
            </select>
          </label>
          <app-monto-input etiqueta="¿Cuánto?" [(valor)]="monto" />
        </div>
        @if (tipo() === 'GASTO') {
          <app-segmentado etiqueta="Categoría" [chips]="true" [opciones]="opcionesCategoria()" [valor]="categoria()" (valorChange)="categoria.set($event ?? '')" />
        } @else {
          <app-segmentado etiqueta="De quién · hereda su diezmo" [chips]="true" [opcional]="true" [opciones]="personas()" [(valor)]="persona" />
        }
        <fieldset class="flex flex-col gap-1">
          <legend class="rotulo pb-1">¿Cuándo?</legend>
          <label class="flex min-h-10 items-center gap-2.5 text-[15px]"><input type="radio" name="cuando" class="size-5 accent-acento" [checked]="!enAdelante()" (change)="enAdelante.set(false)" />Solo en {{ nombreMes(mes()) }}</label>
          <label class="flex min-h-10 items-center gap-2.5 text-[15px]"><input type="radio" name="cuando" class="size-5 accent-acento" [checked]="enAdelante()" (change)="enAdelante.set(true)" />De {{ nombreMes(mes()) }} en adelante</label>
        </fieldset>
        @if (queda(); as q) {
          <p class="flex justify-between text-[13px] text-secundario" data-testid="queda">
            <span>{{ nombreMesCapital(mes()) }} queda en</span><app-monto class="text-texto" [class.text-negativo]="q < 0" [valor]="q" />
          </p>
        }
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="!listo() || guardando()" (click)="guardar()">Guardar</button>
        @if (evento()) {
          <button type="button" class="boton-texto self-center font-normal text-negativo" (click)="quitando.set(true)">Quitar</button>
        }
      }
    </app-hoja>
  `,
})
export class CambioHoja implements OnInit {
  private readonly puertos = inject(PUERTOS);
  private readonly miembros = inject(MiembrosHogar);

  readonly anio = input.required<number>();
  /** El mes con que abre "+ Algo distinto" o el mes tocado en la lista. */
  readonly mesInicial = input(1);
  readonly categorias = input.required<Categoria[]>();
  /** null: un cambio nuevo. */
  readonly evento = input<EventoAnual | null>(null);
  readonly cerrar = output<void>();
  readonly guardado = output<void>();

  protected readonly meses = MESES;
  protected readonly tipos: Opcion<TipoEvento>[] = [
    { valor: 'INGRESO', etiqueta: 'Ingreso' },
    { valor: 'GASTO', etiqueta: 'Gasto' },
  ];
  protected readonly nombreMes = nombreMes;
  protected readonly nombreMesCapital = nombreMesCapital;

  protected readonly tipo = signal<TipoEvento>('GASTO');
  protected readonly nombre = signal('');
  protected readonly mes = signal(1);
  protected readonly monto = signal<number | null>(null);
  /** null: "Eventos del año". */
  protected readonly categoria = signal<Id | null>(null);
  protected readonly persona = signal<Id | null>(null);
  protected readonly enAdelante = signal(false);
  protected readonly quitando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  /** "Eventos del año" primero (sin categoria), luego las del hogar salvo Diezmo. */
  protected readonly opcionesCategoria = computed<Opcion<Id>[]>(() => [
    { valor: '', etiqueta: 'Eventos del año' },
    ...this.categorias().filter((c) => c.tipo !== 'DIEZMO' && c.nombre !== 'Eventos del año').map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ]);
  protected readonly personas = computed<Opcion<Id>[]>(() => this.miembros.miembros().map((m) => ({ valor: m.usuario.id, etiqueta: m.usuario.nombre })));

  protected readonly listo = computed(() => Boolean(this.nombre().trim()) && (this.monto() ?? 0) > 0);

  private readonly datos = computed<DatosEvento>(() => ({
    nombre: this.nombre(), mes: this.mes(), monto: this.monto() ?? 0, tipo: this.tipo(),
    usuarioId: this.tipo() === 'INGRESO' ? this.persona() : null,
    categoriaId: this.tipo() === 'GASTO' ? this.categoria() || null : null,
    enAdelante: this.enAdelante(),
  }));

  private readonly vistaPrevia = resource({
    params: () => (this.listo() ? { anio: this.anio(), id: this.evento()?.id ?? null, datos: this.datos() } : undefined),
    loader: ({ params: p }) => this.puertos.plan.previsualizarEvento(p.anio, p.id, p.datos),
  });
  protected readonly queda = computed(() => (this.vistaPrevia.hasValue() && this.listo() ? this.vistaPrevia.value()[this.mes() - 1] ?? null : null));

  ngOnInit(): void {
    const e = this.evento();
    this.tipo.set(e?.tipo ?? 'GASTO');
    this.nombre.set(e?.nombre ?? '');
    this.mes.set(e?.mes ?? this.mesInicial());
    this.monto.set(e?.monto ?? null);
    this.categoria.set(e?.categoriaId ?? '');
    this.persona.set(e?.usuarioId ?? null);
    this.enAdelante.set(e?.enAdelante ?? false);
  }

  protected guardar(): Promise<void> {
    const e = this.evento();
    return this.ejecutar(() => (e ? this.puertos.plan.editarEvento(this.anio(), e.id, this.datos()) : this.puertos.plan.agregarEvento(this.anio(), this.datos())));
  }

  protected quitar(): Promise<void> {
    return this.ejecutar(() => this.puertos.plan.quitarEvento(this.anio(), this.evento()!.id));
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
