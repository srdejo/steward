import type { Categoria, Credito, EstadoHogar, Fecha, Id, IngresoPlan, ItemPlan, MesRef, Movimiento, Origen, PlanMes, Tarjeta, TipoItem, TipoMovimiento } from '../model';
import { fechaEnMes, mesDe, sumarMeses } from '../rules/base';

/** Version del esquema guardado: si cambia, el adaptador vuelve a sembrar. 2: diezmo como gasto y lineas de ingreso; 3: el diezmo enlazado a su linea;
 * 4: tarjetas y creditos con metodo; 5: la categoria Tarjetas (tarjetas-y-creditos); 6: opciones del plan anual (anual-opciones-y-meses). */
export const VERSION_ESQUEMA = 6;

export const DANIEL = 'u-daniel';
export const ESPOSA = 'u-esposa';

const CATEGORIAS: Categoria[] = [
  { id: 'cat-diezmo', nombre: 'Diezmo', color: '#0F766E', orden: 0, tipo: 'DIEZMO', sistema: true },
  { id: 'cat-fijos', nombre: 'Gastos fijos', color: '#E2551B', orden: 1, tipo: 'FIJO', sistema: true },
  { id: 'cat-variables', nombre: 'Variables', color: '#8D8F88', orden: 2, tipo: 'VARIABLE', sistema: true },
  // Las lineas de las tarjetas van en Tarjetas; las compras a cuotas y los prestamos, en Creditos (tarjetas-y-creditos).
  { id: 'cat-tarjetas', nombre: 'Tarjetas', color: '#7C4DDB', orden: 3, tipo: 'TARJETA', sistema: true },
  { id: 'cat-creditos', nombre: 'Créditos', color: '#2E6B45', orden: 4, tipo: 'CREDITO', sistema: true },
];

interface DefItem {
  id: string;
  cat: Id;
  nombre: string;
  monto: number;
  dia: number | null;
  tipo: TipoItem;
  cuota?: { actual: number; total: number };
  credito?: Id;
  ingreso?: Id;
  tarjeta?: Id;
}

/**
 * Plan de octubre de los artboards: fijos $795.000, tarjetas $2.620.000, creditos $875.000 (la compra a cuotas y el prestamo), variables
 * $400.000, y el diezmo del salario como gasto sin pagar (design D6 de diezmo-como-gasto): el plan sigue en $5.390.000.
 * La tarjeta Nu es la linea de Mercado (HoyWeb.dc.html de tarjetas-y-creditos).
 */
const ITEMS: DefItem[] = [
  { id: 'diezmo-salario', cat: 'cat-diezmo', nombre: 'Diezmo · Salario Daniel', monto: 700_000, dia: 25, tipo: 'DIEZMO', ingreso: 'ing-salario' },
  { id: 'pension', cat: 'cat-fijos', nombre: 'Pensión', monto: 550_000, dia: 5, tipo: 'FIJO' },
  { id: 'celular', cat: 'cat-fijos', nombre: 'Celular', monto: 50_000, dia: 8, tipo: 'FIJO' },
  { id: 'internet', cat: 'cat-fijos', nombre: 'Internet', monto: 120_000, dia: 10, tipo: 'FIJO' },
  { id: 'luz', cat: 'cat-fijos', nombre: 'Recibo Luz', monto: 50_000, dia: 12, tipo: 'FIJO' },
  { id: 'gas', cat: 'cat-fijos', nombre: 'Gas', monto: 25_000, dia: 14, tipo: 'FIJO' },
  { id: 'mastercard', cat: 'cat-tarjetas', nombre: 'Tarjeta Mastercard', monto: 1_500_000, dia: 30, tipo: 'FIJO', tarjeta: 'tar-mastercard' },
  { id: 'visa', cat: 'cat-tarjetas', nombre: 'Tarjeta Visa · Gasolina', monto: 800_000, dia: 6, tipo: 'FIJO', tarjeta: 'tar-visa' },
  { id: 'cuotas', cat: 'cat-creditos', nombre: 'Compra a cuotas', monto: 375_000, dia: 20, tipo: 'CREDITO', credito: 'cred-cuotas' },
  { id: 'mercado', cat: 'cat-tarjetas', nombre: 'Tarjeta Nu · Mercado', monto: 320_000, dia: 28, tipo: 'FIJO', tarjeta: 'tar-nu' },
  { id: 'transporte', cat: 'cat-variables', nombre: 'Transporte', monto: 250_000, dia: null, tipo: 'VARIABLE' },
  { id: 'apoyo', cat: 'cat-variables', nombre: 'Apoyo familiar', monto: 150_000, dia: null, tipo: 'VARIABLE' },
  { id: 'cuota-credito', cat: 'cat-creditos', nombre: 'Cuota libre inversión', monto: 500_000, dia: 15, tipo: 'CREDITO', credito: 'cred-libre' },
];

