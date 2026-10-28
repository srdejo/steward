import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { previsualizarDiezmo, type BaseDiezmo, type Id, type Invitacion, type Pesos } from '@steward/domain';

import { mensajeDeError } from '../../core/datos/consulta';
import type { InvitacionConectada } from '../../core/datos/http/puertos-conectados';
import { PUERTOS, puertosConectados } from '../../core/datos/puertos';
import { SesionActual } from '../../core/sesion/sesion';
import { Avatar } from '../../shared/components/avatar';
import { Icono } from '../../shared/components/icono';
import { Monto } from '../../shared/components/monto';
import { MontoInput } from '../../shared/components/monto-input';

interface IngresoBorrador {
  id?: Id;
  nombre: string;
  bruto: Pesos | null;
  neto: Pesos | null;
  dia: number | null;
}

interface CuentaBorrador {
  nombre: string;
  saldo: Pesos | null;
  color: string;
  sugerida: boolean;
}

const COLORES_CUENTA = ['#D93025', '#7C4DDB', '#8D8F88', '#2E6B45', '#E2551B', '#0F766E'];

/**
 * Onb1–Onb5.dc.html: nombre y hogar, diezmo (opcional), ingreso fijo, cuentas (opcional) e invitar (opcional).
 * Cada "Continuar" guarda su paso en el adaptador; al terminar el hogar queda configurado y se abre Hoy.
 */
