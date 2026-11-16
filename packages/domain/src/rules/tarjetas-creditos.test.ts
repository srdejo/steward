// Escenarios de los specs de tarjetas-y-creditos (steward-tarjetas y steward-cuentas), con el reloj en el dia de los
// artboards: hoy es 26 oct 2026.
import { describe, expect, it } from 'vitest';
import { crearSemilla, DANIEL } from '../demo/seed';
import type { Credito, MesRef } from '../model';
import {
  ReglaError, actualizarSaldoCredito, agregarCredito, agregarTarjeta, borrarRegistro, cambiarMetodoCredito, crearMes, cuotaFija, editarTarjeta, emDeEa,
  fechasTarjetas, itemsEnlazables, marcarPago, planDe, quitarTarjeta, resumenCreditos, resumenMes, tablaCredito, vistaCredito, vistaTarjetas,
} from '.';

const HOY = '2026-10-26';
const OCT: MesRef = { anio: 2026, mes: 10 };
const NOV: MesRef = { anio: 2026, mes: 11 };
const semilla = () => crearSemilla(HOY);
const credito = (s: ReturnType<typeof semilla>, id: string) => s.creditos.find((c) => c.id === id)!;

describe('Tarjetas (steward-tarjetas)', () => {
  it('fechas de Nu: próximo pago en rojo, próximo corte y la ayuda', () => {
    const nu = vistaTarjetas(semilla(), HOY).tarjetas.find((t) => t.tarjeta.nombre === 'Nu')!;
    expect(nu.proximoPago).toEqual({ fecha: '2026-10-28', dias: 2, tono: 'alerta' });
    expect(nu.proximoCorte.fecha).toBe('2026-11-13');
    expect(nu.ayuda).toBe('Lo que compres hasta el 13 nov se paga el 28 nov. Desde el 14 nov, el 28 dic.');
    expect(nu.linea).toBe('Tarjeta Nu · Mercado');
  });

  it('Visa paga al mes siguiente de su corte', () => {
    const visa = vistaTarjetas(semilla(), HOY).tarjetas.find((t) => t.tarjeta.nombre === 'Visa')!;
    expect(visa.proximoPago).toEqual({ fecha: '2026-11-06', dias: 11, tono: 'normal' });
    expect(visa.ayuda).toBe('Lo que compres hasta el 21 nov se paga el 6 dic. Desde el 22 nov, el 6 ene.');
  });

  it('pago fijo avisa de los intereses; un día 31 en noviembre es el 30', () => {
    const v = vistaTarjetas(semilla(), HOY);
    const mc = v.tarjetas.find((t) => t.tarjeta.nombre === 'Mastercard')!;
    expect(mc.aviso).toBe(true);
    expect(mc.ayuda).toBe('No se paga completa: el saldo que queda genera intereses.');
    const t31 = { id: 't31', nombre: 'Falabella', diaCorte: 31, diaPago: 15, uso: '', pago: { tipo: 'COMPLETA' as const, estimado: 0 } };
    expect(fechasTarjetas([t31], '2026-11-01').find((f) => f.tipo === 'CORTE')!.fecha).toBe('2026-11-30');
  });

  it('por pagar este ciclo, próximas fechas y aviso en la pestaña', () => {
    const v = vistaTarjetas(semilla(), HOY);
    expect(v.porPagarCiclo).toBe(2_620_000);
    expect(v.pagoPronto).toEqual({ nombre: 'Nu', dias: 2 });
    expect(v.fechas.slice(0, 4).map((f) => [f.fecha, f.que])).toEqual([
      ['2026-10-28', 'Pagar Nu · Mercado'], ['2026-10-30', 'Pagar Mastercard'], ['2026-11-06', 'Pagar Visa · Gasolina'], ['2026-11-13', 'Corte Nu'],
    ]);
    expect(v.fechas.find((f) => f.que === 'Corte Nu')!.cuando).toBe('Mejor día para una compra grande: 14 nov');
    expect(v.fechas.every((f) => f.fecha >= HOY && f.fecha < '2026-11-30')).toBe(true);
  });

  it('agregar una tarjeta: su línea entra al mes en curso; datos inválidos no se guardan', () => {
    const s = agregarTarjeta(semilla(), { nombre: 'Éxito', diaCorte: 15, diaPago: 30, uso: 'Ropa', pago: { tipo: 'FIJO', monto: 200_000 }, fecha: HOY });
    const linea = planDe(s, OCT)!.escenarios[0]!.items.find((i) => i.nombre === 'Tarjeta Éxito · Ropa')!;
    expect(linea).toMatchObject({ monto: 200_000, diaVence: 30, categoriaId: 'cat-tarjetas', tarjetaId: s.tarjetas.at(-1)!.id });
    expect(() => agregarTarjeta(semilla(), { nombre: 'X', diaCorte: 32, diaPago: 1, uso: '', pago: { tipo: 'COMPLETA', estimado: 0 }, fecha: HOY })).toThrow(ReglaError);
    expect(() => agregarTarjeta(semilla(), { nombre: 'X', diaCorte: 1, diaPago: 1, uso: '', pago: { tipo: 'FIJO', monto: 0 }, fecha: HOY })).toThrow(ReglaError);
  });

  it('si su día de pago ya pasó este mes, la línea empieza el mes siguiente', () => {
    const s = agregarTarjeta(semilla(), { nombre: 'RappiCard', diaCorte: 19, diaPago: 5, uso: 'Gasolina', pago: { tipo: 'COMPLETA', estimado: 500_000 }, fecha: HOY });
    expect(planDe(s, OCT)!.escenarios[0]!.items.some((i) => i.nombre === 'Tarjeta RappiCard · Gasolina')).toBe(false);
    const dic = crearMes(s, { ref: { anio: 2026, mes: 12 }, modo: 'COPIAR', creadoPor: DANIEL });
    expect(planDe(dic, { anio: 2026, mes: 12 })!.escenarios[0]!.items.find((i) => i.nombre === 'Tarjeta RappiCard · Gasolina')).toMatchObject({ monto: 500_000, diaVence: 5 });
  });

  it('pago fijo en el plan del mes nuevo, y completa sigue al último extracto', () => {
    let s = marcarPago(semilla(), { itemId: 'm0-mercado', ref: OCT, monto: 352_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: '2026-10-28', creadoPor: DANIEL });
    s = crearMes(s, { ref: { anio: 2026, mes: 12 }, modo: 'COPIAR', creadoPor: DANIEL });
    const dic = planDe(s, { anio: 2026, mes: 12 })!.escenarios[0]!.items;
    expect(dic.find((i) => i.nombre === 'Tarjeta Mastercard')).toMatchObject({ monto: 1_500_000, diaVence: 30 });
    expect(dic.find((i) => i.nombre === 'Tarjeta Nu · Mercado')!.monto).toBe(352_000);
    expect(dic.filter((i) => i.tarjetaId === 'tar-nu')).toHaveLength(1);
  });

  it('enlazar un ítem que ya existe en lugar de crear otro', () => {
    const base = semilla();
    // Sin la tarjeta Mastercard: su item queda como un gasto suelto de Creditos.
    const sin = quitarTarjeta(base, 'tar-mastercard');
    expect(itemsEnlazables(sin, HOY).map((i) => i.nombre)).toEqual(['Tarjeta Mastercard']);
    const s = agregarTarjeta(sin, { nombre: 'Mastercard', diaCorte: 15, diaPago: 30, uso: '', pago: { tipo: 'FIJO', monto: 1_500_000 }, itemId: 'm0-mastercard', fecha: HOY });
    const items = planDe(s, OCT)!.escenarios[0]!.items.filter((i) => i.nombre === 'Tarjeta Mastercard');
    expect(items).toHaveLength(1);
    expect(items[0]!.tarjetaId).toBe(s.tarjetas.at(-1)!.id);
  });

  it('editar el pago fijo cambia los meses en Borrador, no el activo', () => {
    const s = editarTarjeta(semilla(), { id: 'tar-mastercard', nombre: 'Mastercard', diaCorte: 15, diaPago: 30, uso: '', pago: { tipo: 'FIJO', monto: 1_800_000 } });
    expect(planDe(s, NOV)!.escenarios[0]!.items.find((i) => i.tarjetaId === 'tar-mastercard')!.monto).toBe(1_800_000);
    expect(planDe(s, OCT)!.escenarios[0]!.items.find((i) => i.tarjetaId === 'tar-mastercard')!.monto).toBe(1_500_000);
  });

  it('quitar una tarjeta no borra sus pagos', () => {
    const pagado = marcarPago(semilla(), { itemId: 'm0-mercado', ref: OCT, monto: 320_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });
    const s = quitarTarjeta(pagado, 'tar-nu');
    expect(s.tarjetas.map((t) => t.nombre)).toEqual(['Mastercard', 'Visa']);
    expect(resumenMes(s, OCT, HOY).yaPagado.find((i) => i.item.id === 'm0-mercado')!.real).toBe(320_000);
  });
});

