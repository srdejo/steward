import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SesionActual } from '../../core/sesion/sesion';
import { Icono } from '../../shared/components/icono';
import { Interruptor } from '../../shared/components/interruptor';

/** FaceId.dc.html. En modo demo solo guarda la preferencia: no llama a WebAuthn ni a la biometria. */
@Component({
  selector: 'app-face-id-page',
  imports: [Icono, Interruptor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-7 px-6 pt-16 pb-9' },
  template: `
    <div class="mt-20 flex flex-col items-center gap-5 text-center">
      <span class="flex h-[88px] w-[88px] items-center justify-center rounded-[24px] bg-acento-suave text-acento">
        <app-icono nombre="rostro" [tamano]="44" />
      </span>
      <h1 class="text-[26px] leading-tight font-bold">Entra con tu cara la próxima vez</h1>
      <p class="text-[15px] leading-normal text-secundario">
        Guardamos una llave de acceso en este dispositivo. Sin contraseñas que recordar, y en la web funciona igual con Touch ID o Windows Hello.
      </p>
    </div>

    <div class="rounded-[14px] border border-borde bg-superficie p-4">
      <app-interruptor titulo="Pedir Face ID al abrir la app" detalle="Después de 5 min sin usarla" [(activo)]="alAbrir" />
    </div>

    <div class="mt-auto flex flex-col gap-1.5">
      <button type="button" class="boton-grande" (click)="seguir(true)">Activar Face ID</button>
      <button type="button" class="boton-enlace h-12 text-[15px]" (click)="seguir(false)">Ahora no</button>
    </div>
  `,
})
export class FaceIdPage {
  private readonly sesion = inject(SesionActual);
  private readonly router = inject(Router);
  protected readonly alAbrir = signal(true);

  protected async seguir(activar: boolean): Promise<void> {
    await this.sesion.guardarPreferencias({ faceIdAlAbrir: activar && this.alAbrir() });
    await this.router.navigateByUrl('/onboarding/1');
  }
}
