import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { nombreMesCapital, type Id, type MesDesdeAnual } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';

/** Meses seguidos que se muestran juntos: misma accion, mismo estado de hoy y misma marca. */
interface GrupoMeses {
  meses: number[];
  accion: MesDesdeAnual['accion'];
  ahora: string;
  motivo: string;
}

/**
 * "Meses con la Opción X" (AnualOpcionesWeb y AnualActualizarMovil, design D3 de anual-opciones-y-meses): los 12 meses,
 * agrupados, con lo que tienen hoy y lo que pasara. Los que se pueden actualizar llevan una casilla; los que tienen
 * registros o estan cerrados, su motivo.
 */
@Component({
  selector: 'app-meses-anual-hoja',
  imports: [Hoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="'Meses con la Opción ' + letra()" [antetitulo]="'Plan ' + anio()" (cerrar)="cerrar.emit()">
      <p class="text-sm leading-normal text-[#4A4E48]">Los meses sin plan se crean con su columna. Los que ya tienen plan solo cambian si los marcas.</p>
      <div class="flex flex-col overflow-hidden rounded-[14px] border border-borde" data-testid="meses-anual">
        @for (g of grupos(); track g.meses[0]) {
          <label class="grid min-h-14 grid-cols-[24px_1fr_auto] items-center gap-3 border-t border-[#F0EEE9] px-3.5 py-2 first:border-t-0"
            [class.bg-fondo]="g.accion === 'BLOQUEADO'" [class.text-secundario]="g.accion === 'BLOQUEADO'" [attr.data-meses]="g.meses.join(',')">
            <input type="checkbox" class="size-5 accent-acento" [checked]="marcado(g)" [disabled]="g.accion !== 'ACTUALIZABLE'"
              [attr.aria-label]="'Actualizar ' + nombre(g)" (change)="alternar(g)" />
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="text-[15px] font-semibold">{{ nombre(g) }}</span>
              <span class="text-xs text-secundario">{{ g.ahora }}{{ g.meses.length > 1 ? ' · ' + g.meses.length + ' meses' : '' }}</span>
            </span>
            <span class="text-xs font-semibold whitespace-nowrap" [class]="g.accion === 'BLOQUEADO' ? 'text-secundario' : marcado(g) ? 'text-acento' : 'text-secundario'">{{ accion(g) }}</span>
          </label>
        }
      </div>
      <div class="flex gap-2.5 rounded-[10px] bg-[#FBF1DC] px-3 py-2.5 text-xs leading-[1.45] text-[#6B4A00]">
        <span class="font-bold" aria-hidden="true">!</span>
        <span>Actualizar reemplaza el plan de ese mes, con sus opciones, por la columna de la Opción {{ letra() }}. Los meses con pagos, gastos o un cierre no se tocan.</span>
      </div>
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
      <button type="button" class="boton-grande" [disabled]="guardando() || !(crear() + actualizar().length)" (click)="confirmar()">{{ boton() }}</button>
    </app-hoja>
  `,
})
export class MesesAnualHoja {
  private readonly puertos = inject(PUERTOS);

  readonly anio = input.required<number>();
  readonly opcionId = input.required<Id>();
  readonly letra = input.required<string>();
  readonly cerrar = output<void>();
  /** Cuantos meses se crearon y se actualizaron. */
  readonly guardado = output<{ creados: number; actualizados: number }>();

  private readonly meses = consulta(() => ({ anio: this.anio(), opcion: this.opcionId() }), (p, x) => p.plan.mesesDesdeAnual(x.anio, x.opcion));

  protected readonly grupos = computed<GrupoMeses[]>(() => {
    const grupos: GrupoMeses[] = [];
    for (const m of this.meses.value() ?? []) {
      const ultimo = grupos.at(-1);
      const mismo = ultimo && ultimo.accion === m.accion && ultimo.ahora === m.ahora && ultimo.motivo === m.motivo && this.marcaInicial(m) === this.marcaInicial(this.mes(ultimo.meses[0]!)!);
      if (mismo && ultimo.meses.at(-1) === m.mes - 1) ultimo.meses.push(m.mes);
      else grupos.push({ meses: [m.mes], accion: m.accion, ahora: m.ahora, motivo: m.motivo });
    }
    return grupos;
  });

  /** Los meses marcados para actualizar; al abrir, los que vienen marcados. */
  private readonly marcados = linkedSignal(() => new Set((this.meses.value() ?? []).filter((m) => m.accion === 'ACTUALIZABLE' && m.marcado).map((m) => m.mes)));
  protected readonly actualizar = computed(() => [...this.marcados()].sort((a, b) => a - b));
  protected readonly crear = computed(() => (this.meses.value() ?? []).filter((m) => m.accion === 'CREAR').length);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly boton = computed(() => {
    const crear = this.crear();
    const actualizar = this.actualizar().length;
    const meses = (n: number) => (n === 1 ? 'mes' : 'meses');
    if (crear && actualizar) return `Crear ${crear} y actualizar ${actualizar} ${meses(actualizar)}`;
    if (crear) return `Crear ${crear} ${meses(crear)}`;
    if (actualizar) return `Actualizar ${actualizar} ${meses(actualizar)}`;
    return 'Nada que crear ni actualizar';
  });

  private mes(n: number): MesDesdeAnual | undefined {
    return this.meses.value()?.find((m) => m.mes === n);
  }

  private marcaInicial(m: MesDesdeAnual): boolean {
    return m.accion === 'ACTUALIZABLE' && m.marcado;
  }

  protected marcado(g: GrupoMeses): boolean {
    return g.accion === 'CREAR' || (g.accion === 'ACTUALIZABLE' && g.meses.every((m) => this.marcados().has(m)));
  }

  protected alternar(g: GrupoMeses): void {
    const nuevos = new Set(this.marcados());
    const marcar = !this.marcado(g);
    for (const m of g.meses) {
      if (marcar) nuevos.add(m);
      else nuevos.delete(m);
    }
    this.marcados.set(nuevos);
  }

  protected nombre(g: GrupoMeses): string {
    const desde = nombreMesCapital(g.meses[0]!);
    return g.meses.length === 1 ? desde : `${desde} a ${nombreMesCapital(g.meses.at(-1)!).toLowerCase()}`;
  }

  protected accion(g: GrupoMeses): string {
    if (g.accion === 'BLOQUEADO') return g.motivo;
    if (g.accion === 'CREAR') return g.meses.length > 1 ? 'Se crean' : 'Se crea';
    return this.marcado(g) ? (g.meses.length > 1 ? 'Se actualizan' : 'Se actualiza') : 'No se toca';
  }

  protected async confirmar(): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      const creados = this.crear();
      const actualizar = this.actualizar();
      await this.puertos.plan.crearOActualizarMeses(this.anio(), this.opcionId(), actualizar);
      this.guardado.emit({ creados, actualizados: actualizar.length });
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
