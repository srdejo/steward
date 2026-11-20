import type { ItemPlan } from '../model';
import { ReglaError } from './base';

export const MAX_ENLACE_PAGO = 500;
export const MAX_CODIGO_PAGO = 60;

export type DatosPago = Pick<ItemPlan, 'enlacePago' | 'codigoPago'>;

/**
 * Datos de pago de un gasto (design D3 y D4 de gastos-datos-pago): `undefined` = sin indicar (se conserva lo guardado),
 * `null` o vacio = quitarlo. El enlace solo http(s), sin espacios, hasta 500; el codigo hasta 60.
 */
export function datosPagoValidos(item: DatosPago): DatosPago {
  const fuera: DatosPago = {};
  if (item.enlacePago !== undefined) {
    const e = (item.enlacePago ?? '').trim();
    if (e && (!/^https?:\/\/\S+$/i.test(e) || e.length > MAX_ENLACE_PAGO)) throw new ReglaError('DATOS_INVALIDOS', 'El enlace de pago debe empezar por https://');
    fuera.enlacePago = e || null;
  }
  if (item.codigoPago !== undefined) {
    const c = (item.codigoPago ?? '').trim();
    if (c.length > MAX_CODIGO_PAGO) throw new ReglaError('DATOS_INVALIDOS', 'El código de pago es muy largo');
    fuera.codigoPago = c || null;
  }
  return fuera;
}

/** Un gasto tiene enlace o codigo de pago. */
export function tieneDatosPago(item: DatosPago): boolean {
  return !!(item.enlacePago || item.codigoPago);
}
