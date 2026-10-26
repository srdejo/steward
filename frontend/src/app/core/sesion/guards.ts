import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { SesionActual } from './sesion';

/** Con sesion y hogar configurado: la app. Sin sesion: Acceso. Sin configurar: el onboarding. */
export const appGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const sesion = await inject(SesionActual).cargar();
  if (!sesion) return router.parseUrl('/acceso');
  if (!sesion.hogarConfigurado) return router.parseUrl('/onboarding/1');
  return true;
};

/** Pantallas de acceso: con sesion ya iniciada se sigue a donde corresponda. */
export const accesoGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const sesion = await inject(SesionActual).cargar();
  if (!sesion) return true;
  return router.parseUrl(sesion.hogarConfigurado ? '/hoy' : '/onboarding/1');
};

/** Activar Face ID y el onboarding: requieren sesion y un hogar aun sin configurar. */
export const onboardingGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const sesion = await inject(SesionActual).cargar();
  if (!sesion) return router.parseUrl('/acceso');
  if (sesion.hogarConfigurado) return router.parseUrl('/hoy');
  return true;
};
