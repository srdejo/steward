import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { PUERTOS } from '../datos/puertos';

export type EstadoPushWeb = 'ACTIVADAS' | 'APAGADAS' | 'BLOQUEADAS' | 'NO_SOPORTADO' | 'IPHONE_SIN_INSTALAR';

/**
 * Las notificaciones de este navegador con Web Push (spec steward-avisos, "Push en la PWA"; design D9 de avisos-pagos).
 * En iPhone solo llegan si la PWA esta en la pantalla de inicio; sin service worker (desarrollo y pruebas), no hay push.
 */
@Injectable({ providedIn: 'root' })
export class PushWeb {
  private readonly sw = inject(SwPush, { optional: true });
  private readonly puertos = inject(PUERTOS);
  readonly estado = signal<EstadoPushWeb>(this.estadoInicial());

  constructor() {
    this.sw?.subscription.subscribe((s) => {
      if (this.estado() === 'NO_SOPORTADO' || this.estado() === 'IPHONE_SIN_INSTALAR') return;
      this.estado.set(s ? 'ACTIVADAS' : this.permiso() === 'denied' ? 'BLOQUEADAS' : 'APAGADAS');
    });
  }

  /** Pide el permiso, suscribe el navegador y lo registra para la persona. */
  async activar(): Promise<void> {
    if (!this.sw?.isEnabled) throw new Error('Este navegador no recibe notificaciones.');
    const clave = await this.puertos.avisos.clavePushWeb();
    if (!clave) throw new Error('Las notificaciones del navegador aún no están disponibles.');
    try {
      const s = (await this.sw.requestSubscription({ serverPublicKey: clave })).toJSON();
      await this.puertos.avisos.registrarDispositivo({ tipo: 'WEB', endpoint: s.endpoint!, p256dh: s.keys!['p256dh']!, auth: s.keys!['auth']! });
      this.estado.set('ACTIVADAS');
    } catch (e) {
      if (this.permiso() === 'denied') {
        this.estado.set('BLOQUEADAS');
        return;
      }
      throw e;
    }
  }

  /** Al cerrar sesion: este navegador deja de recibir los avisos de la persona. */
  async desactivar(): Promise<void> {
    if (!this.sw?.isEnabled) return;
    const s = await firstValueFrom(this.sw.subscription);
    if (!s) return;
    await this.puertos.avisos.quitarDispositivo(s.endpoint).catch(() => undefined);
    await this.sw.unsubscribe().catch(() => undefined);
    this.estado.set('APAGADAS');
  }

  probar(): Promise<void> {
    return this.puertos.avisos.probar();
  }

  private estadoInicial(): EstadoPushWeb {
    if (typeof navigator === 'undefined') return 'NO_SOPORTADO';
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const instalada = (navigator as Navigator & { standalone?: boolean }).standalone === true || globalThis.matchMedia?.('(display-mode: standalone)').matches === true;
    if (ios && !instalada) return 'IPHONE_SIN_INSTALAR';
    if (!this.sw?.isEnabled || !('PushManager' in globalThis)) return 'NO_SOPORTADO';
    return this.permiso() === 'denied' ? 'BLOQUEADAS' : 'APAGADAS';
  }

  private permiso(): NotificationPermission | 'default' {
    return typeof Notification === 'undefined' ? 'default' : Notification.permission;
  }
}
