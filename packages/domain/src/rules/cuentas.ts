import type { Cuenta, EstadoHogar, Fecha, Id, Movimiento, Pesos } from '../model';
import { formatFechaCorta } from '../format';
import { ReglaError, clonar, diasEntre, mesDe, nuevoId, sumar } from './base';
import { nombreUsuario } from './consultas';

/** Cuantos dias sin cuadrar antes del aviso suave. */
export const DIAS_AVISO_CUADRE = 30;

function efecto(m: Movimiento, cuentaId: Id): Pesos {
  const desde = m.origen.tipo === 'CUENTA' && m.origen.cuentaId === cuentaId;
  switch (m.tipo) {
    case 'INGRESO_FIJO':
    case 'APORTE':
      return desde ? m.monto : 0;
    case 'PAGO':
    case 'GASTO':
    case 'DIEZMO_ENTREGADO':
    case 'ABONO_CREDITO':
      return desde ? -m.monto : 0;
    case 'TRANSFERENCIA':
      return (desde ? -m.monto : 0) + (m.cuentaDestinoId === cuentaId ? m.monto : 0);
    case 'AJUSTE_CUADRE':
      return 0;
  }
}

/** Saldo estimado: lo que dijo el banco en el ultimo cuadre mas lo registrado desde entonces. */
export function saldoEstimado(estado: EstadoHogar, cuenta: Cuenta): Pesos {
  return cuenta.saldoCuadre + sumar(estado.movimientos.filter((m) => m.seq > cuenta.seqCuadre).map((m) => efecto(m, cuenta.id)));
}

export interface VistaCuenta {
  cuenta: Cuenta;
  titular: string;
  saldo: Pesos;
  /** El saldo es estimado (≈): hubo movimientos desde el cuadre o nunca se cuadro. */
  estimado: boolean;
  diasSinCuadrar: number;
  aviso: boolean;
  /** "cuadrada hoy", "cuadrada hace 3 días", "sin cuadrar desde 20 sep". */
  estadoCuadre: string;
}

export function vistaCuenta(estado: EstadoHogar, cuenta: Cuenta, hoy: Fecha): VistaCuenta {
  const saldo = saldoEstimado(estado, cuenta);
  const dias = diasEntre(cuenta.fechaCuadre, hoy);
  const aviso = !cuenta.cuadrada || dias > DIAS_AVISO_CUADRE;
  const estadoCuadre = aviso ? `sin cuadrar desde ${formatFechaCorta(cuenta.fechaCuadre)}` : dias === 0 ? 'cuadrada hoy' : `cuadrada hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return {
    cuenta,
    titular: cuenta.titularId ? nombreUsuario(estado, cuenta.titularId) : 'Conjunta',
    saldo,
    estimado: aviso || saldo !== cuenta.saldoCuadre,
    diasSinCuadrar: dias,
    aviso,
    estadoCuadre,
  };
}

export type FiltroTitular = 'TODAS' | 'CONJUNTAS' | Id;

export function cuentasDelHogar(estado: EstadoHogar, hoy: Fecha, filtro: FiltroTitular = 'TODAS'): { cuentas: VistaCuenta[]; total: Pesos } {
  const cuentas = estado.cuentas
    .filter((c) => filtro === 'TODAS' || (filtro === 'CONJUNTAS' ? c.titularId === null : c.titularId === filtro))
    .map((c) => vistaCuenta(estado, c, hoy));
  return { cuentas, total: sumar(cuentas.map((c) => c.saldo)) };
}

export function agregarCuenta(estado: EstadoHogar, datos: { nombre: string; titularId: Id | null; saldo: Pesos; fecha: Fecha }): EstadoHogar {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new ReglaError('NOMBRE_REQUERIDO', 'La cuenta necesita un nombre');
  const s = clonar(estado);
  s.cuentas.push({ id: nuevoId(s, 'cta'), nombre, titularId: datos.titularId, saldoCuadre: datos.saldo, fechaCuadre: datos.fecha, cuadrada: false, seqCuadre: s.secuencia });
  return s;
}

/** "Mover dinero": transferencia entre dos cuentas del hogar. */
export function moverDinero(estado: EstadoHogar, datos: { desde: Id; hacia: Id; monto: Pesos; fecha: Fecha; usuarioId: Id }): EstadoHogar {
  if (datos.desde === datos.hacia) throw new ReglaError('MISMA_CUENTA', 'Elige dos cuentas distintas');
  if (!(datos.monto > 0)) throw new ReglaError('MONTO_INVALIDO', 'El monto debe ser mayor que cero');
  const s = clonar(estado);
  const id = nuevoId(s, 'mov');
  s.movimientos.push({
    id, seq: s.secuencia, tipo: 'TRANSFERENCIA', ref: mesDe(datos.fecha), monto: datos.monto, fecha: datos.fecha, usuarioId: datos.usuarioId,
    creadoPor: datos.usuarioId, origen: { tipo: 'CUENTA', cuentaId: datos.desde }, nota: '', itemId: null, ingresoFijoId: null,
    bruto: null, aplicaDiezmo: false, diezmoDe: [], ingresoPlanId: null, cuentaDestinoId: datos.hacia, creditoId: null,
  });
  return s;
}

/** Diferencia de cuadrar una cuenta: positiva = salio dinero sin registrar. */
export function diferenciaCuadre(estado: EstadoHogar, cuentaId: Id, saldoBanco: Pesos): Pesos {
  const cuenta = estado.cuentas.find((c) => c.id === cuentaId);
  if (!cuenta) throw new ReglaError('NO_EXISTE', 'No existe la cuenta');
  return saldoEstimado(estado, cuenta) - saldoBanco;
}

/**
 * "Guardar saldos": por cada cuenta con valor, la diferencia queda como ajuste ("Gastos sin registrar"),
 * sin pedir explicacion, y la cuenta queda cuadrada hoy. Las que no traen valor no cambian.
 */
export function cuadrarCuentas(estado: EstadoHogar, datos: { saldos: { cuentaId: Id; saldoBanco: Pesos }[]; fecha: Fecha; usuarioId: Id }): EstadoHogar {
  const s = clonar(estado);
  for (const { cuentaId, saldoBanco } of datos.saldos) {
    const cuenta = s.cuentas.find((c) => c.id === cuentaId);
    if (!cuenta) throw new ReglaError('NO_EXISTE', 'No existe la cuenta');
    const diferencia = saldoEstimado(s, cuenta) - saldoBanco;
    if (diferencia !== 0) {
      const id = nuevoId(s, 'mov');
      s.movimientos.push({
        id, seq: s.secuencia, tipo: 'AJUSTE_CUADRE', ref: mesDe(datos.fecha), monto: diferencia, fecha: datos.fecha, usuarioId: datos.usuarioId,
        creadoPor: datos.usuarioId, origen: { tipo: 'CUENTA', cuentaId }, nota: 'Gastos sin registrar', itemId: null, ingresoFijoId: null,
        bruto: null, aplicaDiezmo: false, diezmoDe: [], ingresoPlanId: null, cuentaDestinoId: null, creditoId: null,
      });
    }
    cuenta.saldoCuadre = saldoBanco;
    cuenta.fechaCuadre = datos.fecha;
    cuenta.cuadrada = true;
    cuenta.seqCuadre = s.secuencia;
  }
  return s;
}
