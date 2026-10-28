import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TokenSesion } from './token-sesion';

/**
 * Agrega el Bearer a las llamadas a /api. Un 401 fuera del login (token vencido o invalido) borra la sesion y
 * lleva a Acceso (design D9).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenSesion);
  const router = inject(Router);
  const esApi = req.url.startsWith('/api/');
  const esLogin = req.url.startsWith('/api/auth/');
  const token = tokens.leer();
  const peticion = esApi && token && !esLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(peticion).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && esApi && !esLogin && token) {
        tokens.borrar();
        void router.navigateByUrl('/acceso');
      }
      return throwError(() => error);
    }),
  );
};