function items(prefijo: string, cuotaExtra = 0): ItemPlan[] {
  return ITEMS.map((d) => ({
    id: `${prefijo}-${d.id}`, categoriaId: d.cat, nombre: d.nombre, monto: d.monto, diaVence: d.dia, tipo: d.tipo,
    cuota: d.cuota ? { actual: d.cuota.actual + cuotaExtra, total: d.cuota.total } : null, creditoId: d.credito ?? null,
    ingresoFijoId: d.ingreso ?? null, aporteId: null, ingresoPlanId: d.ingreso ? `${prefijo}-ing-salario` : null, ajustadoAMano: false,
    tarjetaId: d.tarjeta ?? null,
  }));
}

/** Tarjetas de los artboards TarjetasWeb y TarjetasMovil. */
const TARJETAS: Tarjeta[] = [
  { id: 'tar-nu', nombre: 'Nu', diaCorte: 13, diaPago: 28, uso: 'Mercado', pago: { tipo: 'COMPLETA', estimado: 320_000 } },
  { id: 'tar-mastercard', nombre: 'Mastercard', diaCorte: 15, diaPago: 30, uso: '', pago: { tipo: 'FIJO', monto: 1_500_000 } },
  { id: 'tar-visa', nombre: 'Visa', diaCorte: 21, diaPago: 6, uso: 'Gasolina', pago: { tipo: 'COMPLETA', estimado: 800_000 } },
];

/** Creditos de CreditosWeb: el prestamo con la tasa y la compra a cuotas con su plan de pagos. */
function creditos(M: MesRef, ant1: MesRef): Credito[] {
  return [
    {
      id: 'cred-libre', nombre: 'Libre inversión', entidad: 'Davivienda', saldo: 14_250_000, saldoActualizadoEn: fechaEnMes(M, 25), cuota: 500_000, tasaEM: 1.6,
      diaPago: 15, totalOriginal: 22_500_000, pagos: [{ fecha: fechaEnMes(M, 15), monto: 500_000, tipo: 'CUOTA' }, { fecha: fechaEnMes(ant1, 15), monto: 500_000, tipo: 'CUOTA' }],
      metodo: 'TASA', numeroCuotas: null, cuotasPagadas: 22, valorFinanciado: null,
    },
    {
      id: 'cred-cuotas', nombre: 'Compra a cuotas', entidad: 'Almacén', saldo: 3_375_000, saldoActualizadoEn: fechaEnMes(ant1, 20), cuota: 375_000, tasaEM: 0,
      diaPago: 20, totalOriginal: 4_500_000, pagos: [{ fecha: fechaEnMes(ant1, 20), monto: 375_000, tipo: 'CUOTA' }],
      metodo: 'PLAN', numeroCuotas: 12, cuotasPagadas: 3, valorFinanciado: 4_500_000,
    },
  ];
}

/** Linea de ingreso de cada opcion: el salario con su neto (design D8). */
function ingresos(prefijo: string): IngresoPlan[] {
  return [{ id: `${prefijo}-ing-salario`, nombre: 'Salario Daniel', monto: 6_288_000, usuarioId: DANIEL, tipo: 'FIJO', ingresoFijoId: 'ing-salario', bruto: 7_000_000 }];
}

function cuenta(id: Id): Origen {
  return { tipo: 'CUENTA', cuentaId: id };
}

