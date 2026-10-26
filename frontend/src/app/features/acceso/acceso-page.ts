import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { MetodoAcceso } from '@steward/domain';

import { mensajeDeError } from '../../core/datos/consulta';
import { SesionActual } from '../../core/sesion/sesion';
import { Icono } from '../../shared/components/icono';

/** Acceso.dc.html: una sola pantalla para entrar o crear cuenta (spec steward-acceso-onboarding). */
@Component({
  selector: 'app-acceso-page',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-8 px-6 pt-16 pb-9' },
  template: `
    <div class="mt-10 flex flex-col gap-4">
      <span class="flex h-14 w-14 items-center justify-center rounded-panel bg-acento text-white">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M9 20v-5h6v5" />
        </svg>
      </span>
      <h1 class="text-[30px] leading-[1.15] font-bold">Presupuesto Hogar</h1>
      <p class="text-base leading-[1.45] text-secundario">Planeen el mes juntos y lleven lo que de verdad pasa.</p>
    </div>

    <div class="mt-auto flex flex-col gap-2.5">
      <button type="button" class="boton h-[52px] rounded-[14px] border border-[#D9D8D2] bg-superficie text-base" [disabled]="entrando()" (click)="entrar('GOOGLE')">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.2a11 11 0 0 0 0 9.9z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        Continuar con Google
      </button>
      <button type="button" class="boton-grande" [disabled]="entrando()" (click)="entrar('FACE_ID')">
        <app-icono nombre="rostro" [tamano]="20" />Entrar con Face ID
      </button>
      <button type="button" class="boton-enlace h-12 text-[15px]" [disabled]="entrando()" (click)="entrar('CORREO')">Continuar con correo</button>
      @if (error()) {
        <p role="alert" class="text-center text-sm text-negativo">{{ error() }}</p>
      }
    </div>

    <div class="flex flex-col gap-1.5 text-center">
      <p class="text-[13px] leading-[1.45] text-secundario">Si es tu primera vez, se crea tu cuenta. Si te invitaron, entra con el correo de la invitación.</p>
      <p class="text-xs text-secundario">Al continuar aceptas los Términos y la Privacidad (próximamente).</p>
    </div>
  `,
})
export class AccesoPage {
  private readonly sesion = inject(SesionActual);
  private readonly router = inject(Router);
  protected readonly entrando = signal(false);
  protected readonly error = signal('');

  protected async entrar(metodo: MetodoAcceso): Promise<void> {
    this.entrando.set(true);
    this.error.set('');
    try {
      const s = await this.sesion.iniciar(metodo);
      await this.router.navigateByUrl(s.hogarConfigurado ? '/hoy' : '/acceso/face-id');
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.entrando.set(false);
    }
  }
}
