// Modelo de Presupuesto Hogar (HANDOFF.md, seccion 6). Todo cuelga del hogar; los montos son
// pesos enteros (sin decimales) y las fechas son ISO `YYYY-MM-DD`.

export type Id = string;
/** Pesos colombianos enteros. */
export type Pesos = number;
/** Fecha ISO `YYYY-MM-DD`. */
export type Fecha = string;

/** Un mes del calendario; `mes` va de 1 a 12. */
export interface MesRef {
  anio: number;
  mes: number;
}

export interface Usuario {
  id: Id;
  nombre: string;
  email: string;
  /** Letra del avatar ("D", "E"). */
  inicial: string;
}

export interface Miembro {
  usuarioId: Id;
  unidoEn: Fecha;
}

export type EstadoInvitacion = 'PENDIENTE' | 'ACEPTADA';

export interface Invitacion {
  id: Id;
  email: string;
  token: string;
  estado: EstadoInvitacion;
  expiraEn: Fecha;
  creadaPor: Id;
  enviadaEn: Fecha;
}

export interface Hogar {
  id: Id;
  nombre: string;
  miembros: Miembro[];
  invitaciones: Invitacion[];
  /** False hasta terminar el onboarding. */
  configurado: boolean;
}

export type BaseDiezmo = 'BRUTO' | 'NETO';

/** Regla por persona: se aplica a sus ingresos fijos y, si `aplicaAportes`, a sus aportes. */
export interface ReglaDiezmo {
  usuarioId: Id;
  activa: boolean;
  porcentaje: number;
  base: BaseDiezmo;
  aplicaAportes: boolean;
}

export interface IngresoFijo {
  id: Id;
  usuarioId: Id;
  nombre: string;
  bruto: Pesos;
  neto: Pesos;
  diaPago: number;
  cuentaId: Id | null;
  activo: boolean;
}

export interface Cuenta {
  id: Id;
  nombre: string;
  /** null = conjunta. */
  titularId: Id | null;
  /** Saldo que dijo el banco en el ultimo cuadre (o el saldo aproximado inicial). */
  saldoCuadre: Pesos;
  fechaCuadre: Fecha;
  /** Si el ultimo cuadre fue explicito; el saldo inicial cuenta como "sin cuadrar". */
  cuadrada: boolean;
  /** Secuencia del ultimo movimiento incluido en `saldoCuadre`: el estimado suma los posteriores. */
  seqCuadre: number;
}

export interface PagoCredito {
  fecha: Fecha;
  monto: Pesos;
  tipo: 'CUOTA' | 'ABONO';
}

export interface Credito {
  id: Id;
  nombre: string;
  entidad: string;
  saldo: Pesos;
  saldoActualizadoEn: Fecha;
  cuota: Pesos;
  /** Tasa efectiva mensual en porcentaje (1.6 = 1,6 % EM). */
  tasaEM: number;
  diaPago: number;
  totalOriginal: Pesos;
  pagos: PagoCredito[];
  /** Como baja el saldo (design D3 de tarjetas-y-creditos). Los de antes son TASA. */
  metodo: MetodoCredito;
  /** PLAN: numero total de cuotas de la tabla. */
  numeroCuotas: number | null;
  /** Cuotas ya pagadas (PLAN; en TASA, si se conoce). */
  cuotasPagadas: number;
  /** PLAN: el valor financiado, de donde sale la tabla. */
  valorFinanciado: Pesos | null;
}

/** TASA: saldo, tasa y cuota. PLAN: valor, numero de cuotas y tasa (tabla aproximada). MANUAL: el saldo se escribe del extracto. */
export type MetodoCredito = 'TASA' | 'PLAN' | 'MANUAL';

/** Completa: se paga el valor del extracto (`estimado` es el ultimo pagado). Fijo: siempre el mismo monto. */
export type PagoTarjeta = { tipo: 'COMPLETA'; estimado: Pesos } | { tipo: 'FIJO'; monto: Pesos };

/** Tarjeta de credito: fechas, uso y como se paga. No lleva deuda ni compras (spec steward-tarjetas). */
export interface Tarjeta {
  id: Id;
  nombre: string;
  diaCorte: number;
  diaPago: number;
  /** "Mercado", "Gasolina"; '' = sin uso. */
  uso: string;
  pago: PagoTarjeta;
}

