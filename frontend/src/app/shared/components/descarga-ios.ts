import { ChangeDetectionStrategy, Component } from '@angular/core';

/** La app de iPhone en la App Store. */
export const URL_APP_IOS = 'https://apps.apple.com/us/app/steward/id6783429254';

/** "Descarga la app para iPhone": enlace a la App Store, en Entrar y en Ajustes de la PWA. */
@Component({
  selector: 'app-descarga-ios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [href]="url" target="_blank" rel="noopener" data-testid="descarga-ios"
      class="flex h-12 items-center justify-center gap-2.5 rounded-[14px] bg-[#111111] px-5 text-[15px] font-semibold text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-4.1zM13.9 5.2c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-3 1.5-.6.7-1.2 1.9-1 3.1 1.1.1 2.3-.6 3-1.4z" />
      </svg>
      Descarga la app para iPhone
    </a>
  `,
})
export class DescargaIos {
  protected readonly url = URL_APP_IOS;
}
