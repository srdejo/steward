import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/**
 * Version nueva de la PWA sin cerrar y reabrir la app. El service worker baja la version nueva en segundo plano, pero la
 * instalada seguia mostrando la anterior hasta otra apertura. Ahora:
 * - al volver a la app (iOS la reanuda sin recargar) se busca si hay version nueva;
 * - cuando esta lista, la siguiente navegacion carga la pagina de destino ya con la version nueva. No se recarga en medio
 *   de una hoja abierta, para no perder lo que se estaba escribiendo.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionPwa {
  private readonly sw = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private lista = false;

  iniciar(): void {
    if (!this.sw.isEnabled) return;
    const versiones = this.sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => (this.lista = true));
    // La cache quedo en un estado que no se puede servir: solo queda recargar.
    const rota = this.sw.unrecoverable.subscribe(() => this.documento.location.reload());
    const navegacion = this.router.events.pipe(filter((e) => e instanceof NavigationStart)).subscribe((e) => {
      if (!this.lista) return;
      this.lista = false;
      this.documento.location.assign((e as NavigationStart).url);
    });
    const alVolver = () => {
      if (this.documento.visibilityState === 'visible') void this.sw.checkForUpdate().catch(() => undefined);
    };
    this.documento.addEventListener('visibilitychange', alVolver);
    this.destroyRef.onDestroy(() => {
      versiones.unsubscribe();
      rota.unsubscribe();
      navegacion.unsubscribe();
      this.documento.removeEventListener('visibilitychange', alVolver);
    });
  }
}
