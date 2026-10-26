import { ApplicationRef, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { storageEnMemoria } from '@steward/domain/demo';

import { consulta } from './consulta';
import { PUERTOS, providePuertosDemo } from './puertos';

const OCT = { anio: 2026, mes: 10 };

@Component({ template: '' })
class Prueba {
  readonly resumen = consulta(() => OCT, (p, ref) => p.movimientos.resumenMes(ref));
  readonly puertos = inject(PUERTOS);
}

describe('consulta', () => {
  it('se recarga sola despues de una escritura en el adaptador', async () => {
    TestBed.configureTestingModule({ providers: [providePuertosDemo({ storage: storageEnMemoria(), ahora: () => new Date(2026, 9, 26) })] });
    const fixture = TestBed.createComponent(Prueba);
    const app = TestBed.inject(ApplicationRef);
    await app.whenStable();
    expect(fixture.componentInstance.resumen.value()?.libre).toBe(3_436_000);

    const { puertos } = fixture.componentInstance;
    await puertos.sesion.iniciar('GOOGLE');
    await puertos.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: '', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    await app.whenStable();
    expect(fixture.componentInstance.resumen.value()?.libre).toBe(3_436_000 - 85_000);
  });
});