@Component({
  selector: 'app-onboarding-page',
  imports: [Avatar, Icono, Monto, MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-6 px-6 pt-8 pb-9' },
  template: `
    <div class="grid grid-cols-5 gap-1.5" role="progressbar" aria-label="Avance del onboarding" [attr.aria-valuenow]="numero()" aria-valuemin="1" aria-valuemax="5">
      @for (i of [1, 2, 3, 4, 5]; track i) {
        <span class="h-1 rounded-sm" [class.bg-acento]="i <= numero()" [class.bg-borde-campo]="i > numero()"></span>
      }
    </div>

    @switch (numero()) {
      @case (1) {
        <div class="flex flex-col gap-2.5">
          <span class="text-xs font-semibold tracking-[0.1em] text-acento">BIENVENIDO</span>
          <h1 class="text-[28px] leading-tight font-bold">¿Cómo te llamas?</h1>
          <p class="text-[15px] leading-normal text-secundario">Lo tomamos de tu cuenta de Google. Cámbialo si quieres.</p>
        </div>
        <label class="flex flex-col gap-2">
          <span class="rotulo">Tu nombre</span>
          <input class="campo-grande" autocomplete="given-name" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="rotulo">Nombre del hogar</span>
          <input class="campo-grande" placeholder="Ej: Nuestra casa" [value]="hogar()" (input)="hogar.set($any($event.target).value)" aria-describedby="ayuda-hogar" />
          <span id="ayuda-hogar" class="text-xs text-secundario">Es el presupuesto que vas a compartir. Puedes cambiarlo después.</span>
        </label>
      }

      @case (2) {
        <div class="flex flex-col gap-2.5">
          <span class="text-xs font-semibold tracking-[0.1em] text-acento">APORTE · OPCIONAL</span>
          <h1 class="text-[28px] leading-tight font-bold">¿Diezmas de tus ingresos?</h1>
          <p class="text-[15px] leading-normal text-secundario">Si lo activas, lo calculamos solo cuando entre cada ingreso. Nunca tendrás que escribirlo a mano.</p>
        </div>
        <div class="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="¿Diezmas de tus ingresos?">
          @for (o of opcionesDiezmo; track o.valor) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="diezmo() === o.valor"
              (click)="diezmo.set(o.valor)"
              class="flex min-h-[76px] flex-col gap-1 rounded-[14px] p-3.5 text-left"
              [class]="diezmo() === o.valor ? 'border-2 border-acento bg-acento-suave' : 'border border-borde-campo bg-superficie'"
            >
              <span class="text-base font-semibold">{{ o.titulo }}</span>
              <span class="text-xs text-secundario">{{ o.detalle }}</span>
            </button>
          }
        </div>
        @if (diezmo()) {
          <div class="flex flex-col gap-4 rounded-[14px] border border-borde bg-superficie p-4">
            <label class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium">Porcentaje</span>
              <input
                class="monto h-11 w-20 rounded-control border border-borde-campo bg-fondo text-center text-base focus:border-acento focus:outline-none"
                inputmode="numeric"
                [value]="porcentaje() + '%'"
                (input)="cambiarPorcentaje($any($event.target))"
              />
            </label>
            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium" id="calcular-sobre">Calcular sobre</span>
              <div class="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F1F0EB] p-1" role="radiogroup" aria-labelledby="calcular-sobre">
                @for (b of bases; track b.valor) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="base() === b.valor"
                    (click)="base.set(b.valor)"
                    class="h-10 rounded-[9px] text-sm"
                    [class]="base() === b.valor ? 'bg-superficie font-semibold text-texto' : 'font-medium text-secundario'"
                  >
                    {{ b.etiqueta }}
                  </button>
                }
              </div>
            </div>
          </div>
        }
        <p class="text-[13px] leading-[1.45] text-secundario">Aplica solo a tus ingresos. Cada persona del hogar decide el suyo.</p>
      }

      @case (3) {
        <div class="flex flex-col gap-2.5">
          <span class="text-xs font-semibold tracking-[0.1em] text-acento">INGRESO FIJO</span>
          <h1 class="text-[28px] leading-tight font-bold">Lo que entra cada mes</h1>
          <p class="text-[15px] leading-normal text-secundario">Defínelo una vez y se repite en todos los meses del año.</p>
        </div>
        @for (ing of ingresos(); track $index; let i = $index) {
          <fieldset class="flex flex-col gap-3.5 rounded-[14px] border border-borde bg-superficie p-4">
            <legend class="sr-only">Ingreso fijo {{ i + 1 }}</legend>
            <label class="flex flex-col gap-1.5">
              <span class="text-[11px] font-semibold tracking-[0.08em] text-secundario">NOMBRE</span>
              <input class="h-[46px] rounded-control border border-borde-campo bg-fondo px-3 text-[15px] font-medium focus:border-acento focus:outline-none" [value]="ing.nombre" (input)="editarIngreso(i, { nombre: $any($event.target).value })" />
            </label>
            <div class="grid grid-cols-2 gap-2.5">
              <app-monto-input etiqueta="BRUTO" [valor]="ing.bruto" (valorChange)="editarIngreso(i, { bruto: $event })" />
              <app-monto-input etiqueta="ENTRA (NETO)" [valor]="ing.neto" (valorChange)="editarIngreso(i, { neto: $event })" />
            </div>
            <label class="flex flex-col gap-1.5">
              <span class="text-[11px] font-semibold tracking-[0.08em] text-secundario">DÍA DE PAGO</span>
              <input class="h-[46px] rounded-control border border-borde-campo bg-fondo px-3 text-[15px] font-medium focus:border-acento focus:outline-none" inputmode="numeric" placeholder="Día 25"
                [value]="ing.dia ? 'Día ' + ing.dia : ''" (input)="cambiarDia(i, $any($event.target))" />
            </label>
            @if (vistaPreviaDiezmo(ing); as d) {
              <div class="flex items-center justify-between border-t border-divisor pt-3 text-[13px] text-diezmo" data-testid="vista-previa-diezmo">
                <span>Diezmo al recibir · {{ porcentaje() }}% del {{ base() === 'BRUTO' ? 'bruto' : 'neto' }}</span>
                <app-monto class="font-semibold" [valor]="d" [siempreVisible]="true" />
              </div>
            }
          </fieldset>
        }
        <button type="button" class="boton-punteado" (click)="agregarIngreso()">+ Otro ingreso fijo</button>
        <p class="text-[13px] leading-[1.45] text-secundario">¿Contratos, negocio o ingresos que varían? No los pongas aquí: los registras con + Aporte cuando lleguen.</p>
      }

      @case (4) {
        <div class="flex flex-col gap-2.5">
          <span class="text-xs font-semibold tracking-[0.1em] text-acento">CUENTAS · OPCIONAL</span>
          <h1 class="text-[28px] leading-tight font-bold">¿Dónde tienes el dinero?</h1>
          <p class="text-[15px] leading-normal text-secundario">Un saldo aproximado basta. Lo cuadras cuando quieras.</p>
        </div>
        <div class="flex flex-col gap-2.5">
          @for (c of cuentas(); track $index; let i = $index) {
            <div class="flex items-center gap-3 rounded-[14px] border border-borde bg-superficie px-3.5 py-3">
              <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" [style.background]="c.color" aria-hidden="true"></span>
              @if (c.sugerida) {
                <span class="grow text-[15px] font-medium">{{ c.nombre }}</span>
              } @else {
                <input class="h-10 min-w-0 grow rounded-control border border-borde-campo bg-fondo px-2.5 text-[15px] focus:border-acento focus:outline-none" placeholder="Nombre" aria-label="Nombre de la cuenta"
                  [value]="c.nombre" (input)="editarCuenta(i, { nombre: $any($event.target).value })" />
              }
              <input class="monto h-10 w-[120px] rounded-control border border-borde-campo bg-fondo px-2.5 text-right text-[13px] focus:border-acento focus:outline-none"
                inputmode="numeric" placeholder="≈ 0" [attr.aria-label]="'Saldo ' + (c.nombre || 'de la cuenta')"
                [value]="c.saldo === null ? '' : '≈ ' + miles(c.saldo)" (input)="cambiarSaldo(i, $any($event.target))" />
            </div>
          }
          <button type="button" class="boton-punteado" (click)="agregarCuenta()">+ Otra cuenta</button>
        </div>
        <p class="text-[13px] leading-[1.45] text-secundario">Quien se una al hogar agrega sus propias cuentas. Ninguna es obligatoria para marcar pagos.</p>
      }

      @case (5) {
        <div class="flex flex-col gap-2.5">
          <span class="text-xs font-semibold tracking-[0.1em] text-acento">HOGAR</span>
          <h1 class="text-[28px] leading-tight font-bold">¿Con quién compartes el presupuesto?</h1>
          <p class="text-[15px] leading-normal text-secundario">Le llega un correo y entra con su propia cuenta. Nadie comparte contraseñas.</p>
        </div>
        <form class="flex flex-col gap-2" (submit)="$event.preventDefault(); invitar()">
          <label for="correo-invitacion" class="rotulo">Correo</label>
          <div class="flex gap-2">
            <input id="correo-invitacion" type="email" autocomplete="email" placeholder="correo@ejemplo.com"
              class="h-[52px] min-w-0 grow rounded-[14px] border border-borde-campo bg-superficie px-3.5 text-[15px] font-medium focus:border-acento focus:outline-none"
              [value]="correo()" (input)="correo.set($any($event.target).value)" />
            <button type="submit" class="boton h-[52px] rounded-[14px] bg-acento text-white">Invitar</button>
          </div>
        </form>
        @for (inv of invitaciones(); track inv.id) {
          <div class="flex items-center gap-3 rounded-[14px] border border-borde bg-superficie px-3.5 py-3" data-testid="invitacion">
            <app-avatar [inicial]="inv.email.charAt(0).toUpperCase()" variante="suave" [tamano]="36" />
            <div class="flex min-w-0 grow flex-col gap-0.5">
              <span class="truncate text-sm font-medium">{{ inv.email }}</span>
              <span class="text-xs text-aviso">Invitación enviada · pendiente</span>
            </div>
            <button type="button" class="boton-texto font-medium" (click)="reenviar(inv)">{{ reenviada() === inv.id ? 'Reenviada' : 'Reenviar' }}</button>
          </div>
        }
        <div class="nota">
          <span class="text-[13px] font-semibold">Los dos podrán</span>
          <span class="text-[13px] leading-normal text-[#3B3D39]">Ver el mes y el año · marcar pagos · registrar aportes · crear y elegir opciones de presupuesto</span>
        </div>
        @if (correoNoEnviado()) {
          <p role="status" class="nota text-[13px] leading-normal" data-testid="correo-no-enviado">No pudimos enviar el correo. Copia el enlace de invitación y compártelo tú.</p>
        }
        @if (invitaciones().length) {
          <button type="button" class="boton-enlace gap-2" (click)="copiarEnlace()">
            <app-icono nombre="enlace" [tamano]="16" />{{ copiado() ? 'Enlace copiado' : 'O copiar enlace de invitación' }}
          </button>
          @if (conectado) {
            <p class="text-center text-xs text-secundario">Al reenviar o copiar se crea un enlace nuevo: el anterior deja de servir.</p>
          }
        }
      }
    }

    @if (error()) {
      <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
    }

    <div class="mt-auto flex flex-col gap-1">
      @if (numero() === 5) {
        <button type="button" class="boton-grande" [disabled]="guardando()" (click)="terminar()">Empezar</button>
        <button type="button" class="boton-enlace" [disabled]="guardando()" (click)="terminar()">Invitar después</button>
      } @else {
        <div class="flex gap-2.5">
          @if (numero() > 1) {
            <button type="button" class="boton-atras" (click)="ir(numero() - 1)">Atrás</button>
          }
          <button type="button" class="boton-grande" [disabled]="guardando()" (click)="continuar()">Continuar</button>
        </div>
        @if (numero() === 4) {
          <button type="button" class="boton-enlace" (click)="ir(5)">Saltar por ahora</button>
        }
      }
    </div>
  `,
})
export class OnboardingPage implements OnInit {
  private readonly puertos = inject(PUERTOS);
  private readonly sesion = inject(SesionActual);
  private readonly router = inject(Router);

  /** Parametro de la ruta (`/onboarding/:paso`). */
  readonly paso = input('1');
  protected readonly numero = computed(() => Math.min(5, Math.max(1, Number(this.paso()) || 1)));

  protected readonly nombre = signal('');
  protected readonly hogar = signal('');
  protected readonly diezmo = signal(true);
  protected readonly porcentaje = signal(10);
  protected readonly base = signal<BaseDiezmo>('BRUTO');
  protected readonly ingresos = signal<IngresoBorrador[]>([{ nombre: 'Salario', bruto: null, neto: null, dia: null }]);
  protected readonly cuentas = signal<CuentaBorrador[]>(
    ['Davivienda', 'Nu', 'Efectivo'].map((nombre, i) => ({ nombre, saldo: null, color: COLORES_CUENTA[i]!, sugerida: true })),
  );
  protected readonly correo = signal('');
  protected readonly invitaciones = signal<Invitacion[]>([]);
  protected readonly reenviada = signal<Id | null>(null);
  protected readonly copiado = signal(false);
  protected readonly correoNoEnviado = signal(false);
  protected readonly conectado = puertosConectados(this.puertos) !== null;
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly opcionesDiezmo = [
    { valor: true, titulo: 'Sí, diezmo', detalle: 'Al recibir cada ingreso' },
    { valor: false, titulo: 'No por ahora', detalle: 'Lo puedes activar luego' },
  ];
  protected readonly bases: { valor: BaseDiezmo; etiqueta: string }[] = [
    { valor: 'BRUTO', etiqueta: 'Bruto' },
    { valor: 'NETO', etiqueta: 'Neto' },
  ];

  async ngOnInit(): Promise<void> {
    const [s, hogar, regla, fijos] = await Promise.all([
      this.sesion.cargar(),
      this.puertos.hogar.obtener(),
      this.puertos.ingresos.regla(),
      this.puertos.ingresos.fijos(),
    ]);
    this.nombre.set(s?.usuario.nombre ?? '');
    this.hogar.set(hogar.hogar.nombre);
    this.invitaciones.set(hogar.invitaciones.filter((i) => i.estado === 'PENDIENTE'));
    if (regla) {
      this.diezmo.set(regla.activa);
      this.porcentaje.set(regla.porcentaje);
      this.base.set(regla.base);
    }
    if (fijos.length) this.ingresos.set(fijos.map((f) => ({ id: f.id, nombre: f.nombre, bruto: f.bruto, neto: f.neto, dia: f.diaPago })));
  }

  protected vistaPreviaDiezmo(ing: IngresoBorrador): Pesos | null {
    if (!ing.bruto && !ing.neto) return null;
    return previsualizarDiezmo({ activa: this.diezmo(), porcentaje: this.porcentaje(), base: this.base() }, ing.bruto ?? ing.neto ?? 0, ing.neto ?? ing.bruto ?? 0);
  }

  protected cambiarPorcentaje(campo: HTMLInputElement): void {
    const n = Math.min(100, Number(campo.value.replace(/\D/g, '')) || 0);
    this.porcentaje.set(n);
    campo.value = `${n}%`;
  }

  protected editarIngreso(i: number, cambios: Partial<IngresoBorrador>): void {
    this.ingresos.update((lista) => lista.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
  }

  protected cambiarDia(i: number, campo: HTMLInputElement): void {
    const dia = Math.min(31, Number(campo.value.replace(/\D/g, '')) || 0) || null;
    this.editarIngreso(i, { dia });
    campo.value = dia ? `Día ${dia}` : '';
  }

  protected agregarIngreso(): void {
    this.ingresos.update((l) => [...l, { nombre: '', bruto: null, neto: null, dia: null }]);
  }

  protected editarCuenta(i: number, cambios: Partial<CuentaBorrador>): void {
    this.cuentas.update((lista) => lista.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
  }

  protected cambiarSaldo(i: number, campo: HTMLInputElement): void {
    const digitos = campo.value.replace(/\D/g, '');
    const saldo = digitos ? Number(digitos) : null;
    this.editarCuenta(i, { saldo });
    campo.value = saldo === null ? '' : `≈ ${this.miles(saldo)}`;
  }

  protected miles(v: number): string {
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  protected agregarCuenta(): void {
    this.cuentas.update((l) => [...l, { nombre: '', saldo: null, color: COLORES_CUENTA[l.length % COLORES_CUENTA.length]!, sugerida: false }]);
  }

  protected async ir(paso: number): Promise<void> {
    this.error.set('');
    await this.router.navigate(['/onboarding', paso]);
  }

  protected async continuar(): Promise<void> {
    await this.guardar(async () => {
      switch (this.numero()) {
        case 1:
          await this.puertos.hogar.actualizarPerfil(this.nombre());
          await this.puertos.hogar.nombrar(this.hogar());
          break;
        case 2:
          await this.puertos.ingresos.guardarRegla({ activa: this.diezmo(), porcentaje: this.porcentaje() || 10, base: this.base(), aplicaAportes: this.diezmo() });
          break;
        case 3:
          await this.guardarIngresos();
          break;
        case 4:
          await this.guardarCuentas();
          break;
      }
      await this.ir(this.numero() + 1);
    });
  }

  private async guardarIngresos(): Promise<void> {
    const validos = this.ingresos().filter((i) => i.nombre.trim() || i.neto || i.bruto);
    if (!validos.length) throw new Error('Agrega al menos un ingreso fijo');
    for (const ing of validos) {
      const neto = ing.neto ?? ing.bruto ?? 0;
      await this.puertos.ingresos.guardarFijo({ id: ing.id, nombre: ing.nombre, bruto: ing.bruto ?? neto, neto, diaPago: ing.dia ?? 1, cuentaId: null });
    }
    const guardados = await this.puertos.ingresos.fijos();
    this.ingresos.set(guardados.map((f) => ({ id: f.id, nombre: f.nombre, bruto: f.bruto, neto: f.neto, dia: f.diaPago })));
  }

  private async guardarCuentas(): Promise<void> {
    const usuario = this.sesion.usuario();
    const existentes = new Set((await this.puertos.cuentas.cuentas()).cuentas.map((c) => c.cuenta.nombre.toLowerCase()));
    for (const c of this.cuentas()) {
      if (c.saldo === null || !c.nombre.trim() || existentes.has(c.nombre.trim().toLowerCase())) continue;
      await this.puertos.cuentas.agregar({ nombre: c.nombre, titularId: c.nombre === 'Efectivo' ? null : (usuario?.id ?? null), saldo: c.saldo });
    }
  }

  protected async invitar(): Promise<void> {
    await this.guardar(async () => {
      const inv = await this.puertos.hogar.invitar(this.correo());
      // Modo conectado: si contact no envio el correo, la invitacion igual quedo (spec "Correo no enviado").
      this.correoNoEnviado.set((inv as Partial<InvitacionConectada>).correoEnviado === false);
      this.invitaciones.update((l) => [...l.filter((i) => i.id !== inv.id), inv]);
      this.correo.set('');
    });
  }

  protected async reenviar(inv: Invitacion): Promise<void> {
    await this.puertos.hogar.reenviar(inv.id);
    this.reenviada.set(inv.id);
  }

  protected async copiarEnlace(): Promise<void> {
    const ultima = this.invitaciones().at(-1);
    if (!ultima) return;
    const ruta = await this.puertos.hogar.enlaceInvitacion(ultima.id);
    try {
      await navigator.clipboard.writeText(`${location.origin}${ruta}`);
      this.copiado.set(true);
    } catch {
      this.error.set(`Copia este enlace: ${location.origin}${ruta}`);
    }
  }

  protected async terminar(): Promise<void> {
    await this.guardar(async () => {
      await this.puertos.hogar.completarOnboarding();
      await this.sesion.recargar();
      await this.router.navigateByUrl('/hoy');
    });
  }

  private async guardar(accion: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      await accion();
    } catch (e) {
      this.error.set(e instanceof Error && e.name !== 'ReglaError' && e.message ? e.message : mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
