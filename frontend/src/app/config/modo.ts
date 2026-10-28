import type { ModoDatos } from './modo-datos';

/**
 * Modo `production` (lo que publica local-deploy.ps1): conectado. Las configuraciones `demo` y `development` lo
 * reemplazan por modo.demo.ts (fileReplacements en angular.json).
 */
export const MODO_DATOS: ModoDatos = 'conectado';