describe('Créditos por método (steward-cuentas)', () => {
  it('12 % EA es 0,95 % EM', () => {
    expect(emDeEa(12)).toBe(0.95);
  });

  it('plan de pagos de $5.000.000 a 24 cuotas al 24 % EA: la tabla paga todo el capital', () => {
    const em = emDeEa(24);
    const s = agregarCredito(semilla(), { metodo: 'PLAN', nombre: 'Moto', entidad: '', diaPago: 5, valorFinanciado: 5_000_000, numeroCuotas: 24, tasaEM: em, cuotasPagadas: 0, saldo: 0, cuota: 0, totalOriginal: 0, fecha: HOY });
    const c = s.creditos.at(-1)!;
    expect(c.cuota).toBe(cuotaFija(5_000_000, 24, em));
    const tabla = tablaCredito(c, 100);
    expect(tabla).toHaveLength(24);
    expect(tabla.reduce((t, f) => t + f.capital, 0)).toBe(5_000_000);
    expect(tabla.at(-1)!.saldo).toBe(0);
  });

  it('agregar con plan de pagos sin intereses: cuota $375.000 y cuota 4 de 12', () => {
    const s = agregarCredito(semilla(), { metodo: 'PLAN', nombre: 'Nevera', entidad: 'Almacén', diaPago: 20, valorFinanciado: 4_500_000, numeroCuotas: 12, tasaEM: 0, cuotasPagadas: 3, saldo: 0, cuota: 0, totalOriginal: 0, fecha: HOY });
    const v = vistaCredito(s.creditos.at(-1)!, HOY);
    expect([v.credito.cuota, v.credito.saldo]).toEqual([375_000, 3_375_000]);
    expect(v.progreso).toEqual({ actual: 4, total: 12 });
  });

  it('pagar la cuota del plan de pagos y borrar ese pago', () => {
    const s = marcarPago(semilla(), { itemId: 'm0-cuotas', ref: OCT, monto: 375_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });
    expect(credito(s, 'cred-cuotas')).toMatchObject({ saldo: 3_000_000, cuotasPagadas: 4 });
    expect(vistaCredito(credito(s, 'cred-cuotas'), HOY).progreso).toEqual({ actual: 5, total: 12 });
    const pago = s.movimientos.at(-1)!;
    const borrado = borrarRegistro(s, { movimientoId: pago.id });
    expect(credito(borrado, 'cred-cuotas')).toMatchObject({ saldo: 3_375_000, cuotasPagadas: 3 });
  });

  it('a mano: pagar no cambia el saldo y recuerda actualizarlo', () => {
    let s = cambiarMetodoCredito(semilla(), { creditoId: 'cred-libre', metodo: 'MANUAL', saldo: 14_250_000, cuota: 500_000, tasaEM: 0, fecha: '2026-10-05' });
    s = { ...s, creditos: s.creditos.map((c) => (c.id === 'cred-libre' ? { ...c, diaPago: 10, pagos: [], saldoActualizadoEn: '2026-10-05' } : c)) };
    expect(vistaCredito(credito(s, 'cred-libre'), HOY).actualizar).toBe(true);
    const item = planDe(s, OCT)!.escenarios[0]!.items.find((i) => i.creditoId === 'cred-libre')!;
    const sinPago = { ...s, movimientos: s.movimientos.filter((m) => m.itemId !== item.id) };
    const pagado = marcarPago(sinPago, { itemId: item.id, ref: OCT, monto: 500_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });
    expect(credito(pagado, 'cred-libre').saldo).toBe(14_250_000);
    const corregido = actualizarSaldoCredito(s, { creditoId: 'cred-libre', saldo: 14_000_000, fecha: HOY });
    expect(vistaCredito(credito(corregido, 'cred-libre'), HOY).actualizar).toBe(false);
  });

  it('próxima cuota con la tasa y corregir con extracto', () => {
    const v = vistaCredito(credito(semilla(), 'cred-libre'), HOY);
    expect(v.proxima).toMatchObject({ capital: 272_000, interes: 228_000, saldo: 13_978_000, ref: NOV });
    expect(v.progreso).toEqual({ actual: 23, total: 60 });
    expect(v.proximas).toHaveLength(6);
    const s = actualizarSaldoCredito(semilla(), { creditoId: 'cred-libre', saldo: 13_900_000, fecha: HOY });
    const c: Credito = credito(s, 'cred-libre');
    expect(vistaCredito(c, HOY).proxima!.interes).toBe(Math.round(13_900_000 * 0.016));
  });
});

