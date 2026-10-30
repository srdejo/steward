import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideDemoPrueba, conSesion } from '../../../testing/demo';
import { SesionActual } from '../../core/sesion/sesion';
import { Hoja } from './hoja';
import { Monto } from './monto';
import { MontoInput } from './monto-input';

@Component({
  imports: [MontoInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-monto-input etiqueta="¿Cuánto?" [(valor)]="valor" />',
})
class ConMonto {
  readonly valor = signal<number | null>(null);
}

@Component({
  imports: [Hoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="disparador" (click)="abierta.set(true)">Abrir</button>
    @if (abierta()) {
      <app-hoja titulo="Nuevo aporte" (cerrar)="abierta.set(false)"><input id="dentro" /></app-hoja>
    }
  `,
})
class ConHoja {
  readonly abierta = signal(false);
}

describe('componentes compartidos', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDemoPrueba()] }));

  it('monto-input formatea mientras se escribe y entrega el entero', async () => {
    const f = TestBed.createComponent(ConMonto);
    await f.whenStable();
    const campo = f.nativeElement.querySelector('input') as HTMLInputElement;
    expect(f.nativeElement.querySelector('label').getAttribute('for')).toBe(campo.id);
    campo.value = '2538000';
    campo.dispatchEvent(new Event('input'));
    await f.whenStable();
    expect(campo.value).toBe('$2.538.000');
    expect(f.componentInstance.valor()).toBe(2_538_000);
    campo.value = '$2.5a';
    campo.dispatchEvent(new Event('input'));
    expect(campo.value).toBe('$25');
    f.componentInstance.valor.set(50_000);
    await f.whenStable();
    expect(campo.value).toBe('$50.000');
  });

  it('la hoja atrapa el foco, Escape la cierra y el foco vuelve al disparador', async () => {
    const f = TestBed.createComponent(ConHoja);
    document.body.appendChild(f.nativeElement);
    await f.whenStable();
    const disparador = f.nativeElement.querySelector('#disparador') as HTMLButtonElement;
    disparador.focus();
    disparador.click();
    await f.whenStable();
    const dialogo = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement?.id).toBe('dentro');

    // Tab desde el ultimo enfocable vuelve al primero (el input proyectado va despues de "Cancelar").
    const ultimo = f.nativeElement.querySelector('#dentro') as HTMLInputElement;
    ultimo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');

    dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(disparador);
    f.nativeElement.remove();
  });

  it('los montos se ven siempre mientras "Ocultar montos" no esté disponible', async () => {
    await conSesion();
    const sesion = TestBed.inject(SesionActual);
    await sesion.cargar();
    await sesion.guardarPreferencias({ ocultarMontos: true });
    const f = TestBed.createComponent(Monto);
    f.componentRef.setInput('valor', 3_436_000);
    await f.whenStable();
    expect(f.nativeElement.textContent.trim()).toBe('$3.436.000');
  });
});
