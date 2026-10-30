import type { EstadoHogar, Id, MesRef, Movimiento } from '../model';
import { formatCop } from '../format';
import { efecto } from './cuentas';
import { esAporteImplicito, movimientosDe, nombreUsuario, planDe } from './consultas';

/** Un registro abierto en su hoja (spec steward-hoy, "Abrir un registro para corregirlo"). */
export interface VistaRegistro {
  movimiento: Movimiento;
  /** "Internet", "Farmacia", "Salario Daniel", "Aporte Esposa". */
  titulo: string;
  /** El pago de una cuota: su monto no se corrige, se borra y se marca otra vez. */
  esCuota: boolean;
  /** Lo que pasa al borrarlo: "Internet vuelve a Por pagar", "El saldo de Davivienda sube $120.000". */
  avisos: string[];
}

function titulo(estado: EstadoHogar, m: Movimiento): string {
  const opciones = planDe(estado, m.ref)?.escenarios ?? [];
  switch (m.tipo) {
    case 'PAGO':
    case 'GASTO':
      return opciones.flatMap((e) => e.items).find((i) => i.id === m.itemId)?.nombre ?? (m.nota || 'Gasto');
    case 'INGRESO_FIJO':
      return opciones.flatMap((e) => e.ingresos).find((l) => l.id === m.ingresoPlanId)?.nombre
        ?? estado.ingresosFijos.find((f) => f.id === m.ingresoFijoId)?.nombre ?? 'Ingreso';
    case 'APORTE':
      return `Aporte ${nombreUsuario(estado, m.usuarioId)}`;
    default:
      return m.nota || 'Movimiento';
  }
}

function avisos(estado: EstadoHogar, m: Movimiento, nombre: string): string[] {
  const lista: string[] = [];
  if (m.tipo === 'PAGO') lista.push(`${nombre} vuelve a Por pagar`);
  if (m.tipo === 'GASTO') lista.push(m.itemId ? `Se quita de lo que llevas en ${nombre}` : `Pagado baja ${formatCop(m.monto)}`);
  if (m.tipo === 'INGRESO_FIJO') lista.push(`${nombre} vuelve a Por recibir`);
  if (m.tipo === 'APORTE' && m.aplicaDiezmo) lista.push('Se quita también su diezmo, si no tiene pagos');
  if (m.origen.tipo === 'CUENTA') {
    const { cuentaId } = m.origen;
    const cuenta = estado.cuentas.find((c) => c.id === cuentaId);
    if (cuenta) {
      const cambio = efecto(m, cuentaId);
      if (m.seq <= cuenta.seqCuadre) lista.push(`Ya está en el cuadre de ${cuenta.nombre}: su saldo no cambia`);
      else lista.push(`El saldo de ${cuenta.nombre} ${cambio < 0 ? 'sube' : 'baja'} ${formatCop(Math.abs(cambio))}`);
    }
  }
  const credito = m.creditoId ? estado.creditos.find((c) => c.id === m.creditoId) : undefined;
  if (credito) lista.push(m.capital === null ? `Revisa el saldo de ${credito.nombre}` : `El saldo de ${credito.nombre} sube ${formatCop(m.capital)}`);
  return lista;
}

const CORREGIBLES = new Set<Movimiento['tipo']>(['PAGO', 'GASTO', 'INGRESO_FIJO', 'APORTE']);

/** La vista de un registro corregible; null si ya no existe o no se corrige por aqui. */
export function vistaRegistro(estado: EstadoHogar, movimientoId: Id): VistaRegistro | null {
  const m = estado.movimientos.find((x) => x.id === movimientoId);
  if (!m || !CORREGIBLES.has(m.tipo)) return null;
  const nombre = titulo(estado, m);
  return { movimiento: m, titulo: nombre, esCuota: m.tipo === 'PAGO' && Boolean(m.creditoId), avisos: avisos(estado, m, nombre) };
}

/** Los registros de un item (un variable con varios gastos) o los aportes de una persona, incluidos sus pagos directos. */
export function registrosDe(estado: EstadoHogar, ref: MesRef, filtro: { itemId?: Id; aportesDe?: Id }): VistaRegistro[] {
  return movimientosDe(estado, ref)
    .filter((m) => (filtro.itemId ? (m.tipo === 'PAGO' || m.tipo === 'GASTO') && m.itemId === filtro.itemId : m.usuarioId === filtro.aportesDe && (m.tipo === 'APORTE' || esAporteImplicito(m))))
    .sort((a, b) => b.seq - a.seq)
    .map((m) => vistaRegistro(estado, m.id))
    .filter((v): v is VistaRegistro => v !== null);
}
