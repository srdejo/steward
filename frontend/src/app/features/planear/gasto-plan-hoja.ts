import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import type { Categoria, Id, IngresoPlan, ItemPlan, TipoItem } from '@steward/domain';

import { mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { Interruptor } from '../../shared/components/interruptor';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';

/** El tipo sale de la categoria (design D6 de plan-mes-siguiente). */
function tipoDe(c: Categoria | undefined, aCuotas: boolean, cambia: boolean): TipoItem {
  switch (c?.tipo) {
    case 'VARIABLE':
      return 'VARIABLE';
    case 'CREDITO':
      return 'CREDITO';
    case 'DIEZMO':
      return 'DIEZMO';
    case 'TARJETA':
      return aCuotas ? 'CUOTA' : 'FIJO';
    case 'OTRO':
      return cambia ? 'VARIABLE' : 'FIJO';
    default:
      return 'FIJO';
  }
}

/**
 * Un gasto de la opcion, con "Guardar" (design D5 de usabilidad-plan). Un diezmo muestra de que ingreso viene y, si se cambio a
 * mano, "Volver a calcular".
 */
@Component({
  selector: 'app-gasto-plan-hoja',
  imports: [Hoja, Interruptor, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="item() ? 'Editar gasto' : 'Nuevo gasto'" [antetitulo]="'Opción ' + letra()" (cerrar)="cerrar.emit()">
      @if (quitando()) {
        <p class="text-[15px] text-secundario">¿Quitar {{ item()!.nombre }} de la Opción {{ letra() }}?</p>
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande bg-negativo" [disabled]="guardando()" (click)="quitar()">Sí, quitar</button>
      } @else {
        @if (origen(); as texto) {
          <p class="rounded-xl bg-nota px-4 py-3 text-[13px] text-[#3B3D39]" data-testid="origen-diezmo">{{ texto }}</p>
        }
        <label class="flex flex-col gap-2">
          <span class="rotulo">Nombre</span>
          <input class="campo" placeholder="Ej: Regalo" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
        </label>
        <app-monto-input etiqueta="Monto" [(valor)]="monto" />
        @if (item()?.ajustadoAMano) {
          <div class="flex items-center justify-between gap-3 rounded-xl bg-aviso-suave px-4 py-3">
            <span class="text-[13px] text-aviso">Ajustado a mano: no sigue a su ingreso.</span>
            <button type="button" class="boton-texto font-semibold" [disabled]="guardando()" (click)="recalcular()">Volver a calcular</button>
          </div>
        }
        <app-segmentado etiqueta="Categoría" [chips]="true" [opciones]="opcionesCategoria()" [valor]="categoria()" (valorChange)="$event && elegirCategoria($event)" />
        @if (tipoCategoria() === 'TARJETA') {
          <app-interruptor titulo="¿A cuotas?" detalle="Una compra con cuota actual y total" [activo]="tipo() === 'CUOTA'" (activoChange)="aCuotas.set($event); tocado.set(true)" />
        }
        @if (tipoCategoria() === 'OTRO') {
          <app-interruptor titulo="Cambia cada mes" detalle="Se lleva lo gastado contra el presupuesto" [activo]="tipo() === 'VARIABLE'" (activoChange)="cambia.set($event); tocado.set(true)" />
        }
        <label class="flex flex-col gap-2">
          <span class="rotulo">Día de vencimiento · Opcional</span>
          <input class="campo" inputmode="numeric" placeholder="Ej: 15" [value]="dia()" (input)="dia.set($any($event.target).value)" />
        </label>
        @if (tipo() === 'CUOTA') {
          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-2">
              <span class="rotulo">Cuota actual</span>
              <input class="campo" inputmode="numeric" [value]="cuotaActual()" (input)="cuotaActual.set($any($event.target).value)" />
            </label>
            <label class="flex flex-col gap-2">
              <span class="rotulo">De cuántas</span>
              <input class="campo" inputmode="numeric" [value]="cuotaTotal()" (input)="cuotaTotal.set($any($event.target).value)" />
            </label>
          </div>
        }
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="!listo() || guardando()" (click)="guardar()">Guardar</button>
        @if (item()) {
          <button type="button" class="boton-texto self-center font-normal text-negativo" (click)="quitando.set(true)">Quitar</button>
        }
      }
    </app-hoja>
  `,
})
export class GastoPlanHoja implements OnInit {
  private readonly puertos = inject(PUERTOS);

  readonly planId = input.required<Id>();
  readonly escenarioId = input.required<Id>();
  readonly letra = input.required<string>();
  readonly categorias = input.required<Categoria[]>();
  /** Las lineas de la opcion, para decir de cual viene un diezmo. */
  readonly lineas = input<IngresoPlan[]>([]);
  /** null: "+ Gasto". */
  readonly item = input<ItemPlan | null>(null);
  readonly cerrar = output<void>();
  readonly guardado = output<void>();

  protected readonly nombre = signal('');
  protected readonly monto = signal<number | null>(null);
  protected readonly categoria = signal<Id | null>(null);
  protected readonly aCuotas = signal(false);
  protected readonly cambia = signal(false);
  /** Abrir y guardar no cambia el tipo de un item: solo tocar la categoria o sus preguntas. */
  protected readonly tocado = signal(false);
  protected readonly opcionesCategoria = computed<Opcion<Id>[]>(() => this.categorias().map((c) => ({ valor: c.id, etiqueta: c.nombre })));
  private readonly categoriaElegida = computed(() => this.categorias().find((c) => c.id === this.categoria()));
  protected readonly tipoCategoria = computed(() => this.categoriaElegida()?.tipo);
  protected readonly tipo = computed<TipoItem>(() => {
    const i = this.item();
    return i && !this.tocado() ? i.tipo : tipoDe(this.categoriaElegida(), this.aCuotas(), this.cambia());
  });
  protected readonly dia = signal('');
  protected readonly cuotaActual = signal('');
  protected readonly cuotaTotal = signal('');
  protected readonly quitando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly origen = computed(() => {
    const i = this.item();
    if (i?.tipo !== 'DIEZMO') return null;
    const linea = this.lineas().find((l) => l.id === i.ingresoPlanId);
    if (linea) return `Viene de ${linea.nombre}`;
    return i.aporteId ? 'Viene de un aporte' : null;
  });

  private entero(texto: string): number | null {
    const t = texto.trim();
    return /^\d+$/.test(t) ? Number(t) : null;
  }

  protected readonly listo = computed(() => {
    const dia = this.dia().trim();
    const diaBien = !dia || ((this.entero(dia) ?? 0) >= 1 && (this.entero(dia) ?? 32) <= 31);
    const cuotaBien = this.tipo() !== 'CUOTA' || (this.entero(this.cuotaActual()) !== null && this.entero(this.cuotaTotal()) !== null);
    return Boolean(this.nombre().trim()) && this.monto() !== null && Boolean(this.categoria()) && diaBien && cuotaBien;
  });

  ngOnInit(): void {
    const i = this.item();
    this.nombre.set(i?.nombre ?? '');
    this.monto.set(i?.monto ?? null);
    this.categoria.set(i?.categoriaId ?? this.categorias()[0]?.id ?? null);
    this.aCuotas.set(i?.tipo === 'CUOTA');
    this.cambia.set(i?.tipo === 'VARIABLE');
    this.dia.set(i?.diaVence ? String(i.diaVence) : '');
    this.cuotaActual.set(i?.cuota ? String(i.cuota.actual) : '');
    this.cuotaTotal.set(i?.cuota ? String(i.cuota.total) : '');
  }

  protected elegirCategoria(id: Id): void {
    if (id !== this.categoria()) this.tocado.set(true);
    this.categoria.set(id);
  }

  protected guardar(): Promise<void> {
    const i = this.item();
    const tipo = this.tipo();
    const cuota = tipo === 'CUOTA' ? { actual: this.entero(this.cuotaActual())!, total: this.entero(this.cuotaTotal())! } : i?.tipo === tipo ? i.cuota : null;
    const datos: Omit<ItemPlan, 'id'> & { id?: Id } = {
      id: i?.id, categoriaId: this.categoria()!, nombre: this.nombre(), monto: this.monto()!, diaVence: this.entero(this.dia()), tipo, cuota,
      creditoId: i?.creditoId ?? null, ingresoFijoId: i?.ingresoFijoId ?? null, aporteId: i?.aporteId ?? null, ingresoPlanId: i?.ingresoPlanId ?? null, ajustadoAMano: i?.ajustadoAMano ?? false,
    };
    return this.ejecutar(() => this.puertos.plan.guardarItem(this.planId(), this.escenarioId(), datos));
  }

  protected recalcular(): Promise<void> {
    return this.ejecutar(() => this.puertos.plan.recalcularDiezmo(this.planId(), this.escenarioId(), this.item()!.id));
  }

  protected quitar(): Promise<void> {
    return this.ejecutar(() => this.puertos.plan.quitarItem(this.planId(), this.escenarioId(), this.item()!.id));
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
