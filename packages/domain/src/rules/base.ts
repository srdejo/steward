import type { EstadoHogar, Fecha, Id, MesRef } from '../model';

/** Error de una regla de negocio. `codigo` es estable para que la UI arme su mensaje. */
export class ReglaError extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
    readonly datos: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = 'ReglaError';
  }
}

/** Copia profunda: las reglas que modifican devuelven un estado nuevo y nunca tocan el recibido. */
export function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

/** Siguiente id (y secuencia) del estado. Muta el borrador que recibe. */
export function nuevoId(borrador: EstadoHogar, prefijo: string): Id {
  borrador.secuencia += 1;
  return `${prefijo}-${borrador.secuencia}`;
}

export function mesDe(fecha: Fecha): MesRef {
  const [anio, mes] = fecha.split('-').map(Number);
  return { anio: anio!, mes: mes! };
}

export function diaDe(fecha: Fecha): number {
  return Number(fecha.split('-')[2]);
}

export function mismoMes(a: MesRef, b: MesRef): boolean {
  return a.anio === b.anio && a.mes === b.mes;
}

/** Negativo si a es anterior a b. */
export function compararMes(a: MesRef, b: MesRef): number {
  return a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes;
}

export function sumarMeses(ref: MesRef, n: number): MesRef {
  const total = ref.anio * 12 + (ref.mes - 1) + n;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function claveMes(ref: MesRef): string {
  return `${ref.anio}-${String(ref.mes).padStart(2, '0')}`;
}

export function parseClaveMes(clave: string): MesRef | null {
  const m = /^(\d{4})-(\d{2})$/.exec(clave);
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { anio: Number(m[1]), mes } : null;
}

export function fechaEnMes(ref: MesRef, dia: number): Fecha {
  const ultimo = new Date(Date.UTC(ref.anio, ref.mes, 0)).getUTCDate();
  return `${claveMes(ref)}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

export function diasEntre(desde: Fecha, hasta: Fecha): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function sumar(valores: readonly number[]): number {
  return valores.reduce((t, v) => t + v, 0);
}

/** Fecha local de hoy (`YYYY-MM-DD`) a partir de un reloj. */
export function fechaDe(ahora: Date): Fecha {
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
