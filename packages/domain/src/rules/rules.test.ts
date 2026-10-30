// Cada test reproduce las cifras de un escenario de los specs del cambio presupuesto-hogar-ui
// (reloj fijo en el dia de los artboards). Son la especificacion ejecutable para el backend.
import { describe, expect, it } from 'vitest';
import { crearHogarVacio, crearSemilla, DANIEL, ESPOSA } from '../demo/seed';
import type { EstadoHogar, MesRef } from '../model';
import {
  ReglaError, aceptarInvitacion, quitarEscenario, crearAnual, editarProyeccion, editarMontoAnual, agregarCredito, actualizarSaldoCredito, agregarEvento, compararOpciones, crearMes, crearMesesDesdeAnual, cuadrarCuentas, cuentasDelHogar,
  borrarPlan, borrarRegistro, conteoBorrado, corregirRegistro, empezarDeNuevo, movimientosDeCuenta, quitarItem, recalcularDiezmo,
  cerrarMes, diferenciaCuadre, duplicarEscenario, guardarCategoria, guardarIngresoFijo, guardarIngresoPlan, guardarItem, guardarRegla, invitar, loQueTraeElMes, quitarIngresoPlan,
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
    expect(r.porPagar.map((i) => i.item.nombre)).toEqual(['Compra a cuotas', 'Diezmo · Salario Daniel', 'Tarjeta Mastercard', 'Mercado']);
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

  it('recibir no crea obligacion: el diezmo sigue como item por pagar (diezmo-como-gasto)', () => {
    let s = sinDiezmoNiSalario(semilla());
    s = marcarRecibido(s, { lineaId: 'm0-ing-salario', ref: OCT, fecha: '2026-10-25', creadoPor: DANIEL });
    const r = resumenMes(s, OCT, HOY);
    expect(r.ingresos.find((l) => l.nombre === 'Salario Daniel')).toMatchObject({ monto: 6_288_000, recibido: true, detalle: 'Fijo · recibido 25 oct' });
    expect(s.movimientos.at(-1)).toMatchObject({ tipo: 'INGRESO_FIJO', ingresoPlanId: 'm0-ing-salario', ingresoFijoId: 'ing-salario', bruto: 7_000_000 });
    expect(r.porPagar.find((i) => i.item.tipo === 'DIEZMO')).toMatchObject({ plan: 700_000 });
    expect(() => marcarRecibido(s, { lineaId: 'm0-ing-salario', ref: OCT, fecha: HOY, creadoPor: DANIEL })).toThrow(expect.objectContaining({ codigo: 'YA_RECIBIDO' }));
  });

  it('llevar el diezmo: pasa a Ya pagado y el libre no cambia', () => {
    const antes = resumenMes(semilla(), OCT, HOY);
    expect(antes.plan).toBe(5_390_000);
    const s = marcarPago(semilla(), { itemId: 'm0-diezmo-salario', ref: OCT, monto: 700_000, usuarioId: DANIEL, origen: { tipo: 'CUENTA', cuentaId: 'cta-davivienda' }, fecha: HOY, creadoPor: DANIEL });
    const r = resumenMes(s, OCT, HOY);
    expect(r.yaPagado.find((i) => i.item.nombre === 'Diezmo · Salario Daniel')).toMatchObject({ real: 700_000, pagadoPor: DANIEL });
    expect(r.pagado).toBe(antes.pagado + 700_000);
    expect(r.libre).toBe(antes.libre);
    expect(cuentasDelHogar(s, HOY).cuentas.find((c) => c.cuenta.nombre === 'Davivienda')!.saldo).toBe(cuentasDelHogar(semilla(), HOY).cuentas.find((c) => c.cuenta.nombre === 'Davivienda')!.saldo - 700_000);
  });

  it('recibir con otro monto: la linea queda con lo que llego y el plan no cambia', () => {
    let s = sinDiezmoNiSalario(semilla());
    const antes = resumenMes(s, OCT, HOY).libre;
    s = marcarRecibido(s, { lineaId: 'm0-ing-salario', ref: OCT, fecha: '2026-10-25', creadoPor: DANIEL, monto: 6_350_000 });
    expect(resumenMes(s, OCT, HOY).ingresos.find((l) => l.lineaId === 'm0-ing-salario')).toMatchObject({ monto: 6_350_000, recibido: true });
    expect(resumenMes(s, OCT, HOY).libre).toBe(antes + 62_000);
    expect(planDe(s, OCT)!.escenarios[0]!.ingresos[0]!.monto).toBe(6_288_000);
    expect(() => marcarRecibido(s, { lineaId: 'nada', ref: OCT, fecha: HOY, creadoPor: DANIEL })).toThrow(expect.objectContaining({ codigo: 'NO_EXISTE' }));
  });

  it('un ingreso editado en el plan cuenta asi en Hoy, y uno agregado a mano se recibe', () => {
    const base = sinDiezmoNiSalario(semilla());
    let s = guardarIngresoPlan(base, { planId: 'plan-m0', escenarioId: 'plan-m0-a', ingreso: { id: 'm0-ing-salario', nombre: 'Salario Daniel', monto: 6_500_000, usuarioId: DANIEL, tipo: 'FIJO', ingresoFijoId: 'ing-salario', bruto: 7_000_000 } });
    expect(resumenMes(s, OCT, HOY).libre).toBe(resumenMes(base, OCT, HOY).libre + 212_000);
    s = guardarIngresoPlan(s, { planId: 'plan-m0', escenarioId: 'plan-m0-a', ingreso: { nombre: 'Venta bicicleta', monto: 400_000, usuarioId: null, tipo: 'OTRO', ingresoFijoId: null, bruto: 400_000 } });
    const linea = planDe(s, OCT)!.escenarios[0]!.ingresos.find((l) => l.nombre === 'Venta bicicleta')!;
    expect(resumenMes(s, OCT, HOY).ingresos.find((l) => l.lineaId === linea.id)).toMatchObject({ detalle: 'Por recibir', recibido: false });
    s = marcarRecibido(s, { lineaId: linea.id, ref: OCT, fecha: HOY, creadoPor: DANIEL });
    expect(s.movimientos.at(-1)).toMatchObject({ tipo: 'INGRESO_FIJO', monto: 400_000, ingresoPlanId: linea.id, ingresoFijoId: null, origen: { tipo: 'NINGUNO' } });
    expect(() => quitarIngresoPlan(s, { planId: 'plan-m0', escenarioId: 'plan-m0-a', ingresoId: linea.id })).toThrow(expect.objectContaining({ codigo: 'INGRESO_RECIBIDO' }));
  });

  it('una entrega de diezmo de antes cuenta como gasto sin item (historia)', () => {
    const base = semilla();
    const entrega = { ...base.movimientos[0]!, id: 'viejo', seq: 999, tipo: 'DIEZMO_ENTREGADO' as const, monto: 300_000, origen: { tipo: 'NINGUNO' as const } };
    const s = { ...base, movimientos: [...base.movimientos, entrega] };
    const r = resumenMes(s, OCT, HOY);
    expect(r.pagado).toBe(2_613_000 + 300_000);
    expect(r.libre).toBe(3_436_000 - 300_000);
    expect(vistaCierre(s, OCT).filas.find((f) => f.nombre === 'No estaba planeado')?.real).toBe(300_000);
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

  it('aporte con diezmo: su item en la opcion en uso, y el libre sube lo que queda', () => {
    const antes = resumenMes(semilla(), OCT, HOY).libre;
    const s = registrarAporte(semilla(), { usuarioId: DANIEL, monto: 2_000_000, ref: OCT, cuentaId: null, aplicaDiezmo: true, fecha: HOY, creadoPor: DANIEL });
    const r = resumenMes(s, OCT, HOY);
    const item = r.porPagar.find((i) => i.item.nombre === 'Diezmo · aporte 26 oct')!;
    expect(item.item).toMatchObject({ monto: 200_000, tipo: 'DIEZMO', categoriaId: 'cat-diezmo', aporteId: s.movimientos.at(-1)!.id });
    expect(r.libre).toBe(antes + 1_800_000);
  });

  it('aporte con diezmo a un mes sin plan: el item llega al crearlo', () => {
    let s = registrarAporte(semilla(), { usuarioId: DANIEL, monto: 1_000_000, ref: DIC, cuentaId: null, aplicaDiezmo: true, fecha: HOY, creadoPor: DANIEL });
    s = crearMes(s, { ref: DIC, modo: 'CERO', creadoPor: DANIEL });
    const diezmos = planDe(s, DIC)!.escenarios[0]!.items.filter((i) => i.tipo === 'DIEZMO');
    expect(diezmos.map((i) => [i.nombre, i.monto])).toEqual([['Diezmo · Salario Daniel', 700_000], ['Diezmo · Prima', 350_000], ['Diezmo · aporte 26 oct', 100_000]]);
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
    // Desde cero trae, ademas de los diezmos, solo la cuota del credito con saldo (backend-cuentas-creditos D5).
    expect(planDe(crearMes(semilla(), { ref: DIC, modo: 'CERO', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items.filter((i) => i.tipo !== 'DIEZMO').map((i) => [i.nombre, i.creditoId])).toEqual([
      ['Cuota libre inversión', 'cred-libre'],
    ]);
  });

  it('crear el mes con creditos: sin duplicar la cuota, y sin la de un credito pagado', () => {
    const copiar = planDe(crearMes(semilla(), { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items;
    expect(copiar.filter((i) => i.creditoId === 'cred-libre').map((i) => i.nombre)).toEqual(['Cuota libre inversión']);
    const pagado = actualizarSaldoCredito(semilla(), { creditoId: 'cred-libre', saldo: 0, fecha: HOY });
    expect(planDe(crearMes(pagado, { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items.some((i) => i.creditoId)).toBe(false);
    expect(planDe(crearMes(pagado, { ref: DIC, modo: 'CERO', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items.filter((i) => i.tipo !== 'DIEZMO')).toEqual([]);
  });

  it('opciones de noviembre: libre antes y despues del cierre de octubre, diezmo como categoria', () => {
    const vistas = vistasOpciones(semilla(), NOV);
    expect(vistas.map((v) => v.libre)).toEqual([2_898_000, 1_298_000, 1_398_000]);
    expect(vistas[0]!.grupos[0]).toMatchObject({ nombre: 'Diezmo', total: 700_000 });
    expect(vistas[0]!.ingresos.find((l) => l.tipo === 'FIJO')).toMatchObject({ nombre: 'Salario Daniel', monto: 6_288_000, detalle: 'Fijo', lineaId: 'm1-ing-salario' });
    expect(vistas[1]!.inicialAutor).toBe('E');
  });

  it('duplicar crea la Opcion D del usuario actual', () => {
    const s = duplicarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', creadoPor: ESPOSA, hoy: HOY });
    const d = opciones(planDe(s, NOV)!).at(-1)!;
    expect(d.letra).toBe('D');
    expect(d.creadoPor).toBe(ESPOSA);
    expect(d.items.map((i) => i.monto)).toEqual(planDe(s, NOV)!.escenarios[0]!.items.map((i) => i.monto));
  });

  it('usar una opcion archiva las demas', () => {
    const s = usarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', hoy: HOY });
    const nov = planDe(s, NOV)!;
    expect(nov.escenarioActivoId).toBe('plan-m1-a');
    expect(nov.escenarios.filter((e) => e.archivado).map((e) => e.letra)).toEqual(['B', 'C']);
  });

  it('varias opciones solo en Borrador (backend-opciones-mes D1)', () => {
    // Octubre es el mes en curso con la Opcion A en uso: Activo.
    const octubre = planDe(semilla(), OCT)!;
    const conB = { ...semilla(), planes: semilla().planes.map((p) => (p.id === octubre.id ? { ...p, escenarios: [...p.escenarios, { ...p.escenarios[0]!, id: 'oct-b', letra: 'B', archivado: true }] } : p)) };
    expect(() => duplicarEscenario(semilla(), { planId: octubre.id, escenarioId: octubre.escenarioActivoId!, creadoPor: DANIEL, hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'MES_NO_BORRADOR', message: 'Octubre ya está en curso; su plan no gana opciones' }));
    expect(() => probarAbonoComoOpcion(semilla(), { creditoId: 'cred-libre', ref: OCT, abono: 1, creadoPor: DANIEL, hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'MES_NO_BORRADOR' }));
    expect(() => usarEscenario(conB, { planId: octubre.id, escenarioId: 'oct-b', hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'MES_NO_BORRADOR' }));
    // Volver a elegir la que esta en uso no cambia nada.
    expect(planDe(usarEscenario(conB, { planId: octubre.id, escenarioId: octubre.escenarioActivoId!, hoy: HOY }), OCT)!.escenarioActivoId).toBe(octubre.escenarioActivoId);
    expect(() => quitarEscenario(conB, { planId: octubre.id, escenarioId: 'oct-b', hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'MES_NO_BORRADOR' }));
    // Cerrado.
    const cerrado = { ...semilla(), planes: semilla().planes.map((p) => (p.id === 'plan-m1' ? { ...p, estado: 'CERRADO' as const } : p)) };
    expect(() => duplicarEscenario(cerrado, { planId: 'plan-m1', escenarioId: 'plan-m1-a', creadoPor: DANIEL, hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'MES_CERRADO' }));
  });

  it('el mes en curso sin opcion elegida: no se cambia a otra si la principal ya tiene pagos', () => {
    const base = semilla();
    const octubre = planDe(base, OCT)!;
    // Sin los pagos de la semilla: el unico pago es el de abajo.
    const sinElegir = { ...base, movimientos: base.movimientos.filter((m) => m.itemId === null), planes: base.planes.map((p) => (p.id === octubre.id ? { ...p, estado: 'BORRADOR' as const, escenarioActivoId: null, escenarios: [...p.escenarios, { ...p.escenarios[0]!, id: 'oct-b', letra: 'B', items: [] }] } : p)) };
    const pagado = marcarPago(sinElegir, { itemId: 'm0-mastercard', ref: OCT, monto: 1_500_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });
    expect(() => usarEscenario(pagado, { planId: octubre.id, escenarioId: 'oct-b', hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'MES_NO_BORRADOR' }));
    expect(planDe(usarEscenario(sinElegir, { planId: octubre.id, escenarioId: 'oct-b', hoy: HOY }), OCT)!.escenarioActivoId).toBe('oct-b');
    expect(() => quitarEscenario(pagado, { planId: octubre.id, escenarioId: octubre.escenarios[0]!.id, hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'OPCION_CON_PAGOS' }));
  });

  it('quitar una opcion: libera su letra; no la ultima ni la que esta en uso (backend-opciones-mes D5)', () => {
    const s = quitarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-c', hoy: HOY });
    expect(opciones(planDe(s, NOV)!).map((o) => o.letra)).toEqual(['A', 'B']);
    const otra = duplicarEscenario(s, { planId: 'plan-m1', escenarioId: 'plan-m1-a', creadoPor: ESPOSA, hoy: HOY });
    expect(opciones(planDe(otra, NOV)!).map((o) => o.letra)).toEqual(['A', 'B', 'C']);
    const soloA = quitarEscenario(s, { planId: 'plan-m1', escenarioId: 'plan-m1-b', hoy: HOY });
    expect(() => quitarEscenario(soloA, { planId: 'plan-m1', escenarioId: 'plan-m1-a', hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'ULTIMA_OPCION' }));
    const enUso = usarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-b', hoy: HOY });
    expect(() => quitarEscenario(enUso, { planId: 'plan-m1', escenarioId: 'plan-m1-b', hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'OPCION_EN_USO' }));
  });

  it('comparar resalta solo lo que cambia', () => {
    const c = compararOpciones(semilla(), NOV);
    expect(c.letras).toEqual(['A', 'B', 'C']);
    expect(c.filas.map((f) => [f.nombre, f.nota, f.valores])).toEqual([
      ['Variables', 'B suma regalos de Navidad', [720_000, 1_320_000, 720_000]],
      ['Créditos', 'C suma abono extra crédito', [500_000, 500_000, 2_000_000]],
      ['Ahorro', 'Solo en B', [null, 1_000_000, null]],
    ]);
    expect(c.sinCambios).toMatchObject({ nota: 'Diezmo, Gastos fijos, Tarjetas y cuotas', valores: [4_170_000, 4_170_000, 4_170_000] });
  });

  it('diezmo editable y otro salario en una opcion, sin tocar las demas ni Ajustes', () => {
    let s = guardarItem(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', item: { ...planDe(semilla(), NOV)!.escenarios[0]!.items.find((i) => i.tipo === 'DIEZMO')!, monto: 750_000 } });
    expect(vistasOpciones(s, NOV)[0]!.libre).toBe(2_898_000 - 50_000);
    expect(planDe(s, NOV)!.escenarios[0]!.items.find((i) => i.tipo === 'DIEZMO')).toMatchObject({ monto: 750_000, ingresoFijoId: 'ing-salario' });
    s = guardarIngresoPlan(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-b', ingreso: { id: 'm1b-ing-salario', nombre: 'Salario Daniel', monto: 7_000_000, usuarioId: DANIEL, tipo: 'FIJO', ingresoFijoId: 'ing-salario', bruto: 7_000_000 } });
    expect(vistasOpciones(s, NOV).map((v) => v.libre)).toEqual([2_898_000, 1_298_000 + 712_000, 1_398_000]);
    expect(s.ingresosFijos[0]!.neto).toBe(6_288_000);
    s = guardarIngresoPlan(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingreso: { nombre: 'Venta bicicleta', monto: 400_000, usuarioId: null, tipo: 'OTRO', ingresoFijoId: null, bruto: 400_000 } });
    expect(vistasOpciones(s, NOV)[0]!.libre).toBe(2_898_000 + 400_000);
    expect(() => guardarIngresoPlan(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingreso: { nombre: ' ', monto: 1, usuarioId: null, tipo: 'OTRO', ingresoFijoId: null, bruto: 1 } })).toThrow(ReglaError);
  });

  it('items de diezmo al crear el mes: uno por ingreso, sin regla sin item, y no se copia el editado', () => {
    let s = guardarIngresoFijo(semilla(), { usuarioId: ESPOSA, nombre: 'Salario Esposa', bruto: 3_500_000, neto: 3_000_000, diaPago: 30, cuentaId: null, activo: true });
    // Sin regla, sin item.
    expect(planDe(crearMes(s, { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL }), DIC)!.escenarios[0]!.items.filter((i) => i.tipo === 'DIEZMO').map((i) => i.nombre)).toEqual(['Diezmo · Salario Daniel', 'Diezmo · Prima']);
    s = guardarRegla(s, { usuarioId: ESPOSA, activa: true, porcentaje: 10, base: 'NETO', aplicaAportes: false });
    // Noviembre tiene el diezmo editado a $750.000: diciembre no lo copia.
    s = guardarItem(s, { planId: 'plan-m1', escenarioId: 'plan-m1-a', item: { ...planDe(s, NOV)!.escenarios[0]!.items.find((i) => i.tipo === 'DIEZMO')!, monto: 750_000 } });
    const dic = planDe(crearMes(s, { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL }), DIC)!.escenarios[0]!;
    expect(dic.items.filter((i) => i.tipo === 'DIEZMO').map((i) => [i.nombre, i.monto, i.ingresoFijoId, i.categoriaId])).toEqual([
      ['Diezmo · Salario Daniel', 700_000, 'ing-salario', 'cat-diezmo'],
      ['Diezmo · Salario Esposa', 300_000, s.ingresosFijos[1]!.id, 'cat-diezmo'],
      ['Diezmo · Prima', 350_000, null, 'cat-diezmo'],
    ]);
    expect(dic.ingresos.map((l) => [l.nombre, l.monto, l.tipo])).toEqual([['Salario Daniel', 6_288_000, 'FIJO'], ['Salario Esposa', 3_000_000, 'FIJO'], ['Prima', 3_500_000, 'EXTRA']]);
  });

  it('un ingreso fijo nuevo entra al mes en curso con su diezmo', () => {
    const s = guardarIngresoFijo(semilla(), { usuarioId: DANIEL, nombre: 'Prima', bruto: 1_000_000, neto: 1_000_000, diaPago: 30, cuentaId: null, activo: true }, HOY);
    const r = resumenMes(s, OCT, HOY);
    expect(r.ingresos.find((l) => l.nombre === 'Prima')).toMatchObject({ detalle: 'Fijo · llega el día 30', recibido: false, monto: 1_000_000 });
    expect(r.porPagar.find((i) => i.item.nombre === 'Diezmo · Prima')?.plan).toBe(100_000);
    // Noviembre (Borrador) no cambia, ni un mes sin plan; sin fecha (onboarding) tampoco.
    expect(planDe(s, NOV)!.escenarios[0]!.ingresos.map((l) => l.nombre)).toEqual(['Salario Daniel']);
    expect(planDe(guardarIngresoFijo(semilla(), { usuarioId: DANIEL, nombre: 'Prima', bruto: 1, neto: 1, diaPago: 30, cuentaId: null, activo: true }), OCT)!.escenarios[0]!.ingresos).toHaveLength(1);
  });

  it('ingresos al crear el mes: los de Ajustes de nuevo, los agregados a mano se copian; duplicar copia todo', () => {
    let s = guardarIngresoPlan(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingreso: { id: 'm1-ing-salario', nombre: 'Salario Daniel', monto: 6_500_000, usuarioId: DANIEL, tipo: 'FIJO', ingresoFijoId: 'ing-salario', bruto: 7_000_000 } });
    s = guardarIngresoPlan(s, { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingreso: { nombre: 'Venta bicicleta', monto: 400_000, usuarioId: null, tipo: 'OTRO', ingresoFijoId: null, bruto: 400_000 } });
    s = usarEscenario(s, { planId: 'plan-m1', escenarioId: 'plan-m1-a', hoy: HOY });
    const dic = planDe(crearMes(s, { ref: DIC, modo: 'COPIAR', creadoPor: DANIEL }), DIC)!.escenarios[0]!;
    expect(dic.ingresos.map((l) => [l.nombre, l.monto])).toEqual([['Salario Daniel', 6_288_000], ['Prima', 3_500_000], ['Venta bicicleta', 400_000]]);
    expect(planDe(crearMes(s, { ref: DIC, modo: 'CERO', creadoPor: DANIEL }), DIC)!.escenarios[0]!.ingresos.map((l) => l.nombre)).toEqual(['Salario Daniel', 'Prima']);
    const b = duplicarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-b', creadoPor: ESPOSA, hoy: HOY });
    const d = opciones(planDe(b, NOV)!).at(-1)!;
    expect(d.ingresos.map((l) => [l.nombre, l.monto])).toEqual([['Salario Daniel', 6_288_000]]);
    expect(d.ingresos[0]!.id).not.toBe('m1b-ing-salario');
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

  it('crear el plan anual vacio y llenarlo (backend-plan-anual D1)', () => {
    expect(() => crearAnual(semilla(), { anio: 2025, hoy: HOY })).toThrow(ReglaError);
    expect(() => crearAnual(semilla(), { anio: 2027, hoy: HOY })).toThrow(expect.objectContaining({ codigo: 'YA_EXISTE' }));
    const s = crearAnual(semilla(), { anio: 2028, hoy: HOY });
    const r = resumenAnual(s, 2028)!;
    expect(r.gastos.map((g) => [g.nombre, g.valores.every((v) => v === 0)])).toEqual([
      ['Gastos fijos', true], ['Tarjetas y cuotas', true], ['Variables', true], ['Créditos', true], ['Ahorro', true],
    ]);
    expect(r.ingresos.filter((f) => f.tenue).map((f) => f.nombre)).toEqual(['Aportes Daniel', 'Aportes Esposa']);
    const fijos = editarMontoAnual(s, { anio: 2028, categoriaId: 'cat-fijos', mes: 1, monto: 800_000 });
    expect(resumenAnual(fijos, 2028)!.gastos[0]!.valores[0]).toBe(800_000);
  });

  it('aporte proyectado por persona: tenue, y en 0 se quita', () => {
    const s = editarProyeccion(semilla(), { usuarioId: DANIEL, ref: { anio: 2027, mes: 1 }, monto: 1_000_000 });
    const r = resumenAnual(s, 2027)!;
    expect(r.ingresos.find((f) => f.nombre === 'Aportes Daniel')!.valores[0]).toBe(1_000_000);
    expect(r.libre[0]).toBe(598_000 + 1_000_000);
    const sin = editarProyeccion(s, { usuarioId: DANIEL, ref: { anio: 2027, mes: 1 }, monto: 0 });
    expect(sin.proyecciones.some((p) => p.usuarioId === DANIEL && p.ref.anio === 2027 && p.ref.mes === 1)).toBe(false);
    expect(() => editarProyeccion(semilla(), { usuarioId: 'nadie', ref: { anio: 2027, mes: 1 }, monto: 1 })).toThrow(ReglaError);
    expect(() => editarProyeccion(semilla(), { usuarioId: DANIEL, ref: { anio: 2030, mes: 1 }, monto: 1 })).toThrow(ReglaError);
  });

  it('crear meses desde el plan anual salta un mes cerrado sin plan', () => {
    const base = semilla();
    const conCierre = { ...base, cierres: [...base.cierres, { ref: { anio: 2027, mes: 2 }, filas: [], sinRegistrar: 0, sobrante: 0, aAhorro: 0, aSiguiente: 0, cerradoPor: DANIEL, cerradoEn: HOY }] };
    const s = crearMesesDesdeAnual(conCierre, { anio: 2027, creadoPor: DANIEL });
    expect(planDe(s, { anio: 2027, mes: 2 })).toBeNull();
    expect(planDe(s, { anio: 2027, mes: 3 })).not.toBeNull();
  });

  it('crear meses desde el anual: diezmo de la prima, lineas, y sin celdas de Diezmo', () => {
    const s = crearMesesDesdeAnual(semilla(), { anio: 2027, creadoPor: DANIEL });
    const jun = planDe(s, { anio: 2027, mes: 6 })!.escenarios[0]!;
    expect(jun.items.filter((i) => i.tipo === 'DIEZMO').map((i) => [i.nombre, i.monto])).toEqual([['Diezmo · Salario Daniel', 700_000], ['Diezmo · Prima', 350_000]]);
    expect(jun.ingresos.map((l) => [l.nombre, l.monto, l.tipo])).toEqual([['Salario Daniel', 6_288_000, 'FIJO'], ['Prima', 3_500_000, 'EXTRA']]);
    expect(resumenAnual(semilla(), 2027)!.gastos.map((g) => g.nombre)).not.toContain('Diezmo');
    expect(() => editarMontoAnual(semilla(), { anio: 2027, categoriaId: 'cat-diezmo', mes: 1, monto: 1 })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
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
    const r = probarAbonoComoOpcion(semilla(), { creditoId: 'cred-libre', ref: NOV, abono: 1_500_000, creadoPor: DANIEL, hoy: HOY });
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
    s = marcarPago(s, { itemId: 'm0-diezmo-salario', ref: OCT, monto: 700_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: '2026-10-30', creadoPor: DANIEL });
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
    expect(v.filas[1]).toEqual({ nombre: 'Diezmo', plan: 700_000, real: 700_000 });
    expect(v.filas.filter((f) => f.nombre === 'Diezmo')).toHaveLength(1);
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

describe('Usabilidad del plan (usabilidad-plan)', () => {
  const LINEA = (s: EstadoHogar, ref: MesRef, esc = 0) => planDe(s, ref)!.escenarios[esc]!.ingresos.find((l) => l.nombre === 'Salario Daniel')!;
  const DIEZMO = (s: EstadoHogar, ref: MesRef, esc = 0) => planDe(s, ref)!.escenarios[esc]!.items.find((i) => i.nombre === 'Diezmo · Salario Daniel')!;

  it('el diezmo sigue a su linea: cambiar el bruto lo recalcula', () => {
    const s = guardarIngresoPlan(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingreso: { ...LINEA(semilla(), NOV), bruto: 7_500_000 } });
    expect(DIEZMO(s, NOV)).toMatchObject({ monto: 750_000, ingresoPlanId: 'm1-ing-salario', ajustadoAMano: false });
  });

  it('diezmo ajustado a mano: no sigue a la linea hasta Volver a calcular', () => {
    let s = guardarItem(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', item: { ...DIEZMO(semilla(), NOV), monto: 600_000 } });
    expect(DIEZMO(s, NOV).ajustadoAMano).toBe(true);
    s = guardarIngresoPlan(s, { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingreso: { ...LINEA(s, NOV), bruto: 7_500_000 } });
    expect(DIEZMO(s, NOV).monto).toBe(600_000);
    s = recalcularDiezmo(s, { planId: 'plan-m1', escenarioId: 'plan-m1-a', itemId: DIEZMO(s, NOV).id });
    expect(DIEZMO(s, NOV)).toMatchObject({ monto: 750_000, ajustadoAMano: false });
  });

  it('un diezmo ya pagado no cambia', () => {
    let s = marcarPago(semilla(), { itemId: 'm0-diezmo-salario', ref: OCT, monto: 700_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });
    s = guardarIngresoPlan(s, { planId: 'plan-m0', escenarioId: 'plan-m0-a', ingreso: { ...LINEA(s, OCT), bruto: 8_000_000 } });
    expect(DIEZMO(s, OCT).monto).toBe(700_000);
  });

  it('ingreso agregado con Aplicar diezmo; quitarlo se lleva su diezmo', () => {
    let s = guardarIngresoPlan(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingreso: { nombre: 'Venta bicicleta', monto: 400_000, bruto: 400_000, usuarioId: DANIEL, tipo: 'OTRO', ingresoFijoId: null }, aplicarDiezmo: true });
    const linea = planDe(s, NOV)!.escenarios[0]!.ingresos.find((l) => l.nombre === 'Venta bicicleta')!;
    expect(planDe(s, NOV)!.escenarios[0]!.items.find((i) => i.ingresoPlanId === linea.id)).toMatchObject({ nombre: 'Diezmo · Venta bicicleta', monto: 40_000 });
    s = quitarIngresoPlan(s, { planId: 'plan-m1', escenarioId: 'plan-m1-a', ingresoId: linea.id });
    expect(planDe(s, NOV)!.escenarios[0]!.items.some((i) => i.ingresoPlanId === linea.id)).toBe(false);
  });

  it('duplicar enlaza el diezmo a la copia de su linea; crear el mes enlaza al nacer', () => {
    const s = duplicarEscenario(semilla(), { planId: 'plan-m1', escenarioId: 'plan-m1-a', creadoPor: DANIEL, hoy: HOY });
    const d = opciones(planDe(s, NOV)!).at(-1)!;
    expect(d.items.find((i) => i.tipo === 'DIEZMO')!.ingresoPlanId).toBe(d.ingresos[0]!.id);
    const dic = planDe(crearMes(semilla(), { ref: DIC, modo: 'CERO', creadoPor: DANIEL }), DIC)!.escenarios[0]!;
    const salario = dic.ingresos.find((l) => l.nombre === 'Salario Daniel')!;
    expect(dic.items.find((i) => i.nombre === 'Diezmo · Salario Daniel')!.ingresoPlanId).toBe(salario.id);
    expect(dic.items.find((i) => i.nombre === 'Diezmo · Prima')!.ingresoPlanId).toBe(dic.ingresos.find((l) => l.nombre === 'Prima')!.id);
  });

  it('aumento de salario en Ajustes: los meses abiertos lo siguen, salvo la linea cambiada a mano', () => {
    let s = sinDiezmoNiSalario(semilla());
    s = guardarIngresoPlan(s, { planId: 'plan-m1', escenarioId: 'plan-m1-b', ingreso: { ...LINEA(s, NOV, 1), monto: 6_000_000 } });
    s = guardarIngresoFijo(s, { ...s.ingresosFijos[0]!, neto: 6_500_000, bruto: 7_500_000 }, HOY);
    expect(LINEA(s, OCT)).toMatchObject({ monto: 6_500_000, bruto: 7_500_000 });
    expect(DIEZMO(s, OCT).monto).toBe(750_000);
    expect(LINEA(s, NOV)).toMatchObject({ monto: 6_500_000 });
    expect(LINEA(s, NOV, 1).monto).toBe(6_000_000);
    // Un mes cerrado no cambia.
    expect(planDe(s, { anio: 2026, mes: 9 })!.escenarios[0]!.ingresos[0]!.monto).toBe(6_288_000);
  });

  it('borrar un gasto equivocado, corregir un pago y deshacer un Recibi', () => {
    let s = registrarGasto(semilla(), { monto: 95_000, itemId: null, nota: 'Farmacia', usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, ref: OCT, fecha: HOY, creadoPor: DANIEL });
    const antes = resumenMes(semilla(), OCT, HOY);
    s = borrarRegistro(s, { movimientoId: s.movimientos.at(-1)!.id });
    expect(resumenMes(s, OCT, HOY)).toMatchObject({ pagado: antes.pagado, libre: antes.libre });
    // Internet: pagado $75.000 desde Davivienda; se corrige a $120.000.
    const internet = s.movimientos.find((m) => m.itemId === 'm0-internet')!;
    const davivienda = () => cuentasDelHogar(s, HOY).cuentas.find((c) => c.cuenta.nombre === 'Davivienda')!.saldo;
    const saldo = davivienda();
    s = corregirRegistro(s, { movimientoId: internet.id, monto: 120_000 });
    expect(resumenMes(s, OCT, HOY).yaPagado.find((i) => i.item.nombre === 'Internet')!.detalle).toContain('igual al plan');
    // Ya estaba en el cuadre de Davivienda (19 oct): su saldo no cambia.
    expect(davivienda()).toBe(saldo);
    const recibido = s.movimientos.find((m) => m.tipo === 'INGRESO_FIJO')!;
    s = borrarRegistro(s, { movimientoId: recibido.id });
    expect(resumenMes(s, OCT, HOY).ingresos.find((l) => l.nombre === 'Salario Daniel')!.recibido).toBe(false);
    expect(() => borrarRegistro(s, { movimientoId: 'nada' })).toThrow(expect.objectContaining({ codigo: 'NO_EXISTE' }));
  });

  it('corregir un pago despues del cuadre mueve el saldo de su cuenta', () => {
    let s = marcarPago(semilla(), { itemId: 'm0-mastercard', ref: OCT, monto: 1_600_000, usuarioId: DANIEL, origen: { tipo: 'CUENTA', cuentaId: 'cta-nu' }, fecha: HOY, creadoPor: DANIEL });
    const nu = () => cuentasDelHogar(s, HOY).cuentas.find((c) => c.cuenta.nombre === 'Nu')!.saldo;
    const antes = nu();
    s = corregirRegistro(s, { movimientoId: s.movimientos.at(-1)!.id, monto: 1_500_000 });
    expect(nu()).toBe(antes + 100_000);
    expect(movimientosDeCuenta(s, 'cta-nu')[0]).toMatchObject({ descripcion: 'Tarjeta Mastercard', efecto: -1_500_000, corregible: true });
  });

  it('borrar el pago de una cuota devuelve su capital; su monto no se corrige', () => {
    let s = sinDiezmoNiSalario(semilla());
    s = { ...s, movimientos: s.movimientos.filter((m) => m.itemId !== 'm0-cuota-credito') };
    const saldo = s.creditos[0]!.saldo;
    s = marcarPago(s, { itemId: 'm0-cuota-credito', ref: OCT, monto: 500_000, usuarioId: DANIEL, origen: { tipo: 'NINGUNO' }, fecha: HOY, creadoPor: DANIEL });
    const pago = s.movimientos.at(-1)!;
    expect(pago.capital).toBe(272_000);
    expect(() => corregirRegistro(s, { movimientoId: pago.id, monto: 400_000 })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
    s = borrarRegistro(s, { movimientoId: pago.id });
    expect(s.creditos[0]!.saldo).toBe(saldo);
    expect(resumenMes(s, OCT, HOY).porPagar.map((i) => i.item.nombre)).toContain('Cuota libre inversión');
  });

  it('borrar un aporte se lleva su diezmo sin pagos', () => {
    let s = registrarAporte(semilla(), { usuarioId: DANIEL, monto: 2_000_000, ref: OCT, cuentaId: null, aplicaDiezmo: true, fecha: HOY, creadoPor: DANIEL });
    const aporte = s.movimientos.at(-1)!;
    s = corregirRegistro(s, { movimientoId: aporte.id, monto: 3_000_000 });
    expect(planDe(s, OCT)!.escenarios[0]!.items.find((i) => i.aporteId === aporte.id)!.monto).toBe(300_000);
    s = borrarRegistro(s, { movimientoId: aporte.id });
    expect(planDe(s, OCT)!.escenarios[0]!.items.some((i) => i.aporteId === aporte.id)).toBe(false);
  });

  it('borrar el plan de un mes con pagos y de un mes cerrado', () => {
    const base = registrarAporte(semilla(), { usuarioId: ESPOSA, monto: 100_000, ref: OCT, cuentaId: null, aplicaDiezmo: false, fecha: HOY, creadoPor: ESPOSA });
    const conteo = conteoBorrado(base, OCT);
    expect(conteo).toEqual({ pagos: 7, gastos: 5, ingresos: 1, cerrado: false });
    const aportes = base.movimientos.filter((m) => m.tipo === 'APORTE' && m.ref.mes === 10).length;
    const saldoCredito = base.creditos[0]!.saldo;
    const s = borrarPlan(base, OCT);
    expect(planDe(s, OCT)).toBeNull();
    expect(s.movimientos.filter((m) => m.ref.mes === 10 && m.ref.anio === 2026).map((m) => m.tipo).every((t) => t === 'APORTE')).toBe(true);
    expect(s.movimientos.filter((m) => m.tipo === 'APORTE' && m.ref.mes === 10)).toHaveLength(aportes);
    // La cuota de la semilla no registro su capital: el saldo del credito no cambia.
    expect(s.creditos[0]!.saldo).toBe(saldoCredito);
    // Septiembre cerrado: se borra con su cierre.
    const sep = { anio: 2026, mes: 9 };
    expect(conteoBorrado(semilla(), sep).cerrado).toBe(true);
    expect(planDe(borrarPlan(semilla(), sep), sep)).toBeNull();
    expect(planInicio(borrarPlan(semilla(), sep), HOY).recientes[1]!.detalle).toBe('Sin plan');
    expect(() => borrarPlan(semilla(), DIC)).toThrow(expect.objectContaining({ codigo: 'NO_EXISTE' }));
  });

  it('empezar de nuevo conserva el saldo de las cuentas, los ingresos y las reglas', () => {
    const saldos = cuentasDelHogar(semilla(), HOY).cuentas.map((c) => [c.cuenta.nombre, c.saldo]);
    const s = empezarDeNuevo(semilla(), { fecha: HOY });
    expect(s.planes).toHaveLength(0);
    expect(s.movimientos).toHaveLength(0);
    expect(s.anuales).toHaveLength(0);
    expect(s.cierres).toHaveLength(0);
    expect(cuentasDelHogar(s, HOY).cuentas.map((c) => [c.cuenta.nombre, c.saldo])).toEqual(saldos);
    expect(s.ingresosFijos.map((f) => f.nombre)).toEqual(['Salario Daniel']);
    expect(s.reglas).toHaveLength(1);
  });

  it('quitar un gasto con pagos no se deja; el diezmo en Hoy dice de donde viene', () => {
    expect(() => quitarItem(semilla(), { planId: 'plan-m0', escenarioId: 'plan-m0-a', itemId: 'm0-luz' })).toThrow(expect.objectContaining({ codigo: 'ITEM_CON_PAGOS' }));
    expect(resumenMes(semilla(), OCT, HOY).porPagar.find((i) => i.item.tipo === 'DIEZMO')!.detalle).toBe('Del Salario Daniel · día 25');
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

  it('categorias: nueva, y Diezmo es del sistema y no se renombra', () => {
    const s = guardarCategoria(semilla(), { nombre: 'Educación' });
    expect(s.categorias.map((c) => c.nombre)).toContain('Educación');
    expect(() => guardarCategoria(semilla(), { nombre: 'diezmo' })).toThrow(expect.objectContaining({ codigo: 'RESERVADA' }));
    expect(() => guardarCategoria(semilla(), { id: 'cat-diezmo', nombre: 'Ofrendas' })).toThrow(expect.objectContaining({ codigo: 'RESERVADA' }));
    expect(crearHogarVacio().categorias.map((c) => c.nombre)).toEqual(['Diezmo', 'Gastos fijos', 'Tarjetas y cuotas', 'Variables', 'Créditos']);
  });
});
