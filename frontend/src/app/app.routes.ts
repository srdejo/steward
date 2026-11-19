import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';

import { accesoGuard, appGuard, onboardingGuard } from './core/sesion/guards';
import { Shell } from './core/layout/shell';
import { ESCRITORIO } from './shared/escritorio';

/** En escritorio el mes ya muestra las opciones lado a lado: Comparar lleva al mes (design D6 de plan-mes-escritorio). */
const compararEnElMes: CanActivateFn = (ruta) =>
  typeof matchMedia === 'function' && matchMedia(ESCRITORIO).matches ? inject(Router).createUrlTree(['/planear', ruta.paramMap.get('mes')]) : true;

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
        data: { ancho: 'escritorio' },
        loadComponent: () => import('./features/hoy/hoy-page').then((m) => m.HoyPage),
        children: [
          // Las hojas de siempre abren Agregar sobre Hoy (rediseno-libreta-clara, design D3).
          { path: 'aporte', redirectTo: () => '/hoy?agregar=aporte' },
          { path: 'pagar/:itemId', redirectTo: ({ params }) => `/hoy?agregar=pago&item=${encodeURIComponent(params['itemId'] ?? '')}` },
          { path: 'recibir/:clave', loadComponent: () => import('./features/hoy/recibir-hoja').then((m) => m.RecibirHoja) },
          { path: 'gasto', redirectTo: ({ queryParams }) => `/hoy?agregar=gasto${queryParams['item'] ? `&item=${encodeURIComponent(queryParams['item'])}` : ''}` },
          { path: 'registro/:registroId', loadComponent: () => import('./features/hoy/registro-hoja').then((m) => m.RegistroHoja) },
          { path: 'registros', loadComponent: () => import('./features/hoy/registros-hoja').then((m) => m.RegistrosHoja) },
        ],
      },
      { path: 'planear', data: { ancho: 'escritorio' }, loadComponent: () => import('./features/planear/planear-inicio-page').then((m) => m.PlanearInicioPage) },
      { path: 'planear/anual/:anio/base', data: { ancho: 'completo' }, loadComponent: () => import('./features/planear/anual-base-page').then((m) => m.AnualBasePage) },
      { path: 'planear/anual/:anio', data: { ancho: 'completo' }, loadComponent: () => import('./features/planear/anual-page').then((m) => m.AnualPage) },
      { path: 'planear/:mes', data: { ancho: 'completo' }, loadComponent: () => import('./features/planear/mes-page').then((m) => m.MesPage) },
      { path: 'planear/:mes/comparar', data: { ancho: 'completo' }, canActivate: [compararEnElMes], loadComponent: () => import('./features/planear/comparar-page').then((m) => m.CompararPage) },
      { path: 'planear/:mes/cierre', data: { ancho: 'escritorio' }, loadComponent: () => import('./features/planear/cierre-page').then((m) => m.CierrePage) },
      { path: 'cuentas', data: { ancho: 'escritorio' }, loadComponent: () => import('./features/cuentas/cuentas-page').then((m) => m.CuentasPage) },
      { path: 'cuentas/cuadrar', loadComponent: () => import('./features/cuentas/cuadrar-page').then((m) => m.CuadrarPage) },
      {
        path: 'cuentas/cuenta/:id',
        loadComponent: () => import('./features/cuentas/cuenta-page').then((m) => m.CuentaPage),
        children: [{ path: 'registro/:registroId', loadComponent: () => import('./features/hoy/registro-hoja').then((m) => m.RegistroHoja) }],
      },
      { path: 'cuentas/credito/:id', data: { ancho: 'escritorio' }, loadComponent: () => import('./features/cuentas/credito-page').then((m) => m.CreditoPage) },
      { path: 'avisos', data: { ancho: 'escritorio' }, loadComponent: () => import('./features/avisos/avisos-page').then((m) => m.AvisosPage) },
      { path: 'ajustes', data: { ancho: 'escritorio' }, loadComponent: () => import('./features/ajustes/ajustes-page').then((m) => m.AjustesPage) },
    ],
  },
  { path: '**', redirectTo: 'hoy' },
];
