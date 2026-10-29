// Cada test reproduce las cifras de un escenario de los specs del cambio presupuesto-hogar-ui
// (reloj fijo en el dia de los artboards). Son la especificacion ejecutable para el backend.
import { describe, expect, it } from 'vitest';
import { crearHogarVacio, crearSemilla, DANIEL, ESPOSA } from '../demo/seed';
import type { EstadoHogar, MesRef } from '../model';
import {
  ReglaError, aceptarInvitacion, agregarCredito, actualizarSaldoCredito, agregarEvento, compararOpciones, crearMes, crearMesesDesdeAnual, cuadrarCuentas, cuentasDelHogar,
  cerrarMes, definirDiezmoEnHoy, diferenciaCuadre, duplicarEscenario, entregarDiezmo, guardarCategoria, invitar, loQueTraeElMes,
  marcarPago, marcarRecibido, planDe, planInicio, previsualizarDiezmo, previsualizarGasto, probarAbonoComoOpcion, registrarAporte,
  registrarGasto, repartoValido, resumenAnual, resumenMes, simularAbono, cuotasRestantes, porcentajePagado, usarEscenario,
  vistaCierre, vistasOpciones, opciones,
} from '.';

const HOY = '2026-10-26';
const OCT: MesRef = { anio: 2026, mes: 10 };
const NOV: MesRef = { anio: 2026, mes: 11 };
const DIC: MesRef = { anio: 2026, mes: 12 };
const semilla = () => crearSemilla(HOY);

function sinDiezmoNiSalario(estado: EstadoHogar): EstadoHogar {
  // Octubre antes de recibir el salario, para probar "Recibí".
  return { ...estado, movimientos: estado.movimientos.filter((m) => m.tipo !== 'INGRESO_FIJO') };
}

