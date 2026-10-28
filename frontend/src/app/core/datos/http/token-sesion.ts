import { Injectable } from '@angular/core';

const CLAVE = 'steward/sesion';

/**
 * Token de la sesion del backend (JWT de 7 dias, design D4), guardado en localStorage como el resto de PWAs del
 * workspace. Cerrar sesion es borrarlo.
 */
@Injectable({ providedIn: 'root' })
export class TokenSesion {
  leer(): string | null {
    try {
      return localStorage.getItem(CLAVE);
    } catch {
      return null;
    }
  }

  guardar(token: string): void {
    try {
      localStorage.setItem(CLAVE, token);
    } catch {
      // Sin almacenamiento (modo privado): la sesion dura lo que la pestana.
    }
  }

  borrar(): void {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      // nada que borrar
    }
  }
}
