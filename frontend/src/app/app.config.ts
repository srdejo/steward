import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { MODO_DATOS } from './config/modo';
import { authInterceptor } from './core/datos/http/auth.interceptor';
import { providePuertosConectados, providePuertosDemo } from './core/datos/puertos';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Modo de datos (design D9): production → conectado; las configuraciones demo y development → solo prueba.
    MODO_DATOS === 'conectado' ? providePuertosConectados() : providePuertosDemo(),
    // PWA: el service worker solo cachea los archivos de la app, nunca /api (ver ngsw-config.json).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
