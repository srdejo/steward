import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

/** Navega con el router real de la app y deja helpers para interactuar como el usuario. */
export async function app(url: string) {
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  const estable = async () => {
    for (let i = 0; i < 3; i++) {
      await harness.fixture.whenStable();
      await new Promise((r) => setTimeout(r));
    }
    harness.detectChanges();
  };
  await harness.navigateByUrl(url);
  await estable();
  const raiz = () => harness.fixture.nativeElement as HTMLElement;

  const porTexto = <T extends HTMLElement = HTMLElement>(texto: string | RegExp, selector = 'button, a, [role="radio"], [role="switch"]'): T => {
    const el = [...raiz().querySelectorAll<T>(selector)].find((e) => (typeof texto === 'string' ? e.textContent!.trim() === texto : texto.test(e.textContent!.trim())));
    if (!el) throw new Error(`No encontré "${texto}" en: ${[...raiz().querySelectorAll(selector)].map((e) => e.textContent!.trim()).join(' | ')}`);
    return el;
  };

  return {
    harness,
    router,
    raiz,
    estable,
    texto: () => raiz().textContent!.replace(/\s+/g, ' '),
    url: () => router.url,
    porTexto,
    async tocar(texto: string | RegExp, selector?: string) {
      porTexto(texto, selector).click();
      await estable();
    },
    async escribir(selectorOEtiqueta: string, valor: string) {
      const campo = campoPor(raiz(), selectorOEtiqueta);
      campo.value = valor;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      await estable();
    },
    campo: (selectorOEtiqueta: string) => campoPor(raiz(), selectorOEtiqueta),
    async ir(destino: string) {
      await harness.navigateByUrl(destino);
      await estable();
    },
  };
}

/** Campo por selector CSS o por el texto de su etiqueta (label, aria-label o placeholder). */
function campoPor(raiz: HTMLElement, clave: string): HTMLInputElement {
  try {
    const directo = raiz.querySelector<HTMLInputElement>(clave);
    if (directo) return directo;
  } catch {
    // No era un selector CSS valido: se busca por etiqueta.
  }
  const normal = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  for (const label of raiz.querySelectorAll('label')) {
    if (!normal(label.textContent).startsWith(normal(clave))) continue;
    const id = label.getAttribute('for');
    const campo = (id ? raiz.querySelector<HTMLInputElement>(`#${id}`) : null) ?? label.querySelector<HTMLInputElement>('input, textarea');
    if (campo) return campo;
  }
  const otro = [...raiz.querySelectorAll<HTMLInputElement>('input, textarea')].find((c) => normal(c.getAttribute('aria-label')) === normal(clave) || normal(c.placeholder) === normal(clave));
  if (otro) return otro;
  throw new Error(`No encontré el campo "${clave}"`);
}
