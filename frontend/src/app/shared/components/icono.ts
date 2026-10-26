import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Iconos de trazo de los artboards (24×24, trazo 1.8). Decorativos: el texto vecino los nombra. */
const TRAZOS = {
  hoy: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  planear: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  cuentas: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  derecha: '<path d="M9 5l7 7-7 7"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  candado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  rostro: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1M15 9v1M12 9v4h-1M9.5 16c1.5 1 3.5 1 5 0"/>',
  correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  mover: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

@Component({
  selector: 'app-icono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `<svg [attr.width]="tamano()" [attr.height]="tamano()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" [innerHTML]="trazo()"></svg>`,
})
export class Icono {
  private readonly sanitizer = inject(DomSanitizer);
  readonly nombre = input.required<NombreIcono>();
  readonly tamano = input(22);
  // Los trazos son constantes de este archivo (nunca datos del usuario): sin esto el saneador quita los elementos SVG.
  protected readonly trazo = computed(() => this.sanitizer.bypassSecurityTrustHtml(TRAZOS[this.nombre()]));
}
