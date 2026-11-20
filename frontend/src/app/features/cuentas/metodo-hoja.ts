import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import {
  MAX_MESES_PRIMERA_CUOTA, compararMes, cuotaFija, cuotasRestantes, emDeEa, formatCop, formatMesAnio, mesDe, saldoPlan, sumarMeses, type Credito,
  type MesRef, type MetodoCredito,
} from '@steward/domain';

import { mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { Hoja } from '../../shared/components/hoja';
import { MontoInput } from '../../shared/components/monto-input';
import { Segmentado, type Opcion } from '../../shared/components/segmentado';

const METODOS: { valor: MetodoCredito; titulo: string; desc: string }[] = [
  { valor: 'TASA', titulo: 'Con la tasa de interés', desc: 'Calculamos interés y capital de cada cuota. Ideal para préstamos.' },
  { valor: 'PLAN', titulo: 'Con el plan de pagos', desc: 'Número de cuotas y tasa efectiva anual: la tabla, cuota a cuota. Ideal para compras a cuotas.' },
  { valor: 'MANUAL', titulo: 'Lo actualizo a mano', desc: 'Escribes el saldo cuando llegue el extracto.' },
];

/** Numero escrito con coma o punto decimal; NaN si no es un numero. */
function numero(texto: string): number {
  const limpio = texto.trim().replace('%', '').replace(',', '.');
  return limpio === '' ? NaN : Number(limpio);
}

/**
 * CreditoMetodo.dc.html: "¿Cómo baja el saldo?" (spec steward-cuentas, "Cómo baja el saldo de un crédito"). Sin `credito`,
 * es "+ Crédito" y pide tambien nombre, entidad y dia de pago; con `credito`, es "Cambiar" en su detalle.
 */
@Component({
  selector: 'app-metodo-hoja',
  imports: [Hoja, MontoInput, Segmentado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-hoja [titulo]="credito() ? '¿Cómo baja el saldo?' : 'Nuevo crédito'" (cerrar)="cerrar.emit()">
      @if (!credito()) {
        <label class="flex flex-col gap-2">
          <span class="rotulo">Nombre</span>
          <input class="campo" placeholder="Ej: Libre inversión" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-2">
            <span class="rotulo">Entidad</span>
            <input class="campo" placeholder="Ej: Bancolombia" [value]="entidad()" (input)="entidad.set($any($event.target).value)" />
          </label>
          <label class="flex flex-col gap-2">
            <span class="rotulo">Día de pago</span>
            <input class="campo" inputmode="numeric" placeholder="15" [value]="diaTexto()" (input)="diaTexto.set($any($event.target).value)" />
          </label>
        </div>
        <span class="rotulo">¿Cómo baja el saldo?</span>
      }

      <div role="radiogroup" aria-label="Método" class="flex flex-col gap-2">
        @for (m of metodos; track m.valor) {
          <button type="button" role="radio" [attr.aria-checked]="metodo() === m.valor" (click)="metodo.set(m.valor)"
            class="flex items-start gap-3 rounded-xl p-3.5 text-left"
            [class]="metodo() === m.valor ? 'border-2 border-acento bg-acento-elegido' : 'border border-borde bg-superficie'">
            <span class="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full" [class]="metodo() === m.valor ? 'border-[5px] border-acento' : 'border-2 border-control'" aria-hidden="true"></span>
            <span class="flex flex-col gap-0.5"><span class="text-[15px] font-semibold">{{ m.titulo }}</span><span class="text-[13px] text-secundario">{{ m.desc }}</span></span>
          </button>
        }
      </div>

      @switch (metodo()) {
        @case ('TASA') {
          <div class="grid grid-cols-2 gap-3">
            <app-monto-input etiqueta="Saldo hoy" [(valor)]="saldo" />
            <app-monto-input etiqueta="Cuota" [(valor)]="cuota" />
            @if (!credito()) {
              <app-monto-input etiqueta="Total original" ayuda="Opcional" [(valor)]="totalOriginal" />
            }
            <label class="flex flex-col gap-2">
              <span class="rotulo">Tasa (%)</span>
              <input class="campo" inputmode="decimal" placeholder="1,6" [value]="tasaTexto()" (input)="tasaTexto.set($any($event.target).value)" />
            </label>
          </div>
          <app-segmentado etiquetaAccesible="Tipo de tasa" [opciones]="unidades" [(valor)]="unidad" />
          <p class="text-xs leading-normal text-secundario" data-testid="resumen-metodo">{{ resumenTasa() }}</p>
        }
        @case ('PLAN') {
          <div class="grid grid-cols-2 gap-3">
            <app-monto-input etiqueta="Valor financiado" [(valor)]="valor" />
            <label class="flex flex-col gap-2">
              <span class="rotulo">Número de cuotas</span>
              <input class="campo" inputmode="numeric" placeholder="12" [value]="numeroTexto()" (input)="numeroTexto.set($any($event.target).value)" />
            </label>
            <label class="flex flex-col gap-2">
              <span class="rotulo">Tasa efectiva anual (%)</span>
              <input class="campo" inputmode="decimal" placeholder="0" [value]="tasaTexto()" (input)="tasaTexto.set($any($event.target).value)" />
            </label>
            <label class="flex flex-col gap-2">
              <span class="rotulo">Cuotas pagadas</span>
              <input class="campo" inputmode="numeric" placeholder="0" [value]="pagadasTexto()" (input)="pagadasTexto.set($any($event.target).value)" />
            </label>
          </div>
          <p class="text-xs leading-normal text-secundario" data-testid="resumen-metodo">{{ resumenPlan() }}</p>
        }
        @case ('MANUAL') {
          <div class="grid grid-cols-2 gap-3">
            <app-monto-input etiqueta="Saldo del último extracto" [(valor)]="saldo" />
            <app-monto-input etiqueta="Cuota" [(valor)]="cuota" />
          </div>
          <p class="text-xs leading-normal text-secundario">Te recordamos actualizarlo el día de pago.</p>
        }
      }

      <label class="flex flex-col gap-2">
        <span class="rotulo">Primera cuota</span>
        <select class="campo" data-testid="primera-cuota" [value]="primeraTexto()" (change)="primeraTexto.set($any($event.target).value)">
          @for (m of mesesPrimera(); track m.valor) {
            <option [value]="m.valor" [selected]="m.valor === primeraTexto()">{{ m.etiqueta }}</option>
          }
        </select>
        @if (credito() && primeraTexto() !== primeraInicial) {
          <span class="text-xs text-secundario" data-testid="nota-primera">Los meses ya planeados no cambian; ajústalos en Planear.</span>
        }
      </label>

      <p class="text-xs text-secundario">Siempre puedes corregir con el saldo del extracto: la app ajusta desde ahí.</p>
      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }
      <button type="button" class="boton-grande" [disabled]="!listo() || ocupado()" (click)="guardar()">{{ credito() ? 'Guardar' : 'Agregar crédito' }}</button>
    </app-hoja>
  `,
})
export class MetodoHoja implements OnInit {
  private readonly puertos = inject(PUERTOS);

  /** null: "+ Crédito". */
  readonly credito = input<Credito | null>(null);
  readonly cerrar = output<void>();

  protected readonly metodos = METODOS;
  protected readonly unidades: Opcion<'EM' | 'EA'>[] = [
    { valor: 'EM', etiqueta: 'Mensual (EM)' },
    { valor: 'EA', etiqueta: 'Anual (EA)' },
  ];

  protected readonly metodo = signal<MetodoCredito>('TASA');
  protected readonly nombre = signal('');
  protected readonly entidad = signal('');
  protected readonly diaTexto = signal('');
  protected readonly saldo = signal<number | null>(null);
  protected readonly cuota = signal<number | null>(null);
  protected readonly totalOriginal = signal<number | null>(null);
  protected readonly tasaTexto = signal('');
  protected readonly unidad = signal<'EM' | 'EA' | null>('EM');
  protected readonly valor = signal<number | null>(null);
  protected readonly numeroTexto = signal('');
  protected readonly pagadasTexto = signal('');
  protected readonly error = signal('');
  protected readonly ocupado = signal(false);
  /** Cuantos meses despues del en curso es la primera cuota (0: este mes; spec "Primera cuota de un crédito"). */
  protected readonly primeraTexto = signal('0');
  protected primeraInicial = '0';

  private readonly mesEnCurso = computed(() => mesDe(this.puertos.hoy()));
  protected readonly mesesPrimera = computed(() => Array.from({ length: MAX_MESES_PRIMERA_CUOTA + 1 }, (_, i) => {
    const m = formatMesAnio(sumarMeses(this.mesEnCurso(), i));
    return { valor: String(i), etiqueta: i === 0 ? `Este mes (${m.toLowerCase()})` : m };
  }));
  private readonly primeraOffset = computed(() => Number(this.primeraTexto()));
  private readonly primeraCuota = computed<MesRef | null>(() => (this.primeraOffset() > 0 ? sumarMeses(this.mesEnCurso(), this.primeraOffset()) : null));

  ngOnInit(): void {
    // "Cambiar": la hoja abre con los datos que tiene el credito.
    {
      const c = this.credito();
      if (!c) return;
      // Una primera cuota ya pasada se muestra como este mes.
      const p = c.primeraCuota ?? null;
      const M = mesDe(this.puertos.hoy());
      const offset = p && compararMes(p, M) > 0 ? (p.anio - M.anio) * 12 + p.mes - M.mes : 0;
      this.primeraInicial = String(Math.min(offset, MAX_MESES_PRIMERA_CUOTA));
      this.primeraTexto.set(this.primeraInicial);
      this.metodo.set(c.metodo);
      this.saldo.set(c.saldo);
      this.cuota.set(c.cuota);
      if (c.metodo === 'PLAN') {
        this.valor.set(c.valorFinanciado);
        this.numeroTexto.set(String(c.numeroCuotas ?? ''));
        this.pagadasTexto.set(String(c.cuotasPagadas));
        this.tasaTexto.set(c.tasaEM ? String(Math.round((Math.pow(1 + c.tasaEM / 100, 12) - 1) * 10_000) / 100).replace('.', ',') : '0');
      } else {
        this.tasaTexto.set(String(c.tasaEM).replace('.', ','));
      }
    }
  }

  /** La tasa efectiva mensual que se guarda: la escrita o la equivalente a la EA. */
  private readonly tasaEM = computed(() => {
    const t = numero(this.tasaTexto() || '0');
    if (!Number.isFinite(t) || t < 0) return NaN;
    return this.metodo() === 'PLAN' || this.unidad() === 'EA' ? emDeEa(t) : Math.round(t * 100) / 100;
  });
  private readonly dia = computed(() => (this.credito() ? this.credito()!.diaPago : Number(this.diaTexto().trim())));
  private readonly numeroCuotas = computed(() => Number(this.numeroTexto().trim()));
  private readonly pagadas = computed(() => Number(this.pagadasTexto().trim() || '0'));

  protected readonly resumenTasa = computed(() => {
    const em = this.tasaEM();
    const saldo = this.saldo();
    const cuota = this.cuota();
    if (!saldo || !cuota || Number.isNaN(em)) return this.unidad() === 'EA' ? 'Escribe la tasa efectiva anual y la convertimos a mensual.' : '¿Te dan tasa efectiva anual? Elige "Anual (EA)" y la convertimos.';
    const n = cuotasRestantes({ saldo, cuota, tasaEM: em });
    const tasa = this.unidad() === 'EA' ? ` Equivale a ${String(em).replace('.', ',')} % EM.` : '';
    if (n === null) return `La cuota no alcanza para los intereses del mes.${tasa}`;
    return `Con esto: ${n} cuotas, termina ≈ ${formatMesAnio(sumarMeses(this.mesEnCurso(), this.primeraOffset() > 0 ? this.primeraOffset() + n - 1 : n))}.${tasa}`;
  });

  protected readonly resumenPlan = computed(() => {
    const valor = this.valor();
    const n = this.numeroCuotas();
    const em = this.tasaEM();
    if (!valor || !Number.isInteger(n) || n < 1 || Number.isNaN(em)) return 'Escribe el valor, el número de cuotas y la tasa (0 si es sin intereses).';
    const cuota = cuotaFija(valor, n, em);
    const saldo = saldoPlan({ valorFinanciado: valor, numeroCuotas: n, tasaEM: em, cuota }, this.pagadas());
    return `Cuota de ${formatCop(cuota)} · debes ${formatCop(saldo)} · cuota ${Math.min(n, this.pagadas() + 1)} de ${n}. Calculado con la tasa; corrígelo con el extracto si no coincide.`;
  });

  protected readonly listo = computed(() => {
    if (!this.credito() && (!this.nombre().trim() || !Number.isInteger(this.dia()) || this.dia() < 1 || this.dia() > 31)) return false;
    if (Number.isNaN(this.tasaEM())) return false;
    if (this.metodo() === 'PLAN') return !!this.valor() && Number.isInteger(this.numeroCuotas()) && this.numeroCuotas() >= 1 && this.pagadas() >= 0 && this.pagadas() < this.numeroCuotas();
    return this.saldo() !== null && !!this.cuota();
  });

  protected async guardar(): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    const plan = this.metodo() === 'PLAN';
    const datos = {
      metodo: this.metodo(), saldo: plan ? 0 : this.saldo()!, cuota: plan ? 0 : this.cuota()!, tasaEM: this.metodo() === 'MANUAL' ? 0 : this.tasaEM(),
      numeroCuotas: plan ? this.numeroCuotas() : null, cuotasPagadas: plan ? this.pagadas() : (this.credito()?.cuotasPagadas ?? 0),
      valorFinanciado: plan ? this.valor() : null, primeraCuota: this.primeraCuota(),
    };
    try {
      const c = this.credito();
      if (c) await this.puertos.cuentas.cambiarMetodo(c.id, datos);
      else {
        await this.puertos.cuentas.agregarCredito({
          ...datos, nombre: this.nombre(), entidad: this.entidad(), diaPago: this.dia(), totalOriginal: plan ? 0 : (this.totalOriginal() ?? this.saldo()!),
        });
      }
      this.cerrar.emit();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