/**
 * Hogar de ejemplo del handoff, anclado al mes del reloj (design D3):
 * M-2 y M-1 cerrados, M activo (Hoy de los artboards), M+1 en borrador con las opciones A, B y C,
 * M+2 sin plan, y el plan anual del año siguiente en borrador.
 */
export function crearSemilla(hoy: Fecha): EstadoHogar {
  const M = mesDe(hoy);
  const ant1 = sumarMeses(M, -1);
  const ant2 = sumarMeses(M, -2);
  const sig = sumarMeses(M, 1);
  const f = (ref: MesRef, dia: number) => fechaEnMes(ref, dia);

  let seq = 0;
  const movimientos: Movimiento[] = [];
  const mov = (tipo: TipoMovimiento, ref: MesRef, dia: number, monto: number, usuarioId: Id, origen: Origen, extra: Partial<Movimiento> = {}) => {
    seq += 1;
    movimientos.push({
      id: `seed-mov-${seq}`, seq, tipo, ref, monto, fecha: f(ref, dia), usuarioId, creadoPor: usuarioId, origen, nota: '',
      itemId: null, ingresoFijoId: null, bruto: null, aplicaDiezmo: false, diezmoDe: [], ingresoPlanId: null, cuentaDestinoId: null, creditoId: null, capital: null, ...extra,
    });
  };
  const pago = (item: string, dia: number, monto: number, usuarioId: Id, origen: Origen, tipo: TipoMovimiento = 'PAGO') =>
    mov(tipo, M, dia, monto, usuarioId, origen, { itemId: `m0-${item}` });

  // Este mes: lo que muestra Hoy (libre $3.436.000, plan $5.390.000, vs. plan −$62.000).
  mov('APORTE', M, 2, 1_500_000, ESPOSA, cuenta('cta-davivienda'));
  pago('transporte', 3, 150_000, DANIEL, cuenta('cta-davivienda'), 'GASTO');
  pago('pension', 5, 550_000, DANIEL, cuenta('cta-davivienda'));
  pago('apoyo', 6, 150_000, DANIEL, cuenta('cta-davivienda'), 'GASTO');
  pago('celular', 8, 50_000, DANIEL, cuenta('cta-nu'));
  pago('internet', 10, 75_000, DANIEL, cuenta('cta-davivienda'));
  pago('luz', 12, 38_000, ESPOSA, { tipo: 'EXTERNA' });
  pago('gas', 14, 20_000, DANIEL, cuenta('cta-efectivo'));
  pago('cuota-credito', 15, 500_000, DANIEL, cuenta('cta-davivienda'));
  mov('APORTE', M, 16, 1_000_000, ESPOSA, cuenta('cta-davivienda'));
  pago('transporte', 17, 100_000, DANIEL, cuenta('cta-nu'), 'GASTO');
  pago('visa', 18, 800_000, DANIEL, cuenta('cta-nu'));
  mov('INGRESO_FIJO', M, 25, 6_288_000, DANIEL, cuenta('cta-davivienda'), { ingresoFijoId: 'ing-salario', bruto: 7_000_000 });
  // Aporte de la esposa registrado para el mes siguiente (Planear: "Registrado el 26 oct").
  mov('APORTE', sig, 26, 2_000_000, ESPOSA, { tipo: 'NINGUNO' }, { fecha: f(M, 26) });

  const plan = (id: string, ref: MesRef, estado: PlanMes['estado'], prefijo: string, cuotaExtra: number): PlanMes => ({
    id, ref, estado, escenarioActivoId: `${id}-a`,
    escenarios: [{ id: `${id}-a`, letra: 'A', creadoPor: DANIEL, nota: '', archivado: false, ingresos: ingresos(prefijo), items: items(prefijo, cuotaExtra) }],
  });

  const nov = items('m1', 1);
  const planSiguiente: PlanMes = {
    id: 'plan-m1', ref: sig, estado: 'BORRADOR', escenarioActivoId: null,
    escenarios: [
      { id: 'plan-m1-a', letra: 'A', creadoPor: DANIEL, nota: 'Base del plan anual', archivado: false, ingresos: ingresos('m1'), items: nov },
      {
        id: 'plan-m1-b', letra: 'B', creadoPor: ESPOSA, nota: 'Navidad + viaje', archivado: false, ingresos: ingresos('m1b'),
        items: [
          ...items('m1b', 1),
          { id: 'm1b-regalos', categoriaId: 'cat-variables', nombre: 'Regalos de Navidad', monto: 600_000, diaVence: null, tipo: 'VARIABLE', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false },
          { id: 'm1b-viaje', categoriaId: 'cat-ahorro', nombre: 'Ahorro viaje', monto: 1_000_000, diaVence: null, tipo: 'FIJO', cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false },
        ],
      },
      {
        id: 'plan-m1-c', letra: 'C', creadoPor: DANIEL, nota: 'abono a crédito', archivado: false, ingresos: ingresos('m1c'),
        items: [...items('m1c', 1), { id: 'm1c-abono', categoriaId: 'cat-creditos', nombre: 'Abono extra crédito', monto: 1_500_000, diaVence: 15, tipo: 'CREDITO', cuota: null, creditoId: 'cred-libre', ingresoFijoId: null, aporteId: null, ingresoPlanId: null, ajustadoAMano: false }],
      },
    ],
  };

  const anioSig = M.anio + 1;
  const doce = (v: number) => Array.from({ length: 12 }, () => v);
  const estado: EstadoHogar = {
    version: VERSION_ESQUEMA,
    secuencia: 1000,
    hogar: {
      id: 'hogar-1', nombre: 'Nuestra casa', configurado: true, invitaciones: [],
      miembros: [{ usuarioId: DANIEL, unidoEn: f(ant2, 1) }, { usuarioId: ESPOSA, unidoEn: f(ant1, 27) }],
    },
    usuarios: [
      { id: DANIEL, nombre: 'Daniel', email: 'daniel@ejemplo.com', inicial: 'D' },
      { id: ESPOSA, nombre: 'Esposa', email: 'esposa@ejemplo.com', inicial: 'E' },
    ],
    reglas: [{ usuarioId: DANIEL, activa: true, porcentaje: 10, base: 'BRUTO', aplicaAportes: true }],
    ingresosFijos: [{ id: 'ing-salario', usuarioId: DANIEL, nombre: 'Salario Daniel', bruto: 7_000_000, neto: 6_288_000, diaPago: 25, cuentaId: 'cta-davivienda', activo: true }],
    cuentas: [
      { id: 'cta-davivienda', nombre: 'Davivienda', titularId: DANIEL, saldoCuadre: 4_150_000, fechaCuadre: f(M, 19), cuadrada: true, seqCuadre: seq },
      { id: 'cta-nu', nombre: 'Nu', titularId: DANIEL, saldoCuadre: 3_360_000, fechaCuadre: hoy, cuadrada: true, seqCuadre: seq },
      { id: 'cta-efectivo', nombre: 'Efectivo', titularId: null, saldoCuadre: 200_000, fechaCuadre: f(M, 24), cuadrada: true, seqCuadre: seq },
      { id: 'cta-ahorros-esposa', nombre: 'Ahorros Esposa', titularId: ESPOSA, saldoCuadre: 1_420_000, fechaCuadre: f(ant1, 20), cuadrada: true, seqCuadre: seq },
    ],
    creditos: creditos(M, ant1),
    tarjetas: TARJETAS.map((t) => ({ ...t, pago: { ...t.pago } })),
    categorias: [...CATEGORIAS, { id: 'cat-ahorro', nombre: 'Ahorro', color: '#1E5A4C', orden: 5, tipo: 'OTRO', sistema: false }],
    planes: [
      { ...plan('plan-m-2', ant2, 'CERRADO', 'm-2', -2) },
      { ...plan('plan-m-1', ant1, 'CERRADO', 'm-1', -1) },
      plan('plan-m0', M, 'ACTIVO', 'm0', 0),
      planSiguiente,
    ],
    movimientos,
    cierres: [
      { ref: ant2, filas: [{ nombre: 'Ingresos', plan: 8_288_000, real: 8_500_000 }, { nombre: 'Gastos', plan: 5_390_000, real: 6_390_000 }], sinRegistrar: 0, sobrante: 2_110_000, aAhorro: 2_110_000, aSiguiente: 0, cerradoPor: DANIEL, cerradoEn: f(ant1, 1) },
      { ref: ant1, filas: [{ nombre: 'Ingresos', plan: 8_288_000, real: 8_288_000 }, { nombre: 'Gastos', plan: 5_390_000, real: 6_448_000 }], sinRegistrar: 0, sobrante: 1_840_000, aAhorro: 1_840_000, aSiguiente: 0, cerradoPor: DANIEL, cerradoEn: f(M, 1) },
    ],
    proyecciones: [
      { usuarioId: ESPOSA, ref: M, monto: 2_000_000 },
      ...Array.from({ length: 12 }, (_, i) => ({ usuarioId: ESPOSA, ref: { anio: anioSig, mes: i + 1 }, monto: 1_500_000 })),
    ],
    anuales: [
      {
        anio: M.anio, estado: 'CREADO', opcionEnUso: 'anual-actual-a',
        opciones: [{ id: 'anual-actual-a', letra: 'A', creadoPor: DANIEL, nota: '', filas: [], base: null, eventos: [
          { id: 'ev-prima-jun', nombre: 'Prima', mes: 6, monto: 3_500_000, tipo: 'INGRESO', usuarioId: DANIEL, categoriaId: null, enAdelante: false },
          { id: 'ev-prima-dic', nombre: 'Prima', mes: 12, monto: 3_500_000, tipo: 'INGRESO', usuarioId: DANIEL, categoriaId: null, enAdelante: false },
        ] }],
      },
      {
        anio: anioSig, estado: 'BORRADOR', opcionEnUso: null,
        opciones: [{ id: 'anual-sig-a', letra: 'A', creadoPor: DANIEL, nota: '', base: null, filas: [
          { categoriaId: 'cat-fijos', montos: doce(795_000) },
          { categoriaId: 'cat-variables', montos: [...doce(400_000).slice(0, 11), 1_080_000] },
          { categoriaId: 'cat-tarjetas', montos: doce(2_620_000) },
          { categoriaId: 'cat-creditos', montos: doce(875_000) },
        ],
        eventos: [
          { id: 'ev2-prima-jun', nombre: 'Prima', mes: 6, monto: 3_500_000, tipo: 'INGRESO', usuarioId: DANIEL, categoriaId: null, enAdelante: false },
          { id: 'ev2-prima-dic', nombre: 'Prima', mes: 12, monto: 3_500_000, tipo: 'INGRESO', usuarioId: DANIEL, categoriaId: null, enAdelante: false },
          { id: 'ev2-matricula', nombre: 'Matrícula', mes: 1, monto: 1_800_000, tipo: 'GASTO', usuarioId: null, categoriaId: null, enAdelante: false },
          { id: 'ev2-soat', nombre: 'SOAT', mes: 3, monto: 900_000, tipo: 'GASTO', usuarioId: null, categoriaId: null, enAdelante: false },
          { id: 'ev2-predial', nombre: 'Predial', mes: 4, monto: 1_200_000, tipo: 'GASTO', usuarioId: null, categoriaId: null, enAdelante: false },
          { id: 'ev2-renta', nombre: 'Renta', mes: 8, monto: 1_500_000, tipo: 'GASTO', usuarioId: null, categoriaId: null, enAdelante: false },
        ] }],
      },
    ],
  };
  return estado;
}

/** Hogar vacio sin configurar ("Probar desde cero"): solo el usuario que entra. */
export function crearHogarVacio(): EstadoHogar {
  return {
    version: VERSION_ESQUEMA,
    secuencia: 1000,
    hogar: { id: 'hogar-1', nombre: '', configurado: false, invitaciones: [], miembros: [{ usuarioId: DANIEL, unidoEn: '' }] },
    usuarios: [{ id: DANIEL, nombre: 'Daniel', email: 'daniel@ejemplo.com', inicial: 'D' }],
    reglas: [],
    ingresosFijos: [],
    cuentas: [],
    creditos: [],
    tarjetas: [],
    categorias: CATEGORIAS.map((c) => ({ ...c })),
    planes: [],
    movimientos: [],
    cierres: [],
    proyecciones: [],
    anuales: [],
  };
}