describe('Hoy (steward-hoy)', () => {
  it('muestra los totales de los datos de ejemplo', () => {
    const r = resumenMes(semilla(), OCT, HOY);
    expect(r.libre).toBe(3_436_000);
    expect(r.plan).toBe(5_390_000);
    expect(r.pagado).toBe(2_613_000);
    expect(r.vsPlan).toBe(-62_000);
    expect(r.porPagar.map((i) => i.item.nombre)).toEqual(['Compra a cuotas', 'Tarjeta Mastercard', 'Mercado']);
    expect(r.porPagar.find((i) => i.item.nombre === 'Tarjeta Mastercard')?.detalle).toBe('Vence en 4 días');
    expect(r.porPagar.find((i) => i.item.nombre === 'Compra a cuotas')?.detalle).toBe('Vence día 20 · cuota 4 de 12');
  });

  it('agrupa los aportes por persona con su conteo', () => {
    const r = resumenMes(semilla(), OCT, HOY);
    const esposa = r.ingresos.find((l) => l.nombre === 'Aportes Esposa');
    expect(esposa).toMatchObject({ monto: 2_538_000, detalle: '2 aportes · 1 pago directo' });
    expect(r.ingresos.find((l) => l.nombre === 'Salario Daniel')).toMatchObject({ monto: 6_288_000, detalle: 'Fijo · recibido 25 oct', recibido: true });
  });

  it('muestra plan vs real en un pago', () => {
    const luz = resumenMes(semilla(), OCT, HOY).yaPagado.find((i) => i.item.nombre === 'Recibo Luz')!;
    expect(luz.real).toBe(38_000);
    expect(luz.detalle).toBe('plan $50.000 · −$12.000');
    expect(luz.pagadoPor).toBe(ESPOSA);
    const pension = resumenMes(semilla(), OCT, HOY).yaPagado.find((i) => i.item.nombre === 'Pensión')!;
    expect(pension.detalle).toBe('igual al plan · Davivienda');
  });

  it('variable acumulado contra su presupuesto', () => {
    const mercado = resumenMes(semilla(), OCT, HOY).porPagar.find((i) => i.item.nombre === 'Mercado')!;
    expect(mercado.detalle).toBe('Variable · llevas $180.000 de $320.000');
    expect(mercado.pendiente).toBe(140_000);
  });

  it('genera el diezmo al recibir el salario y lo cierra con Entregado', () => {
    let s = sinDiezmoNiSalario(semilla());
    expect(resumenMes(s, OCT, HOY).diezmo.pendientes).toHaveLength(0);
    s = marcarRecibido(s, { ingresoFijoId: 'ing-salario', ref: OCT, fecha: '2026-10-25', creadoPor: DANIEL });
    const pendientes = resumenMes(s, OCT, HOY).diezmo.pendientes;
    expect(pendientes).toEqual([expect.objectContaining({ monto: 700_000, detalle: '10% de Salario Daniel · recibido 25 oct' })]);
    s = entregarDiezmo(s, { obligaciones: [pendientes[0]!.id], ref: OCT, fecha: HOY, usuarioId: DANIEL, cuentaId: 'cta-davivienda' });
    expect(resumenMes(s, OCT, HOY).diezmo.pendientes).toHaveLength(0);
    expect(s.movimientos.at(-1)).toMatchObject({ tipo: 'DIEZMO_ENTREGADO', monto: 700_000 });
  });

  it('un aporte para el mes siguiente no cambia el libre de este mes', () => {
    const antes = resumenMes(semilla(), OCT, HOY).libre;
    const s = registrarAporte(semilla(), { usuarioId: ESPOSA, monto: 500_000, ref: NOV, cuentaId: null, aplicaDiezmo: false, fecha: HOY, creadoPor: ESPOSA });
    expect(resumenMes(s, OCT, HOY).libre).toBe(antes);
    const a = vistasOpciones(s, NOV)[0]!;
    expect(a.ingresos.find((l) => l.nombre === 'Aporte Esposa')?.monto).toBe(2_500_000);
  });

  it('pago directo desde "Su cuenta" cuenta como aporte implicito', () => {
    const s = marcarPago(semilla(), { itemId: 'm0-mastercard', ref: OCT, monto: 1_500_000, usuarioId: ESPOSA, origen: { tipo: 'EXTERNA' }, fecha: HOY, creadoPor: ESPOSA });
    const r = resumenMes(s, OCT, HOY);
    expect(r.yaPagado.find((i) => i.item.nombre === 'Tarjeta Mastercard')?.pagadoPor).toBe(ESPOSA);
    expect(r.ingresos.find((l) => l.nombre === 'Aportes Esposa')).toMatchObject({ monto: 4_038_000, detalle: '2 aportes · 2 pagos directos' });
  });

  it('no deja pagar dos veces un fijo', () => {
    try {
      marcarPago(semilla(), { itemId: 'm0-luz', ref: OCT, monto: 38_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ReglaError);
      expect((e as ReglaError).message).toBe('Ya lo pagó Esposa el 12 oct');
    }
  });

  it('gasto variable acumula y gasto no planeado resta del libre', () => {
    let s = registrarGasto(semilla(), { monto: 40_000, itemId: 'm0-mercado', nota: '', usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, ref: OCT, fecha: HOY, creadoPor: DANIEL });
    expect(resumenMes(s, OCT, HOY).porPagar.find((i) => i.item.nombre === 'Mercado')?.detalle).toBe('Variable · llevas $220.000 de $320.000');
    expect(previsualizarGasto(semilla(), OCT, 'm0-mercado', 64_000, HOY)).toEqual({ llevado: 244_000, presupuesto: 320_000 });
    s = registrarGasto(s, { monto: 85_000, itemId: null, nota: 'Farmacia', usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, ref: OCT, fecha: HOY, creadoPor: DANIEL });
    const r = resumenMes(s, OCT, HOY);
    expect(r.libre).toBe(3_436_000 - 85_000);
    expect(r.pagado).toBe(2_613_000 + 40_000 + 85_000);
  });

  it('agrupa el diezmo cuando el ajuste es Agrupado (steward-ajustes)', () => {
    let s = registrarAporte(semilla(), { usuarioId: DANIEL, monto: 2_000_000, ref: OCT, cuentaId: null, aplicaDiezmo: true, fecha: HOY, creadoPor: DANIEL });
    s = definirDiezmoEnHoy(s, 'AGRUPADO');
    const pendientes = resumenMes(s, OCT, HOY).diezmo.pendientes;
    expect(pendientes.map((p) => p.monto)).toEqual([700_000, 200_000]);
    expect(s.hogar.diezmoEnHoy).toBe('AGRUPADO');
  });
});

describe('Planear (steward-planear)', () => {
  it('planear inicio con los estados de los meses', () => {
    const { proximos, recientes } = planInicio(semilla(), HOY);
    expect(proximos.map((p) => p.detalle)).toEqual(['Borrador · 3 opciones', 'Sin plan', 'Saldrá del plan anual']);
    expect(proximos[2]!.libre).toEqual([598_000]);
    expect(recientes.map((p) => p.detalle)).toEqual(['Activo · Opción A', 'Cerrado · sobró $1.840.000', 'Cerrado · sobró $2.110.000']);
  });

  it('mes sin plan: copiar el anterior y lo que ya trae', () => {
    expect(loQueTraeElMes(semilla(), DIC)).toEqual([
      { nombre: 'Prima', detalle: '', monto: 3_500_000 },
      { nombre: 'Diezmo de la prima', detalle: '', monto: -350_000 },
      { nombre: 'Sobrante de noviembre', detalle: 'al cerrar noviembre', monto: null },
    ]);
    const s = crearMes(semilla(), { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL });
    const dic = planDe(s, DIC)!;
    expect(dic.estado).toBe('BORRADOR');
    expect(opciones(dic).map((o) => o.letra)).toEqual(['A']);
    expect(dic.escenarios[0]!.items.find((i) => i.nombre === 'Compra a cuotas')?.cuota).toEqual({ actual: 6, total: 12 });
    const fijos = crearMes(semilla(), { ref: DIC, modo: 'FIJOS', creadoPor: DANIEL });
    expect(planDe(fijos, DIC)!.escenarios[0]!.items.filter((i) => i.tipo === 'VARIABLE').every((i) => i.monto === 0)).toBe(true);
    // Desde cero trae solo la cuota del credito con saldo (backend-cuentas-creditos D5).
    expect(planDe(crearMes(semilla(), { ref: DIC, modo: 'CERO', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items.map((i) => [i.nombre, i.creditoId])).toEqual([
      ['Cuota libre inversión', 'cred-libre'],
    ]);
  });

  it('crear el mes con creditos: sin duplicar la cuota, y sin la de un credito pagado', () => {
    const copiar = planDe(crearMes(semilla(), { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items;
    expect(copiar.filter((i) => i.creditoId === 'cred-libre').map((i) => i.nombre)).toEqual(['Cuota libre inversión']);
    const pagado = actualizarSaldoCredito(semilla(), { creditoId: 'cred-libre', saldo: 0, fecha: HOY });
    expect(planDe(crearMes(pagado, { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items.some((i) => i.creditoId)).toBe(false);
    expect(planDe(crearMes(pagado, { ref: DIC, modo: 'CERO', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items).toEqual([]);
  });

  it('opciones de noviembre: libre antes y despues del cierre de octubre, diezmo calculado', () => {
    const vistas = vistasOpciones(semilla(), NOV);
    expect(vistas.map((v) => v.libre)).toEqual([2_898_000, 1_298_000, 1_398_000]);
    expect(vistas[0]!.diezmo).toEqual({ monto: 700_000, detalle: 'Calculado · 10% de Salario Daniel' });
    expect(vistas[1]!.inicialAutor).toBe('E');
  });

  it('duplicar crea la Opcion D del usuario actual', () => {
    const s = duplicarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', creadoPor: ESPOSA });
    const d = opciones(planDe(s, NOV)!).at(-1)!;
    expect(d.letra).toBe('D');
    expect(d.creadoPor).toBe(ESPOSA);
    expect(d.items.map((i) => i.monto)).toEqual(planDe(s, NOV)!.escenarios[0]!.items.map((i) => i.monto));
  });

  it('usar una opcion archiva las demas', () => {
    const s = usarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a' });
    const nov = planDe(s, NOV)!;
    expect(nov.escenarioActivoId).toBe('plan-m1-a');
    expect(nov.escenarios.filter((e) => e.archivado).map((e) => e.letra)).toEqual(['B', 'C']);
  });

  it('comparar resalta solo lo que cambia', () => {
    const c = compararOpciones(semilla(), NOV);
    expect(c.letras).toEqual(['A', 'B', 'C']);
    expect(c.filas.map((f) => [f.nombre, f.nota, f.valores])).toEqual([
      ['Variables', 'B suma regalos de Navidad', [720_000, 1_320_000, 720_000]],
      ['Créditos', 'C suma abono extra crédito', [500_000, 500_000, 2_000_000]],
      ['Ahorro', 'Solo en B', [null, 1_000_000, null]],
    ]);
    expect(c.sinCambios).toMatchObject({ nota: 'Gastos fijos, Tarjetas y cuotas, diezmo', valores: [4_170_000, 4_170_000, 4_170_000] });
  });

  it('plan anual: KPI del diseño y eventos', () => {
    const r = resumenAnual(semilla(), 2027)!;
    expect(r.kpis).toEqual({ libreAnio: 28_996_000, mesApretado: { mes: 1, libre: 598_000 }, diezmoAnio: 9_100_000 });
    expect(r.libre).toEqual([598, 2398, 1498, 1198, 2398, 5548, 2398, 898, 2398, 2398, 2398, 4868].map((v) => v * 1000));
    const s = agregarEvento(semilla(), { anio: 2027, evento: { nombre: 'SOAT moto', mes: 3, monto: 1_200_000, tipo: 'GASTO', usuarioId: null } });
    const r2 = resumenAnual(s, 2027)!;
    expect(r2.libre[2]).toBe(1_498_000 - 1_200_000);
    expect(r2.kpis.libreAnio).toBe(28_996_000 - 1_200_000);
  });

  it('crear meses desde el plan anual no se ata despues', () => {
    const s = crearMesesDesdeAnual(semilla(), { anio: 2027, creadoPor: DANIEL });
    const ene = vistasOpciones(s, { anio: 2027, mes: 1 })[0]!;
    expect(ene.escenario.letra).toBe('A');
    expect(ene.libre).toBe(598_000);
    expect(resumenAnual(s, 2027)!.estado).toBe('CREADO');
  });
});

describe('Cuentas (steward-cuentas)', () => {
  it('filtro por titular y aviso de cuenta sin cuadrar', () => {
    const { cuentas, total } = cuentasDelHogar(semilla(), HOY);
    expect(total).toBe(9_130_000);
    expect(cuentasDelHogar(semilla(), HOY, ESPOSA).cuentas.map((c) => c.cuenta.nombre)).toEqual(['Ahorros Esposa']);
    expect(cuentas.find((c) => c.cuenta.nombre === 'Ahorros Esposa')).toMatchObject({ aviso: true, estadoCuadre: 'sin cuadrar desde 20 sep', estimado: true });
    expect(cuentas.find((c) => c.cuenta.nombre === 'Nu')?.estadoCuadre).toBe('cuadrada hoy');
  });

  it('cuadrar guarda la diferencia como ajuste y el cierre la cuenta en Sin registrar', () => {
    expect(diferenciaCuadre(semilla(), 'cta-davivienda', 3_980_000) + diferenciaCuadre(semilla(), 'cta-efectivo', 150_000)).toBe(220_000);
    const s = cuadrarCuentas(semilla(), { saldos: [{ cuentaId: 'cta-davivienda', saldoBanco: 3_980_000 }, { cuentaId: 'cta-efectivo', saldoBanco: 150_000 }], fecha: HOY, usuarioId: DANIEL });
    const vistas = cuentasDelHogar(s, HOY).cuentas;
    expect(vistas.find((c) => c.cuenta.nombre === 'Davivienda')).toMatchObject({ saldo: 3_980_000, estadoCuadre: 'cuadrada hoy' });
    expect(vistas.find((c) => c.cuenta.nombre === 'Ahorros Esposa')?.saldo).toBe(1_420_000);
    expect(s.movimientos.filter((m) => m.tipo === 'AJUSTE_CUADRE').map((m) => m.monto)).toEqual([170_000, 50_000]);
    expect(vistaCierre(s, OCT).sinRegistrar).toBe(220_000);
    expect(cuentasDelHogar(s, HOY).total).toBe(8_910_000);
  });

  it('el saldo estimado sigue los movimientos despues del cuadre', () => {
    const s = marcarPago(semilla(), { itemId: 'm0-mastercard', ref: OCT, monto: 1_500_000, usuarioId: DANIEL, origen: { tipo: 'CUENTA', cuentaId: 'cta-davivienda' }, fecha: HOY, creadoPor: DANIEL });
    expect(cuentasDelHogar(s, HOY).cuentas.find((c) => c.cuenta.nombre === 'Davivienda')).toMatchObject({ saldo: 2_650_000, estimado: true });
  });

  it('credito: cuotas restantes y simulador de abono', () => {
    const c = semilla().creditos[0]!;
    expect(cuotasRestantes(c)).toBe(38);
    expect(porcentajePagado(c)).toBe(37);
    expect(simularAbono(c, 1_500_000)).toEqual({ cuotasMenos: 5, interesesMenos: 1_200_000 });
    const s2 = simularAbono(c, 2_000_000)!;
    expect(s2.cuotasMenos).toBeGreaterThan(5);
  });

  it('agregar credito: su cuota entra a la opcion principal del mes en curso', () => {
    const datos = { nombre: 'Moto', entidad: 'Bancolombia', saldo: 14_250_000, totalOriginal: 20_000_000, cuota: 500_000, tasaEM: 1.6, diaPago: 15, fecha: HOY };
    const s = agregarCredito(semilla(), datos);
    const credito = s.creditos.find((c) => c.nombre === 'Moto')!;
    expect(credito).toMatchObject({ entidad: 'Bancolombia', saldo: 14_250_000, saldoActualizadoEn: HOY, pagos: [] });
    expect(porcentajePagado(credito)).toBe(29);
    const oct = planDe(s, OCT)!;
    const principal = oct.escenarios.find((e) => e.id === oct.escenarioActivoId)!;
    expect(principal.items.find((i) => i.creditoId === credito.id)).toMatchObject({ nombre: 'Cuota moto', monto: 500_000, diaVence: 15, tipo: 'CREDITO', categoriaId: 'cat-creditos' });
    // Sin plan en el mes en curso no se crea ninguno.
    const enero = agregarCredito(semilla(), { ...datos, fecha: '2027-01-10' });
    expect(enero.planes.length).toBe(semilla().planes.length);
    expect(() => agregarCredito(semilla(), { ...datos, totalOriginal: 10_000_000 })).toThrow(ReglaError);
    expect(() => agregarCredito(semilla(), { ...datos, cuota: 0 })).toThrow(ReglaError);
    expect(() => agregarCredito(semilla(), { ...datos, nombre: ' ' })).toThrow(ReglaError);
    expect(() => agregarCredito(semilla(), { ...datos, diaPago: 32 })).toThrow(ReglaError);
  });

  it('agregar credito con el mes cerrado no toca el plan', () => {
    const base = semilla();
    const cerrado = { ...base, planes: base.planes.map((p) => (p.ref.mes === 10 ? { ...p, estado: 'CERRADO' as const } : p)) };
    const s = agregarCredito(cerrado, { nombre: 'Moto', entidad: '', saldo: 1_000_000, totalOriginal: 1_000_000, cuota: 100_000, tasaEM: 0, diaPago: 5, fecha: HOY });
    expect(planDe(s, OCT)!.escenarios.flatMap((e) => e.items).some((i) => i.nombre === 'Cuota moto')).toBe(false);
  });

  it('probarlo como opcion crea un escenario con el abono', () => {
    const r = probarAbonoComoOpcion(semilla(), { creditoId: 'cred-libre', ref: NOV, abono: 1_500_000, creadoPor: DANIEL });
    const nueva = opciones(planDe(r.estado, NOV)!).find((e) => e.id === r.escenarioId)!;
    expect(nueva.letra).toBe('D');
    expect(nueva.items.find((i) => i.nombre === 'Abono extra libre inversión')?.monto).toBe(1_500_000);
  });
});

describe('Cierre (steward-planear)', () => {
  function octubreTerminado(): EstadoHogar {
    let s = semilla();
    const pagar = (itemId: string, monto: number) => {
      s = marcarPago(s, { itemId, ref: OCT, monto, usuarioId: DANIEL, origen: { tipo: 'CUENTA', cuentaId: 'cta-davivienda' }, fecha: '2026-10-30', creadoPor: DANIEL });
    };
    pagar('m0-mastercard', 1_500_000);
    pagar('m0-cuotas', 375_000);
    s = registrarGasto(s, { monto: 140_000, itemId: 'm0-mercado', nota: '', usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, ref: OCT, fecha: '2026-10-30', creadoPor: DANIEL });
    s = registrarGasto(s, { monto: 112_000, itemId: null, nota: 'Farmacia', usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, ref: OCT, fecha: '2026-10-30', creadoPor: DANIEL });
    const obligacion = resumenMes(s, OCT, HOY).diezmo.pendientes[0]!;
    s = entregarDiezmo(s, { obligaciones: [obligacion.id], ref: OCT, fecha: '2026-10-30', usuarioId: DANIEL, cuentaId: null });
    // Cuadrar en Efectivo y Nu (sin pagos de este escenario) da $220.000 sin registrar.
    s = cuadrarCuentas(s, { saldos: [{ cuentaId: 'cta-nu', saldoBanco: 3_190_000 }, { cuentaId: 'cta-efectivo', saldoBanco: 150_000 }], fecha: '2026-10-31', usuarioId: DANIEL });
    return s;
  }

  it('octubre termina con $3.166.000 y lo pasado aparece en noviembre', () => {
    const s0 = octubreTerminado();
    const v = vistaCierre(s0, OCT);
    expect(v.sinRegistrar).toBe(220_000);
    expect(v.sobrante).toBe(3_166_000);
    expect(v.librePlaneado).toBe(2_898_000);
    expect(v.filas[0]).toEqual({ nombre: 'Ingresos', plan: 8_288_000, real: 8_826_000 });
    expect(repartoValido(v.sobrante, 2_000_000, 1_000_000)).toBe(false);
    const s = cerrarMes(s0, { ref: OCT, aAhorro: 2_000_000, aSiguiente: 1_166_000, cerradoPor: DANIEL, fecha: '2026-10-31' });
    expect(planDe(s, OCT)!.estado).toBe('CERRADO');
    expect(vistasOpciones(s, NOV)[0]!.ingresos.find((l) => l.tipo === 'SOBRANTE')).toMatchObject({ nombre: 'Sobrante de octubre', monto: 1_166_000 });
    expect(vistasOpciones(s, NOV).map((o) => o.libre)).toEqual([4_064_000, 2_464_000, 2_564_000]);
    // Solo lectura: nada se registra en un mes cerrado.
    expect(() => registrarGasto(s, { monto: 1_000, itemId: null, nota: '', usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, ref: OCT, fecha: HOY, creadoPor: DANIEL })).toThrow('El mes está cerrado');
    expect(() => registrarAporte(s, { usuarioId: ESPOSA, monto: 1_000, ref: OCT, cuentaId: null, aplicaDiezmo: false, fecha: HOY, creadoPor: ESPOSA })).toThrow('El mes está cerrado');
    expect(() => cerrarMes(s0, { ref: OCT, aAhorro: 2_000_000, aSiguiente: 1_000_000, cerradoPor: DANIEL, fecha: HOY })).toThrow('El reparto debe sumar lo que sobró');
  });
});

describe('Acceso y hogar (steward-acceso-onboarding, steward-ajustes)', () => {
  it('vista previa del diezmo del onboarding', () => {
    expect(previsualizarDiezmo({ activa: true, porcentaje: 10, base: 'BRUTO' }, 7_000_000, 6_288_000)).toBe(700_000);
    expect(previsualizarDiezmo({ activa: false, porcentaje: 10, base: 'BRUTO' }, 7_000_000, 6_288_000)).toBeNull();
  });

  it('invitar deja pendiente y unirse agrega al miembro', () => {
    let s = crearHogarVacio();
    s = { ...s, hogar: { ...s.hogar, nombre: 'Nuestra casa', configurado: true } };
    s = invitar(s, { email: 'esposa@ejemplo.com', creadaPor: DANIEL, fecha: HOY, token: 'tok-1' });
    expect(s.hogar.invitaciones[0]).toMatchObject({ estado: 'PENDIENTE', expiraEn: '2026-11-02' });
    const r = aceptarInvitacion(s, { token: 'tok-1', nombre: 'Ana', diezmoAportes: false, fecha: HOY });
    expect(r.estado.hogar.miembros).toHaveLength(2);
    expect(() => aceptarInvitacion(r.estado, { token: 'tok-1', nombre: 'Ana', diezmoAportes: false, fecha: HOY })).toThrow('La invitación ya se usó o venció');
    expect(() => aceptarInvitacion(s, { token: 'tok-1', nombre: 'Ana', diezmoAportes: false, fecha: '2026-11-10' })).toThrow();
  });

  it('categorias: nueva y el diezmo no es categoria', () => {
    const s = guardarCategoria(semilla(), { nombre: 'Educación' });
    expect(s.categorias.map((c) => c.nombre)).toContain('Educación');
    expect(() => guardarCategoria(semilla(), { nombre: 'Diezmo' })).toThrow();
  });
});
