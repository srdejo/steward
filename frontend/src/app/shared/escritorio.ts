import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/** Desde aqui el shell pasa a menu lateral (spec steward-ui-shell) y las pantallas usan su vista de escritorio. */
export const ESCRITORIO = '(min-width: 1024px)';

/**
 * Si el ancho es de escritorio, como señal que sigue los cambios de tamaño (design D1 de web-escritorio-completo).
 * Se llama en un contexto de inyeccion (constructor o inicializador de campo); sin `matchMedia` es false.
 */
export function anchoEscritorio(): Signal<boolean> {
  const mq = typeof matchMedia === 'function' ? matchMedia(ESCRITORIO) : null;
  const escritorio = signal(mq?.matches ?? false);
  if (mq) {
    const cambio = (e: MediaQueryListEvent) => escritorio.set(e.matches);
    mq.addEventListener('change', cambio);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', cambio));
  }
  return escritorio.asReadonly();
}
