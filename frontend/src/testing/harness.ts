import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

/**
 * Navega con el router real de la app y deja helpers para interactuar como el usuario. En modo conectado los guards
 * piden datos por HTTP: `mientrasNavega` los responde antes de esperar a que termine la navegacion.
 */
export async function app(url: string, mientrasNavega?: (estable: () => Promise<void>) => Promise<void>) {
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  const estable = async () => {
    for (let i = 0; i < 3; i++) {
      // whenStable tambien espera las peticiones HTTP pendientes: en modo conectado las responde el test, asi que
      // no se espera mas de 50 ms por vuelta.
      await Promise.race([harness.fixture.whenStable(), new Promise((r) => setTimeout(r, 50))]);
      await new Promise((r) => setTimeout(r));
    }
    harness.detectChanges();
  };
  const navegacion = harness.navigateByUrl(url);
  if (mientrasNavega) await mientrasNavega(estable);
  await navegacion;
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
    /** Texto visible con un espacio entre nodos (como lo leeria una persona), sin el de los <select>. */
    texto: () => textoLegible(raiz()),
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
      // Como quien escribe y sale del campo: los que guardan al confirmar escuchan `change`.
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      await estable();
    },
    campo: (selectorOEtiqueta: string) => campoPor(raiz(), selectorOEtiqueta),
    async ir(destino: string) {
      await harness.navigateByUrl(destino);
      await estable();
    },
  };
}

export function textoLegible(raiz: Node): string {
  const partes: string[] = [];
  const recorrer = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) partes.push(n.textContent ?? '');
    else if (!(n instanceof HTMLSelectElement)) n.childNodes.forEach(recorrer);
  };
  recorrer(raiz);
  return partes.join(' ').replace(/\s+/g, ' ').trim();
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