/** TARJETA: las lineas de las tarjetas de credito; CREDITO: compras a cuotas y prestamos (tarjetas-y-creditos). */
export type TipoCategoria = 'DIEZMO' | 'FIJO' | 'TARJETA' | 'VARIABLE' | 'CREDITO' | 'OTRO';

export interface Categoria {
  id: Id;
  nombre: string;
  color: string;
  orden: number;
  tipo: TipoCategoria;
  /** Las del sistema no se borran (si se renombran, salvo Diezmo). */
  sistema: boolean;
}

export type EstadoMes = 'BORRADOR' | 'ACTIVO' | 'CERRADO';

/** Tipo de un item del plan: decide como se ejecuta en Hoy. */
export type TipoItem = 'FIJO' | 'VARIABLE' | 'CUOTA' | 'CREDITO' | 'DIEZMO';

export interface ItemPlan {
  id: Id;
  categoriaId: Id;
  nombre: string;
  monto: Pesos;
  diaVence: number | null;
  tipo: TipoItem;
  /** Para compras a cuotas: cuota actual y total ("cuota 4 de 12"). */
  cuota: { actual: number; total: number } | null;
  /** Credito al que corresponde (cuota o abono). */
  creditoId: Id | null;
  /** DIEZMO: el ingreso fijo que lo origina (design D1 de diezmo-como-gasto). */
  ingresoFijoId: Id | null;
  /** DIEZMO: el movimiento APORTE que lo origina. */
  aporteId: Id | null;
  /** DIEZMO: la linea de ingreso de la opcion de la que sale; se recalcula con ella (design D1 de usabilidad-plan). */
  ingresoPlanId: Id | null;
  /** DIEZMO: su monto se cambio a mano; ya no sigue a su linea hasta "Volver a calcular". */
  ajustadoAMano: boolean;
  /** Tarjeta de la que es la linea del plan (design D1 de tarjetas-y-creditos). Sin el campo = ninguna. */
  tarjetaId?: Id | null;
}

/** FIJO sale de Ajustes, EXTRA de un evento del plan anual, OTRO se agrego a mano (design D8 de diezmo-como-gasto). */
export type TipoIngresoPlan = 'FIJO' | 'EXTRA' | 'OTRO';

/** Linea de ingreso de una opcion: el plan es un cuaderno, cada opcion supone sus propios ingresos. */
export interface IngresoPlan {
  id: Id;
  nombre: string;
  monto: Pesos;
  usuarioId: Id | null;
  tipo: TipoIngresoPlan;
  ingresoFijoId: Id | null;
  /** Base del diezmo cuando la regla usa el bruto; en las lineas que no son de un ingreso fijo, igual al monto. */
  bruto: Pesos;
}

export interface Escenario {
  id: Id;
  /** "A", "B", ... */
  letra: string;
  creadoPor: Id;
  nota: string;
  archivado: boolean;
  ingresos: IngresoPlan[];
  items: ItemPlan[];
}

export interface PlanMes {
  id: Id;
  ref: MesRef;
  estado: EstadoMes;
  escenarios: Escenario[];
  /** Opcion elegida ("Usar esta"); en un mes ACTIVO es la que se ejecuta. */
  escenarioActivoId: Id | null;
}

export type TipoMovimiento =
  | 'INGRESO_FIJO'
  | 'APORTE'
  | 'PAGO'
  | 'GASTO'
  | 'DIEZMO_ENTREGADO'
  | 'AJUSTE_CUADRE'
  | 'TRANSFERENCIA'
  | 'ABONO_CREDITO';

/** De donde salio (o a donde llego) el dinero. EXTERNA = "Su cuenta", fuera de la app. */
export type Origen = { tipo: 'CUENTA'; cuentaId: Id } | { tipo: 'EXTERNA' } | { tipo: 'NINGUNO' };

