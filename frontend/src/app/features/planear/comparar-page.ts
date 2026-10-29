import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatMesAnio, formatNumero, mesDe, nombreMes, parseClaveMes, type FilaComparacion, type Pesos } from '@steward/domain';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS, puertosConectados } from '../../core/datos/puertos';

/**
 * Comparar.dc.html (web): las opciones lado a lado, resaltando solo las filas que cambian, con "Queda libre"
 * y "Usar X". Por debajo de 1024 px la tabla se desplaza en horizontal sin comprimir columnas.
 */
@Component({
  selector: 'app-comparar-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6 px-5 pt-6 pb-4 lg:px-10 lg:pt-8' },
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <a [routerLink]="['/planear', mes()]" class="boton-texto -my-2 self-start text-sm font-normal">‹ {{ titulo() }}</a>
        <span class="rotulo">{{ titulo() }} · Borrador</span>
        <h1 class="text-[28px] font-bold">Comparar opciones</h1>
      </div>
      <label class="flex min-h-11 items-center gap-2 text-sm text-[#3B3D39]">
        <input type="checkbox" class="h-[18px] w-[18px] accent-acento" [checked]="soloCambios()" (change)="soloCambios.set($any($event.target).checked)" />
        Mostrar solo lo que cambia
      </label>
    </div>

    @if (conectado) {
      <!-- Modo conectado: solo existe la Opción A hasta la Etapa 7 (spec steward-planear). -->
      <p role="status" class="rounded-xl bg-nota px-4 py-3 text-[13px] text-[#3B3D39]">Comparar varias opciones llega en una próxima versión. Por ahora cada mes tiene solo la Opción A.</p>
    }

    @if (comparacion.value(); as c) {
      <div class="overflow-x-auto rounded-[14px] border border-borde bg-superficie" data-testid="tabla-comparar" tabindex="0" role="region" aria-label="Opciones lado a lado">
        <table class="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-borde">
              <th scope="col" class="px-6 py-4 text-left"><span class="sr-only">Concepto</span></th>
              @for (v of c.vistas; track v.escenario.id) {
                <th scope="col" class="px-4 py-4 text-right">
                  <span class="block text-[15px] font-semibold">Opción {{ v.escenario.letra }}</span>
                  <span class="block text-xs font-normal text-secundario">{{ descripcion(v.autor, v.escenario.nota, v.escenario.letra) }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (f of filas(); track f.clave) {
              <tr class="border-b border-divisor" [class.bg-[#FBF7EC]]="f.cambia" [attr.data-cambia]="f.cambia">
                <th scope="row" class="px-6 py-3.5 text-left font-normal">
                  <span class="block">{{ f.nombre }}</span>
                  @if (f.nota) {
                    <span class="block text-xs text-secundario">{{ f.nota }}</span>
                  }
                </th>
                @for (valor of f.valores; track $index) {
                  <td class="monto px-4 py-3.5 text-right" [class.text-secundario]="!f.cambia || valor === null" [class.font-semibold]="f.cambia && esDistinto(f, valor)">
                    {{ valor === null ? '—' : numero(valor) }}
                  </td>
                }
              </tr>
            }
            <tr>
              <th scope="row" class="px-6 pt-[18px] pb-2 text-left text-base font-semibold">Queda libre</th>
              @for (libre of c.libre; track $index) {
                <td class="monto px-4 pt-[18px] pb-2 text-right text-lg font-semibold" [class.text-acento]="libre >= 0" [class.text-negativo]="libre < 0">{{ numero(libre) }}</td>
              }
            </tr>
            <tr>
              <td></td>
              @for (v of c.vistas; track v.escenario.id) {
                <td class="px-4 pb-5 text-right">
                  <button type="button" class="boton h-10 rounded-control border border-control bg-superficie text-sm" (click)="usar(v.escenario.id)">Usar {{ v.escenario.letra }}</button>
                </td>
              }
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-[13px] text-secundario">Al elegir una opción, {{ nombreMesMin() }} pasa a Activo el 1 de {{ nombreMesMin() }}. Las demás quedan archivadas, no se borran.</p>
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
    }
  `,
})
export class CompararPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);
  protected readonly conectado = puertosConectados(this.puertos) !== null;

  /** Parametro de la ruta (`/planear/:mes/comparar`). */
  readonly mes = input.required<string>();
  private readonly ref = computed(() => parseClaveMes(this.mes()) ?? mesDe(this.puertos.hoy()));
  protected readonly titulo = computed(() => formatMesAnio(this.ref()));
  protected readonly nombreMesMin = computed(() => nombreMes(this.ref().mes));
  protected readonly comparacion = consulta(() => this.ref(), (p, ref) => p.plan.comparar(ref));
  private readonly vistaMes = consulta(() => this.ref(), (p, ref) => p.plan.mes(ref));
  protected readonly soloCambios = signal(true);
  protected readonly error = signal('');

  /** Con "Mostrar solo lo que cambia": lo igual se agrupa en "Sin cambios"; sin el, cada categoria por separado. */
  protected readonly filas = computed<FilaComparacion[]>(() => {
    const c = this.comparacion.value();
    if (!c) return [];
    if (this.soloCambios()) return [c.ingresos, ...c.filas, ...(c.sinCambios ? [c.sinCambios] : [])];
    const nombres = new Map<string, FilaComparacion>();
    for (const [i, v] of c.vistas.entries()) {
      for (const g of v.grupos) {
        const fila = nombres.get(g.categoriaId) ?? { clave: g.categoriaId, nombre: g.nombre, nota: '', valores: c.vistas.map(() => null as Pesos | null), cambia: false };
        fila.valores[i] = g.total;
        nombres.set(g.categoriaId, fila);
      }
    }
    const destacadas = new Map(c.filas.map((f) => [f.clave, f]));
    const todas = [...nombres.values()].map((f) => destacadas.get(f.clave) ?? f);
    const diezmo: FilaComparacion = { clave: 'diezmo', nombre: 'Diezmo', nota: 'Calculado', valores: c.vistas.map((v) => v.diezmo.monto), cambia: false };
    return [c.ingresos, ...todas, diezmo];
  });

  protected numero(v: Pesos): string {
    return formatNumero(v);
  }

  protected descripcion(autor: string, nota: string, letra: string): string {
    if (letra === 'A' && nota) return nota;
    return [autor, nota].filter(Boolean).join(' · ');
  }

  /** En una fila que cambia, en negrilla los valores distintos al de la Opcion A. */
  protected esDistinto(f: FilaComparacion, valor: Pesos | null): boolean {
    return valor !== null && valor !== f.valores[0];
  }

  protected async usar(escenarioId: string): Promise<void> {
    const plan = this.vistaMes.value()?.plan;
    if (!plan) return;
    this.error.set('');
    try {
      await this.puertos.plan.usar(plan.id, escenarioId);
      await this.router.navigateByUrl('/planear');
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }
}
