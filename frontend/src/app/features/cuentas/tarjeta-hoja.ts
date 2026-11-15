import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import type { Id, Tarjeta } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';

/** El item nuevo de la tarjeta, en vez de enlazar uno que ya esta en el plan. */
const LINEA_NUEVA = '__nueva__';

/**
 * "+ Tarjeta" y editar una tarjeta (spec steward-tarjetas, "Tarjetas del hogar"): nombre, corte, pago, uso y como se paga.
 * Al agregarla se puede enlazar un item de Creditos del mes en curso; al editarla, quitarla (con confirmacion).
 */
@Component({
  selector: 'app-tarjeta-hoja',
  imports: [Hoja, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="tarjeta() ? tarjeta()!.nombre : 'Nueva tarjeta'" (cerrar)="cerrar.emit()">
      @if (confirmando()) {
        <p class="text-[15px] text-secundario">Se quita la tarjeta. Sus líneas del plan quedan como gastos de Créditos y los pagos registrados no cambian.</p>
        <button type="button" class="boton-grande bg-negativo" [disabled]="ocupado()" (click)="quitar()">Quitar tarjeta</button>
        <button type="button" class="boton-texto self-center" (click)="confirmando.set(false)">Volver</button>
      } @else {
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-2">
            <span class="rotulo">Nombre</span>
            <input class="campo" placeholder="Ej: Nu" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
          </label>
          <label class="flex flex-col gap-2">
            <span class="rotulo">Uso · Opcional</span>
            <input class="campo" placeholder="Ej: Mercado" [value]="uso()" (input)="uso.set($any($event.target).value)" />
          </label>
          <label class="flex flex-col gap-2">
            <span class="rotulo">Día de corte</span>
            <input class="campo" inputmode="numeric" placeholder="13" [value]="corteTexto()" (input)="corteTexto.set($any($event.target).value)" />
          </label>
          <label class="flex flex-col gap-2">
            <span class="rotulo">Día de pago</span>
            <input class="campo" inputmode="numeric" placeholder="28" [value]="pagoTexto()" (input)="pagoTexto.set($any($event.target).value)" />
          </label>
        </div>
        <app-segmentado etiqueta="Se paga" [opciones]="tipos" [(valor)]="tipo" />
        <app-monto-input [etiqueta]="tipo() === 'FIJO' ? 'Pago fijo' : 'Valor del extracto (estimado)'"
          [ayuda]="tipo() === 'FIJO' ? 'No se paga completa: el saldo que queda genera intereses.' : 'Cada mes se ajusta al último valor pagado.'"
          [(valor)]="monto" />
        @if (!tarjeta() && enlazables().length > 1) {
          <app-segmentado etiqueta="Su línea del plan" [chips]="true" [opciones]="enlazables()" [(valor)]="enlace" />
        }
        @if (error()) {
          <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
        }
        <button type="button" class="boton-grande" [disabled]="!listo() || ocupado()" (click)="guardar()">{{ tarjeta() ? 'Guardar' : 'Agregar tarjeta' }}</button>
        @if (tarjeta()) {
          <button type="button" class="flex min-h-11 items-center justify-center text-sm font-medium text-negativo" (click)="confirmando.set(true)">Quitar tarjeta</button>
        }
      }
    </app-hoja>
  `,
})
export class TarjetaHoja implements OnInit {
  private readonly puertos = inject(PUERTOS);

  /** null: "+ Tarjeta". */
  readonly tarjeta = input<Tarjeta | null>(null);
  readonly cerrar = output<void>();

  protected readonly tipos: Opcion<'COMPLETA' | 'FIJO'>[] = [
    { valor: 'COMPLETA', etiqueta: 'Completa' },
    { valor: 'FIJO', etiqueta: 'Pago fijo' },
  ];

  protected readonly nombre = signal('');
  protected readonly uso = signal('');
  protected readonly corteTexto = signal('');
  protected readonly pagoTexto = signal('');
  protected readonly tipo = signal<'COMPLETA' | 'FIJO' | null>('COMPLETA');
  protected readonly monto = signal<number | null>(null);
  protected readonly enlace = signal<Id | null>(LINEA_NUEVA);
  protected readonly confirmando = signal(false);
  protected readonly error = signal('');
  protected readonly ocupado = signal(false);

  private readonly items = consulta(() => null, (p) => p.tarjetas.enlazables());
  protected readonly enlazables = computed<Opcion<Id>[]>(() => [
    { valor: LINEA_NUEVA, etiqueta: 'Una línea nueva' },
    ...(this.items.value() ?? []).map((i) => ({ valor: i.id, etiqueta: i.nombre })),
  ]);

  ngOnInit(): void {
    const t = this.tarjeta();
    if (!t) return;
    this.nombre.set(t.nombre);
    this.uso.set(t.uso);
    this.corteTexto.set(String(t.diaCorte));
    this.pagoTexto.set(String(t.diaPago));
    this.tipo.set(t.pago.tipo);
    this.monto.set(t.pago.tipo === 'FIJO' ? t.pago.monto : t.pago.estimado);
  }

  private dia(texto: string): number {
    return Number(texto.trim());
  }

  protected readonly listo = computed(() => {
    const valido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
    const monto = this.monto() ?? 0;
    return !!this.nombre().trim() && valido(this.dia(this.corteTexto())) && valido(this.dia(this.pagoTexto())) && (this.tipo() === 'FIJO' ? monto > 0 : true);
  });

  protected async guardar(): Promise<void> {
    const monto = this.monto() ?? 0;
    const datos = {
      nombre: this.nombre(), uso: this.uso(), diaCorte: this.dia(this.corteTexto()), diaPago: this.dia(this.pagoTexto()),
      pago: this.tipo() === 'FIJO' ? { tipo: 'FIJO' as const, monto } : { tipo: 'COMPLETA' as const, estimado: monto },
    };
    const t = this.tarjeta();
    const enlace = this.enlace();
    await this.ejecutar(() => (t ? this.puertos.tarjetas.editar(t.id, datos) : this.puertos.tarjetas.agregar({ ...datos, itemId: enlace === LINEA_NUEVA ? null : enlace })));
  }

  protected async quitar(): Promise<void> {
    await this.ejecutar(() => this.puertos.tarjetas.quitar(this.tarjeta()!.id));
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    try {
      await accion();
      this.cerrar.emit();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