export interface Movimiento {
  id: Id;
  /** Orden de registro (para el saldo estimado desde el ultimo cuadre). */
  seq: number;
  tipo: TipoMovimiento;
  /** Mes al que se imputa (un aporte puede ser para el mes siguiente). */
  ref: MesRef;
  monto: Pesos;
  fecha: Fecha;
  /** Quien recibio, aporto o pago. */
  usuarioId: Id;
  creadoPor: Id;
  origen: Origen;
  nota: string;
  /** PAGO/GASTO: item del plan (null = "No estaba planeado"). */
  itemId: Id | null;
  /** INGRESO_FIJO: cual ingreso y su bruto (base del diezmo). */
  ingresoFijoId: Id | null;
  bruto: Pesos | null;
  /** INGRESO_FIJO: la linea de ingreso de la opcion que se recibio. */
  ingresoPlanId: Id | null;
  /** APORTE: si genera su item de diezmo. */
  aplicaDiezmo: boolean;
  /** DIEZMO_ENTREGADO (historia, ya no se crea): movimientos cuyas obligaciones cubria. */
  diezmoDe: Id[];
  /** TRANSFERENCIA: cuenta destino. AJUSTE_CUADRE: la cuenta cuadrada va en `origen`. */
  cuentaDestinoId: Id | null;
  /** ABONO_CREDITO */
  creditoId: Id | null;
  /** PAGO de una cuota y ABONO_CREDITO: cuanto bajo el saldo del credito; se devuelve al borrarlo (null en los de antes). */
  capital: Pesos | null;
}

export interface FilaCierre {
  nombre: string;
  plan: Pesos | null;
  real: Pesos;
}

export interface CierreMes {
  ref: MesRef;
  filas: FilaCierre[];
  sinRegistrar: Pesos;
  sobrante: Pesos;
  aAhorro: Pesos;
  aSiguiente: Pesos;
  cerradoPor: Id;
  cerradoEn: Fecha;
}

/** Proyeccion de aportes de una persona para un mes (se ve tenue hasta que hay aportes reales). */
export interface ProyeccionAporte {
  usuarioId: Id;
  ref: MesRef;
  monto: Pesos;
}

export type TipoEvento = 'INGRESO' | 'GASTO';

export interface EventoAnual {
  id: Id;
  nombre: string;
  mes: number;
  monto: Pesos;
  tipo: TipoEvento;
  /** Ingreso extra (prima) que hereda la regla de diezmo de esta persona. */
  usuarioId: Id | null;
  /** Gasto en una categoria del hogar; null = "Eventos del año" (design D3 de planear-anio-desde-un-mes). */
  categoriaId: Id | null;
  /** Hasta que mes se repite, de `mes` a 12: el mismo mes es "solo ese mes" y 12, "en adelante" (anual-evento-rango). */
  hasta: number;
}

/** Base para replicar en el plan anual: un mes con plan, solo los fijos del ultimo plan, o desde cero. */
export type BaseAnual = { tipo: 'MES'; ref: MesRef } | { tipo: 'FIJOS' } | { tipo: 'CERO' };

/** Fila de gasto del plan anual: una categoria con su monto por mes (12 valores). */
export interface FilaAnual {
  categoriaId: Id;
  montos: Pesos[];
}

/** Una opcion del plan anual (A, B, ...): sus celdas, sus cambios y su mes base (design D1 de anual-opciones-y-meses). */
export interface OpcionAnual {
  id: Id;
  letra: string;
  creadoPor: Id;
  nota: string;
  filas: FilaAnual[];
  eventos: EventoAnual[];
  /** El mes que se replico; los items de los meses creados salen de el. null: se lleno a mano. */
  base: MesRef | null;
  /** El mes base editable de la opcion (anual-mes-base-editable); si existe, los meses salen de el. */
  mesBase?: MesBaseAnual | null;
}

/** Los gastos que valen igual todos los meses en una opcion, copiados de `origen` y editados a mano. Sin items de diezmo. */
export interface MesBaseAnual {
  origen: MesRef | null;
  items: ItemPlan[];
}

export interface PlanAnual {
  anio: number;
  /** CREADO: ya se llevo una opcion a los meses ("Meses con la Opción X"). */
  estado: 'BORRADOR' | 'CREADO';
  opciones: OpcionAnual[];
  /** La opcion que se llevo a los meses; null si ninguna. */
  opcionEnUso: Id | null;
}

/** Estado completo del hogar en el adaptador de prueba (lo que se serializa). */
export interface EstadoHogar {
  version: number;
  /** Contador para ids y para la secuencia de movimientos. */
  secuencia: number;
  hogar: Hogar;
  usuarios: Usuario[];
  reglas: ReglaDiezmo[];
  ingresosFijos: IngresoFijo[];
  cuentas: Cuenta[];
  creditos: Credito[];
  tarjetas: Tarjeta[];
  categorias: Categoria[];
  planes: PlanMes[];
  movimientos: Movimiento[];
  cierres: CierreMes[];
  proyecciones: ProyeccionAporte[];
  anuales: PlanAnual[];
}
