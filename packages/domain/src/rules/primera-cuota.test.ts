// "Primera cuota de un crédito" (spec steward-cuentas, credito-primera-cuota), con el reloj en el 26 oct 2026.
import { describe, expect, it } from 'vitest';
import { DANIEL, crearSemilla } from '../demo/seed';
import type { EstadoHogar, MesRef } from '../model';
import { agregarCredito, cambiarMetodoCredito, crearMes, crearMesesDesdeAnual, pagaEnMes, planDe, vistaCredito } from '.';

const HOY = '2026-10-26';
const OCT: MesRef = { anio: 2026, mes: 10 };
const NOV: MesRef = { anio: 2026, mes: 11 };
const DIC: MesRef = { anio: 2026, mes: 12 };
const ENE: MesRef = { anio: 2027, mes: 1 };
const FEB: MesRef = { anio: 2027, mes: 2 };

/** "Johana": $192.000.000, cuota $2.000.000, sin intereses, dia 1, con la primera cuota que se pida. */
function conJohana(primeraCuota?: MesRef | null): EstadoHogar {
  return agregarCredito(crearSemilla(HOY), {
    nombre: 'Johana', entidad: 'Johana', metodo: 'TASA', saldo: 192_000_000, totalOriginal: 192_000_000, cuota: 2_000_000,
    tasaEM: 0, diaPago: 1, fecha: HOY, primeraCuota,
  });
}
const johana = (s: EstadoHogar) => s.creditos.find((c) => c.nombre === 'Johana')!;
const tieneCuota = (s: EstadoHogar, ref: MesRef) => planDe(s, ref)!.escenarios.some((e) => e.items.some((i) => i.nombre === 'Cuota johana'));

describe('primera cuota de un crédito', () => {
  it('el detalle empieza en la primera cuota y termina un mes después', () => {
    const v = vistaCredito(johana(conJohana(DIC)), HOY);
    expect(v.proxima!.ref).toEqual(DIC);
    expect(v.proximas.map((q) => q.ref.mes)).toEqual([12, 1, 2, 3, 4, 5]);
    expect(v.proyeccion.slice(0, 3)).toEqual([192_000_000, 192_000_000, 190_000_000]);
    expect(v.termina).toEqual({ anio: 2034, mes: 11 });
  });

  it('sin primera cuota, como antes: la próxima es la del mes en curso', () => {
    const v = vistaCredito(johana(conJohana()), HOY);
    expect(v.proxima!.ref).toEqual(OCT);
    expect(v.termina).toEqual({ anio: 2034, mes: 9 });
    expect(johana(conJohana()).primeraCuota).toBeNull();
  });

  it('al agregarlo, el mes en curso no trae la cuota si la primera es después', () => {
    expect(tieneCuota(conJohana(DIC), OCT)).toBe(false);
    expect(tieneCuota(conJohana(), OCT)).toBe(true);
    // El mes en curso se guarda como sin primera cuota.
    const s = conJohana(OCT);
    expect(johana(s).primeraCuota).toBeNull();
    expect(tieneCuota(s, OCT)).toBe(true);
  });

  it('pagaEnMes: no antes de la primera cuota', () => {
    const c = johana(conJohana(DIC));
    expect(pagaEnMes(c, NOV, HOY)).toBe(false);
    expect(pagaEnMes(c, DIC, HOY)).toBe(true);
    // Desde el mes de la primera cuota, el campo ya no influye.
    expect(pagaEnMes(c, DIC, '2026-12-05')).toBe(true);
    expect(vistaCredito(c, '2027-01-10').proxima!.ref).toEqual(ENE);
  });

  it('crear un mes: el crédito que empieza después no trae su cuota', () => {
    const conEnero = crearMes(conJohana(ENE), { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL });
    expect(tieneCuota(conEnero, DIC)).toBe(false);
    const conDic = crearMes(conJohana(DIC), { ref: DIC, modo: 'CERO', creadoPor: DANIEL });
    expect(tieneCuota(conDic, DIC)).toBe(true);
  });

  it('el plan anual empieza en la primera cuota', () => {
    const s = crearMesesDesdeAnual(conJohana(FEB), { anio: 2027, creadoPor: DANIEL, hoy: HOY });
    expect(tieneCuota(s, ENE)).toBe(false);
    expect(tieneCuota(s, FEB)).toBe(true);
  });

  it('fuera de rango: antes del mes en curso o a más de 12 meses', () => {
    expect(() => conJohana({ anio: 2026, mes: 9 })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
    expect(() => conJohana({ anio: 2027, mes: 11 })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
    expect(johana(conJohana({ anio: 2027, mes: 10 })).primeraCuota).toEqual({ anio: 2027, mes: 10 });
  });

  it('cambiar el método: sin el campo la conserva; con el mes en curso la quita', () => {
    const s = conJohana();
    const id = johana(s).id;
    const base = { creditoId: id, metodo: 'TASA' as const, saldo: 192_000_000, cuota: 2_000_000, tasaEM: 0, fecha: HOY };
    const conDic = cambiarMetodoCredito(s, { ...base, primeraCuota: DIC });
    expect(johana(conDic).primeraCuota).toEqual(DIC);
    expect(johana(conDic).saldo).toBe(192_000_000);
    expect(vistaCredito(johana(conDic), HOY).proxima!.ref).toEqual(DIC);
    expect(johana(cambiarMetodoCredito(conDic, base)).primeraCuota).toEqual(DIC);
    expect(johana(cambiarMetodoCredito(conDic, { ...base, primeraCuota: OCT })).primeraCuota).toBeNull();
  });
});
