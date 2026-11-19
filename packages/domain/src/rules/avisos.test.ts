import { describe, expect, it } from 'vitest';

import { crearSemilla } from '../demo';
import { pendientesAvisos, proximosAvisos } from './avisos';
import { marcarPago } from './ejecucion';

// Spec steward-avisos, "Qué se avisa" y "Avisos · Próximos" (avisos-pagos). Los mismos casos que AvisosUseCaseTest del backend.
const HOY = '2026-10-26';
const OCT = { anio: 2026, mes: 10 };
const semilla = () => crearSemilla(HOY);
const linea = (a: ReturnType<typeof proximosAvisos>[number]) => `${a.grupo} ${a.fecha} ${a.nombre} | ${a.detalle}${a.monto === null ? '' : ` | ${a.monto}`}`;

describe('Avisos (avisos-pagos)', () => {
  it('próximos el 26 oct: vencido, próximos 7 días, más adelante y para no olvidar', () => {
    const avisos = proximosAvisos(semilla(), HOY);
    const de = (g: string) => avisos.filter((a) => a.grupo === g).map(linea);
    expect(de('VENCIDO')).toEqual(['VENCIDO 2026-10-20 Compra a cuotas | Cuota 4 de 12 · hace 6 días | 375000']);
    expect(de('SEMANA')).toEqual([
      'SEMANA 2026-10-28 Nu · Mercado | En 2 días · valor del extracto | 320000',
      'SEMANA 2026-10-30 Mastercard | En 4 días · pago fijo | 1500000',
      'SEMANA 2026-10-31 Cerrar octubre | En 5 días · último día del mes',
      'SEMANA 2026-11-01 Elegir opción de noviembre | Noviembre empieza en 6 días · 3 opciones',
    ]);
    expect(de('ADELANTE')).toContain('ADELANTE 2026-11-05 Pensión | En 10 días | 550000');
    expect(de('ADELANTE')).toContain('ADELANTE 2026-11-20 Compra a cuotas | Cuota 5 de 12 · en 25 días | 375000');
    expect(de('NO_OLVIDAR')).toEqual(['NO_OLVIDAR 2026-10-26 Cuadrar Ahorros Esposa | Sin cuadrar desde el 20 sep']);
  });

  it('un corte de tarjeta se ve distinto y no cuenta en la campana', () => {
    const avisos = proximosAvisos(semilla(), HOY);
    const corte = avisos.find((a) => a.nombre === 'Corte Nu')!;
    expect(corte).toMatchObject({ fecha: '2026-11-13', corte: true, tipo: 'TARJETA', monto: null, pago: null });
    // 1 vencido y 4 en los próximos 7 días.
    expect(pendientesAvisos(avisos)).toBe(5);
  });

  it('lo pagado deja de avisarse y los variables y el diezmo nunca se avisan', () => {
    const s = semilla();
    const master = proximosAvisos(s, HOY).find((a) => a.nombre === 'Mastercard')!;
    expect(master.pago).toEqual({ itemId: master.pago!.itemId, ref: OCT });
    const pagado = marcarPago(s, { itemId: master.pago!.itemId, ref: OCT, monto: 1_500_000, usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, fecha: '2026-10-27', creadoPor: 'u-daniel' });
    const nombres = proximosAvisos(pagado, '2026-10-27').map((a) => `${a.nombre}:${a.fecha.slice(0, 7)}`);
    expect(nombres).not.toContain('Mastercard:2026-10');
    expect(nombres.some((n) => n.startsWith('Mercado') || n.startsWith('Transporte') || n.startsWith('Diezmo'))).toBe(false);
  });

  it('lo que no es un pago lleva a su pantalla', () => {
    const avisos = proximosAvisos(semilla(), HOY);
    expect(avisos.find((a) => a.nombre === 'Cerrar octubre')!.destino).toEqual({ tipo: 'CIERRE', ref: OCT });
    expect(avisos.find((a) => a.nombre === 'Elegir opción de noviembre')!.destino).toEqual({ tipo: 'COMPARAR', ref: { anio: 2026, mes: 11 } });
    expect(avisos.find((a) => a.nombre === 'Cuadrar Ahorros Esposa')!.destino).toEqual({ tipo: 'CUENTA', cuentaId: 'cta-ahorros-esposa' });
  });
});

describe('Cuándo se avisa (avisos-pagos)', () => {
  it('el lunes de la semana, el día anterior y el mismo día; nunca después', async () => {
    const { momentosDeHoy } = await import('./avisos');
    // Mastercard paga el viernes 30 oct.
    expect(momentosDeHoy('2026-10-30', '2026-10-26')).toEqual(['LUNES']);
    expect(momentosDeHoy('2026-10-30', '2026-10-28')).toEqual([]);
    expect(momentosDeHoy('2026-10-30', '2026-10-29')).toEqual(['ANTES']);
    expect(momentosDeHoy('2026-10-30', '2026-10-30')).toEqual(['DIA']);
    expect(momentosDeHoy('2026-10-30', '2026-10-31')).toEqual([]);
    // Un pago del martes: el lunes es también el día anterior, y va en el mismo aviso.
    expect(momentosDeHoy('2026-10-27', '2026-10-26')).toEqual(['LUNES', 'ANTES']);
    // Uno del lunes siguiente no entra en el lunes de esta semana.
    expect(momentosDeHoy('2026-11-02', '2026-10-26')).toEqual([]);
  });
});
