import { Routes } from '@angular/router';

import { accesoGuard, appGuard, onboardingGuard } from './core/sesion/guards';
import { Shell } from './core/layout/shell';

// Rutas de design D5. Cada pantalla carga lazy; los destinos principales viven dentro del Shell.
export const routes: Routes = [
  { path: 'acceso', canActivate: [accesoGuard], loadComponent: () => import('./features/acceso/acceso-page').then((m) => m.AccesoPage) },
  { path: 'acceso/face-id', canActivate: [onboardingGuard], loadComponent: () => import('./features/acceso/face-id-page').then((m) => m.FaceIdPage) },
  { path: 'onboarding/:paso', canActivate: [onboardingGuard], loadComponent: () => import('./features/acceso/onboarding-page').then((m) => m.OnboardingPage) },
  // Invitacion para el correo de la sesion (sin enlace): requiere sesion y no tener el hogar configurado.
  { path: 'invitacion/para-mi/:id', canActivate: [onboardingGuard], loadComponent: () => import('./features/acceso/invitacion-page').then((m) => m.InvitacionPage) },
  { path: 'invitacion/:token', loadComponent: () => import('./features/acceso/invitacion-page').then((m) => m.InvitacionPage) },
  {
    path: '',
    component: Shell,
    canActivate: [appGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'hoy' },
      {
        path: 'hoy',
        loadComponent: () => import('./features/hoy/hoy-page').then((m) => m.HoyPage),
        children: [
          { path: 'aporte', loadComponent: () => import('./features/hoy/aporte-hoja').then((m) => m.AporteHoja) },
          { path: 'pagar/:itemId', loadComponent: () => import('./features/hoy/pagar-hoja').then((m) => m.PagarHoja) },
          { path: 'recibir/:clave', loadComponent: () => import('./features/hoy/recibir-hoja').then((m) => m.RecibirHoja) },
          { path: 'gasto', loadComponent: () => import('./features/hoy/gasto-hoja').then((m) => m.GastoHoja) },
        ],
      },
      { path: 'planear', loadComponent: () => import('./features/planear/planear-inicio-page').then((m) => m.PlanearInicioPage) },
      { path: 'planear/anual/:anio', data: { ancho: 'completo' }, loadComponent: () => import('./features/planear/anual-page').then((m) => m.AnualPage) },
      { path: 'planear/:mes', loadComponent: () => import('./features/planear/mes-page').then((m) => m.MesPage) },
      { path: 'planear/:mes/comparar', data: { ancho: 'completo' }, loadComponent: () => import('./features/planear/comparar-page').then((m) => m.CompararPage) },
      { path: 'planear/:mes/cierre', loadComponent: () => import('./features/planear/cierre-page').then((m) => m.CierrePage) },
      { path: 'cuentas', loadComponent: () => import('./features/cuentas/cuentas-page').then((m) => m.CuentasPage) },
      { path: 'cuentas/cuadrar', loadComponent: () => import('./features/cuentas/cuadrar-page').then((m) => m.CuadrarPage) },
      { path: 'cuentas/credito/:id', loadComponent: () => import('./features/cuentas/credito-page').then((m) => m.CreditoPage) },
      { path: 'ajustes', loadComponent: () => import('./features/ajustes/ajustes-page').then((m) => m.AjustesPage) },
    ],
  },
  { path: '**', redirectTo: 'hoy' },
];