describe('Proyección de créditos (steward-cuentas)', () => {
  it('los datos de prueba', () => {
    const r = resumenCreditos(semilla(), HOY);
    expect(r.deben).toBe(17_625_000);
    expect(r.pagan).toBe(875_000);
    const cuotas = r.creditos.find((v) => v.credito.id === 'cred-cuotas')!;
    const libre = r.creditos.find((v) => v.credito.id === 'cred-libre')!;
    expect(cuotas.proyeccion.slice(0, 2)).toEqual([3_000_000, 2_625_000]);
    expect(libre.proyeccion.slice(0, 2)).toEqual([14_250_000, 13_978_000]);
    expect(r.totales[0]).toBe(17_250_000);
    expect(r.deberanAlCerrar).toBe(r.totales[2]);
    expect(r.bajaAlCerrar).toBe(r.deben - r.deberanAlCerrar);
    expect(cuotas.termina).toEqual({ anio: 2027, mes: 6 });
    expect(r.interesesAnioSiguiente).toBe(libre.interesesAnioSiguiente);
    expect(r.interesesAnioSiguiente).toBeGreaterThan(0);
  });

  it('un crédito que termina vale $0 después', () => {
    const s = actualizarSaldoCredito(semilla(), { creditoId: 'cred-libre', saldo: 300_000, fecha: HOY });
    const v = vistaCredito(credito(s, 'cred-libre'), HOY);
    expect(v.proyeccion.slice(0, 3)).toEqual([300_000, 0, 0]);
    expect(v.termina).toEqual(NOV);
  });
});
