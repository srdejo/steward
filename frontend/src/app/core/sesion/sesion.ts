import { Injectable, computed, inject, signal } from '@angular/core';
import type { MetodoAcceso, Preferencias, Sesion } from '@steward/domain';

import { PUERTOS } from '../datos/puertos';

/** Sesion actual de la app (en modo demo, la del adaptador de prueba). */
/** Face ID y "Ocultar montos" llegan con passkeys: hasta entonces no se ofrecen ni aplican (design D7 de usabilidad-plan). */
export const SEGURIDAD_DISPONIBLE = false as boolean;

@Injectable({ providedIn: 'root' })
export class SesionActual {
  private readonly puertos = inject(PUERTOS);
  private readonly estado = signal<Sesion | null>(null);
  private carga: Promise<Sesion | null> | null = null;

  readonly sesion = this.estado.asReadonly();
  readonly usuario = computed(() => this.estado()?.usuario ?? null);
  readonly preferencias = computed<Preferencias>(() => this.estado()?.preferencias ?? { faceIdAlAbrir: false, ocultarMontos: false });

  /** Lee la sesion guardada una sola vez (los guards la esperan antes de decidir). */
  cargar(): Promise<Sesion | null> {
    this.carga ??= this.puertos.sesion.actual().then((s) => {
      this.estado.set(s);
      return s;
    });
    return this.carga;
  }

  async recargar(): Promise<Sesion | null> {
    this.carga = null;
    return this.cargar();
  }

  async iniciar(metodo: MetodoAcceso): Promise<Sesion> {
    const s = await this.puertos.sesion.iniciar(metodo);
    this.estado.set(s);
    this.carga = Promise.resolve(s);
    return s;
  }

  /** Tras "Unirme" o completar el onboarding el adaptador ya cambio la sesion: se vuelve a leer. */
  establecer(s: Sesion | null): void {
    this.estado.set(s);
    this.carga = Promise.resolve(s);
  }

  async cerrar(): Promise<void> {
    await this.puertos.sesion.cerrar();
    this.establecer(null);
  }

  async guardarPreferencias(cambios: Partial<Preferencias>): Promise<void> {
    const preferencias = await this.puertos.sesion.guardarPreferencias(cambios);
    const actual = this.estado();
    if (actual) this.estado.set({ ...actual, preferencias });
  }
}
