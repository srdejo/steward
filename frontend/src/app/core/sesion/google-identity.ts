import { InjectionToken } from '@angular/core';

/** La parte de Google Identity Services (accounts.google.com/gsi/client) que usa Presupuesto Hogar (copiado de denti-caja hasta que exista @srdejo/web-shell). */
export interface GoogleAccountsId {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}

export type GoogleIdentityLoader = () => Promise<GoogleAccountsId>;

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleAccountsId> | undefined;

function loadScript(): Promise<GoogleAccountsId> {
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const id = (window as unknown as { google?: { accounts?: { id?: GoogleAccountsId } } }).google?.accounts?.id;
      if (id) {
        resolve(id);
      } else {
        reject(new Error('Google Identity Services no cargó'));
      }
    };
    script.onerror = () => {
      loading = undefined;
      reject(new Error('Google Identity Services no cargó'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Carga el script de Google una sola vez por página; los tests lo reemplazan por un doble (mismo patrón que denti-caja y perla-ai). */
export const GOOGLE_IDENTITY_LOADER = new InjectionToken<GoogleIdentityLoader>('GOOGLE_IDENTITY_LOADER', {
  providedIn: 'root',
  factory: () => loadScript,
});
