import type { Fecha, MesRef, Pesos } from '../model';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
/** Signo menos tipografico, como en el diseño (`−$12.000`). */
export const MENOS = '−';

function miles(valor: number): string {
  return Math.trunc(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `$1.500.000`, `−$12.000`. Con `signo` los positivos llevan `+` (`+$3.500.000`). */
export function formatCop(valor: Pesos, opciones: { signo?: boolean } = {}): string {
  const abs = `$${miles(Math.abs(valor))}`;
  if (valor < 0) return `${MENOS}${abs}`;
  if (opciones.signo && valor > 0) return `+${abs}`;
  return abs;
}

/** Miles de pesos sin signo de moneda, para las tablas (`8.288.000` → `8.288.000`, en miles `8.288`). */
export function formatNumero(valor: Pesos): string {
  return (valor < 0 ? MENOS : '') + miles(Math.abs(valor));
}

export function formatMiles(valor: Pesos): string {
  return formatNumero(Math.round(valor / 1000));
}

export const MONTO_OCULTO = '$••••';

/** Entrada de montos: deja solo digitos. Devuelve el valor (null si esta vacio) y su texto formateado. */
export function parseMonto(texto: string): { valor: Pesos | null; texto: string } {
  const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) return { valor: null, texto: '' };
  const valor = Number(digitos);
  return { valor, texto: formatCop(valor) };
}

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? '';
}

export function nombreMesCapital(mes: number): string {
  const n = nombreMes(mes);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** `Octubre 2026` */
export function formatMesAnio(ref: MesRef): string {
  return `${nombreMesCapital(ref.mes)} ${ref.anio}`;
}

function partes(fecha: Fecha): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return { anio: anio!, mes: mes!, dia: dia! };
}

/** `26 oct` */
export function formatFechaCorta(fecha: Fecha): string {
  const { mes, dia } = partes(fecha);
  return `${dia} ${nombreMes(mes).slice(0, 3)}`;
}

/** `LUN 26` */
export function formatDiaSemana(fecha: Fecha): string {
  const { anio, mes, dia } = partes(fecha);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return `${DIAS[d.getUTCDay()]} ${dia}`;
}

/** `1,6% EM` */
export function formatTasa(tasaEM: number): string {
  return `${tasaEM.toString().replace('.', ',')}% EM`;
}

export function formatPorcentaje(valor: number): string {
  return `${valor.toString().replace('.', ',')}%`;
}
