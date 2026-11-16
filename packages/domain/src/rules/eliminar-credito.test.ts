// "Eliminar un crédito" (spec steward-cuentas, credito-escritorio-y-eliminar), con el reloj en el 26 oct 2026.
import { describe, expect, it } from 'vitest';
import { crearSemilla } from '../demo/seed';
import type { EstadoHogar, MesRef } from '../model';
import { ReglaError, eliminarCredito, planDe, resumenCreditos, vistaCredito } from '.';

const HOY = '2026-10-26';
const SEP: MesRef = { anio: 2026, mes: 9 };
const OCT: MesRef = { anio: 2026, mes: 10 };
const NOV: MesRef = { anio: 2026, mes: 11 };
const semilla = () => crearSemilla(HOY);

const items = (s: EstadoHogar, ref: MesRef) => planDe(s, ref)!.escenarios.flatMap((e) => e.items);

describe('eliminarCredito', () => {
  it('la compra a cuotas sale de Créditos y de los planes abiertos', () => {
    const antes = resumenCreditos(semilla(), HOY).deben;
    const s = eliminarCredito(semilla(), { creditoId: 'cred-cuotas', fecha: HOY });
    expect(s.creditos.map((c) => c.id)).toEqual(['cred-libre']);
    expect(resumenCreditos(s, HOY).deben).toBe(antes - 3_375_000);
    expect(items(s, OCT).some((i) => i.nombre === 'Compra a cuotas')).toBe(false);
    expect(items(s, NOV).some((i) => i.nombre === 'Compra a cuotas')).toBe(false);
    // Septiembre esta cerrado: su item se queda, sin enlace.
    expect(items(s, SEP).filter((i) => i.nombre === 'Compra a cuotas').map((i) => i.creditoId)).toEqual([null]);
  });

  it('Libre inversión: la cuota pagada de octubre se queda con su pago; noviembre pierde la cuota y el abono de la C', () => {
    const s = eliminarCredito(semilla(), { creditoId: 'cred-libre', fecha: HOY });
    const octubre = items(s, OCT).find((i) => i.id === 'm0-cuota-credito')!;
    expect(octubre.creditoId).toBeNull();
    expect(s.movimientos.some((m) => m.itemId === 'm0-cuota-credito' && m.tipo === 'PAGO')).toBe(true);
    expect(items(s, NOV).some((i) => i.nombre === 'Cuota libre inversión' || i.id === 'm1c-abono')).toBe(false);
    expect(s.movimientos.every((m) => m.creditoId !== 'cred-libre')).toBe(true);
  });

  it('un crédito que no existe', () => {
    expect(() => eliminarCredito(semilla(), { creditoId: 'nada', fecha: HOY })).toThrow(ReglaError);
  });
});

describe('vistaCredito con los pagos', () => {
  it('cada pago dice de qué cuenta salió', () => {
    const s = semilla();
    const v = vistaCredito(s.creditos.find((c) => c.id === 'cred-libre')!, HOY, s);
    expect(v.pagos.map((p) => [p.fecha, p.tipo, p.desde])).toEqual([['2026-10-15', 'CUOTA', 'Davivienda'], ['2026-09-15', 'CUOTA', null]]);
  });
});
