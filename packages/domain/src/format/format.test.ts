import { describe, expect, it } from 'vitest';
import { formatCop, formatDiaSemana, formatFechaCorta, formatMesAnio, formatMiles, formatTasa, parseMonto } from '.';

describe('formatCop', () => {
  it('usa punto de miles y signo menos tipografico', () => {
    expect(formatCop(1500000)).toBe('$1.500.000');
    expect(formatCop(-12000)).toBe('−$12.000');
    expect(formatCop(0)).toBe('$0');
    expect(formatCop(3500000, { signo: true })).toBe('+$3.500.000');
  });

  it('formatea miles para las tablas', () => {
    expect(formatMiles(6288000)).toBe('6.288');
  });
});

describe('parseMonto', () => {
  it('formatea mientras se escribe y guarda el entero (spec steward-ui-shell)', () => {
    expect(parseMonto('2538000')).toEqual({ valor: 2538000, texto: '$2.538.000' });
  });

  it('acepta solo digitos', () => {
    expect(parseMonto('$2.5a38.000')).toEqual({ valor: 2538000, texto: '$2.538.000' });
    expect(parseMonto('')).toEqual({ valor: null, texto: '' });
    expect(parseMonto('00450')).toEqual({ valor: 450, texto: '$450' });
  });
});

describe('fechas', () => {
  it('formatea como el diseño', () => {
    expect(formatFechaCorta('2026-10-26')).toBe('26 oct');
    expect(formatDiaSemana('2026-10-26')).toBe('LUN 26');
    expect(formatMesAnio({ anio: 2026, mes: 10 })).toBe('Octubre 2026');
    expect(formatTasa(1.6)).toBe('1,6% EM');
  });
});
