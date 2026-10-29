import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS, puertosConectados } from '../../core/datos/puertos';
import { SesionActual } from '../../core/sesion/sesion';
import { Avatar } from '../../shared/components/avatar';
import { Interruptor } from '../../shared/components/interruptor';

/** Lo que la persona escribio antes de ir a entrar con Google: al volver se une sola (modo conectado). */
const CLAVE_UNIRME = 'steward/unirme';
interface UnirmePendiente {
  token: string;
  nombre: string;
  diezmo: boolean;
}

/** Invitado.dc.html: "{quien} te invitó a {hogar}". El invitado no configura ingresos ni cuentas. */
@Component({
  selector: 'app-invitacion-page',
  imports: [Avatar, Interruptor, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-6 px-6 pt-12 pb-9' },
  template: `
    @if (invitacion.isLoading()) {
      <p class="mt-24 text-center text-secundario">Cargando invitación…</p>
    } @else if (invitacion.value(); as inv) {
      <div class="mt-6 flex flex-col items-center gap-4 text-center">
        <div class="flex items-center">
          @for (m of inv.miembros; track m.id; let primero = $first) {
            <app-avatar [inicial]="m.inicial" [variante]="primero ? 'fuerte' : 'suave'" [tamano]="56" [class.-ml-3.5]="!primero" [class.border-[3px]]="!primero" [class.border-fondo]="!primero" />
          }
          <app-avatar [inicial]="inicialInvitado()" variante="suave" [tamano]="56" class="-ml-3.5 border-[3px] border-fondo" />
        </div>
        <h1 class="text-[26px] leading-tight font-bold">{{ inv.invitadoPor.nombre }} te invitó a {{ inv.hogar }}</h1>
        <p class="text-[15px] leading-normal text-secundario">Van a llevar juntos los gastos del hogar. Tus ingresos siguen siendo tuyos: aquí solo pones lo que aportas.</p>
      </div>

      <label class="flex flex-col gap-2">
        <span class="rotulo">Tu nombre</span>
        <input class="campo-grande h-[52px] text-base" placeholder="Tu nombre" autocomplete="given-name" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
      </label>

      <div class="rounded-[14px] border border-borde bg-superficie px-4 py-3.5">
        <app-interruptor titulo="Diezmar de mis aportes" detalle="Opcional · 10% al registrar cada aporte" [(activo)]="diezmo" />
      </div>

      <div class="nota">
        <span class="text-[13px] font-semibold">Lo que vas a hacer aquí</span>
        <span class="text-[13px] leading-normal text-[#3B3D39]">Marcar lo que pagas · poner un aporte cuando quieras · ver cuánto queda libre en el mes</span>
      </div>

      @if (error()) {
        <p role="alert" class="text-sm text-negativo">{{ error() }}</p>
      }

      <div class="mt-auto flex flex-col gap-1">
        <button type="button" class="boton-grande" [disabled]="uniendo()" (click)="unirme()">Unirme al hogar</button>
        @if (id()) {
          <a routerLink="/acceso/face-id" class="boton-enlace">Prefiero crear mi hogar</a>
        } @else {
          <a routerLink="/acceso" class="boton-enlace">No soy yo</a>
        }
      </div>
    } @else {
      <div class="mt-24 flex flex-col items-center gap-4 text-center">
        <h1 class="text-[26px] leading-tight font-bold">Esta invitación ya no es válida</h1>
        <p class="text-[15px] text-secundario">Se usó o venció (duran 7 días). Pide a quien te invitó que la reenvíe.</p>
        <a routerLink="/acceso" class="boton-grande mt-4">Ir al acceso</a>
      </div>
    }
  `,
})
export class InvitacionPage {
  private readonly puertos = inject(PUERTOS);
  private readonly sesion = inject(SesionActual);
  private readonly router = inject(Router);

  /** `/invitacion/:token`: el enlace del correo. */
  readonly token = input<string>();
  /** `/invitacion/para-mi/:id`: invitacion para el correo de la sesion, sin enlace (modo conectado). */
  readonly id = input<string>();
  private readonly conectadoP = puertosConectados(this.puertos);
  protected readonly invitacion = consulta(
    () => ({ token: this.token(), id: this.id() }),
    async (p, { token, id }) => {
      if (id) return (await this.conectadoP?.misInvitaciones())?.find((i) => i.id === id) ?? null;
      return token ? p.hogar.invitacion(token) : null;
    },
  );
  protected readonly nombre = signal('');
  protected readonly diezmo = signal(false);
  protected readonly uniendo = signal(false);
  protected readonly error = signal('');
  protected readonly inicialInvitado = computed(() => (this.nombre().trim().charAt(0) || this.invitacion.value()?.email.charAt(0) || '?').toUpperCase());

  private readonly conectado = this.conectadoP !== null;

  constructor() {
    // Modo conectado: si la persona fue a entrar con Google desde aqui, al volver con sesion se une sola.
    effect(() => {
      const inv = this.invitacion.value();
      if (!this.conectado || !inv) return;
      const pendiente = leerPendiente();
      if (!inv.token || pendiente?.token !== inv.token) return;
      untracked(() => void this.continuarTrasLogin(pendiente));
    });
    // Modo conectado con sesion: el nombre parte del de la cuenta (en demo la sesion es siempre la de Daniel).
    if (this.conectado) void this.sesion.cargar();
    effect(() => {
      const propio = this.conectado ? this.sesion.usuario()?.nombre : undefined;
      if (propio && !untracked(this.nombre)) this.nombre.set(propio);
    });
  }

  private async continuarTrasLogin(pendiente: UnirmePendiente): Promise<void> {
    if (!(await this.sesion.cargar())) return;
    borrarPendiente();
    this.nombre.set(pendiente.nombre);
    this.diezmo.set(pendiente.diezmo);
    await this.unirme();
  }

  protected async unirme(): Promise<void> {
    const id = this.id();
    const token = this.token() ?? '';
    // Modo conectado sin sesion: primero entrar y volver aqui (spec "Unirse sin sesión").
    if (!id && this.conectado && !(await this.sesion.cargar())) {
      guardarPendiente({ token, nombre: this.nombre(), diezmo: this.diezmo() });
      await this.router.navigate(['/acceso'], { queryParams: { volver: `/invitacion/${token}` } });
      return;
    }
    this.uniendo.set(true);
    this.error.set('');
    try {
      const s = id && this.conectadoP
        ? await this.conectadoP.aceptarMia(id, this.nombre(), this.diezmo())
        : await this.puertos.hogar.aceptar(token, this.nombre(), this.diezmo());
      this.sesion.establecer(s);
      await this.router.navigateByUrl('/hoy');
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.uniendo.set(false);
    }
  }
}

function leerPendiente(): UnirmePendiente | null {
  try {
    const texto = sessionStorage.getItem(CLAVE_UNIRME);
    return texto ? (JSON.parse(texto) as UnirmePendiente) : null;
  } catch {
    return null;
  }
}

function guardarPendiente(p: UnirmePendiente): void {
  try {
    sessionStorage.setItem(CLAVE_UNIRME, JSON.stringify(p));
  } catch {
    // Sin almacenamiento: al volver tendra que tocar "Unirme" otra vez.
  }
}

function borrarPendiente(): void {
  try {
    sessionStorage.removeItem(CLAVE_UNIRME);
  } catch {
    // nada que borrar
  }
}
