import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { ActualizacionPwa } from './actualizacion';

@Component({ template: '' })
class Vacia {}

describe('Actualización de la PWA', () => {
  const versiones = new Subject<VersionEvent>();
  const checkForUpdate = vi.fn(() => Promise.resolve(false));
  const assign = vi.fn();
  let visible: DocumentVisibilityState = 'visible';
  const listeners = new Map<string, () => void>();
  const documento = {
    location: { assign, reload: vi.fn() },
    get visibilityState() {
      return visible;
    },
    addEventListener: (tipo: string, fn: () => void) => listeners.set(tipo, fn),
    removeEventListener: () => undefined,
  };

  beforeEach(() => {
    assign.mockClear();
    checkForUpdate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Vacia }]),
        { provide: SwUpdate, useValue: { isEnabled: true, versionUpdates: versiones, unrecoverable: new Subject(), checkForUpdate } },
        { provide: DOCUMENT, useValue: documento },
      ],
    });
    TestBed.inject(ActualizacionPwa).iniciar();
  });

  it('con la versión nueva lista, la siguiente navegación la carga en el destino', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/hoy');
    expect(assign).not.toHaveBeenCalled();

    versiones.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    void router.navigateByUrl('/cuentas');
    expect(assign).toHaveBeenCalledExactlyOnceWith('/cuentas');
  });

  it('al volver a la app busca si hay versión nueva', () => {
    visible = 'hidden';
    listeners.get('visibilitychange')!();
    expect(checkForUpdate).not.toHaveBeenCalled();
    visible = 'visible';
    listeners.get('visibilitychange')!();
    expect(checkForUpdate).toHaveBeenCalledOnce();
  });
});
