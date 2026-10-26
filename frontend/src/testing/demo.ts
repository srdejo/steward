import { EnvironmentProviders } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Puertos } from '@steward/domain';
import { storageEnMemoria } from '@steward/domain/demo';

import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from '../app/app.routes';
import { PUERTOS, providePuertosDemo } from '../app/core/datos/puertos';

/** Reloj de los artboards: lunes 26 de octubre de 2026. */
export const AHORA = () => new Date(2026, 9, 26, 10, 0, 0);
export const OCT = { anio: 2026, mes: 10 };
export const NOV = { anio: 2026, mes: 11 };

/** Adaptador de prueba con storage en memoria y reloj fijo. */
export function provideDemoPrueba(): EnvironmentProviders {
  return providePuertosDemo({ storage: storageEnMemoria(), ahora: AHORA });
}

/** Router de la app como en app.config.ts (los parametros de ruta llegan a los input()). */
export function provideAppPrueba(): EnvironmentProviders[] {
  return [provideRouter(routes, withComponentInputBinding()), provideDemoPrueba()];
}

export function puertos(): Puertos {
  return TestBed.inject(PUERTOS);
}

/** Inicia la sesion demo (Daniel, hogar configurado). */
export async function conSesion(): Promise<Puertos> {
  const p = puertos();
  await p.sesion.iniciar('GOOGLE');
  return p;
}
