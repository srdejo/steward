/**
 * Tokens de Presupuesto Hogar (HANDOFF.md, "Tokens visuales"): los mismos valores que `@theme` en
 * frontend/src/styles.css. Un solo acento, sin sombras; Inter en la UI y JetBrains Mono en los montos.
 */
export const colors = {
  fondo: '#FAFAF7',
  superficie: '#FFFFFF',
  borde: '#E7E6E1',
  bordeCampo: '#E2E1DC',
  divisor: '#EFEEEA',
  hueco: '#EFEEE9',
  nota: '#F4F3EF',
  control: '#C9C8C2',
  texto: '#1B1C1A',
  textoSuave: '#3B3D39',
  secundario: '#5F625C',
  acento: '#2E4A3B',
  acentoOscuro: '#1F3328',
  acentoSuave: '#EEF3EF',
  avatarSuave: '#D8E3DA',
  positivo: '#2E6B45',
  negativo: '#A3361F',
  aviso: '#8A5A00',
  avisoSuave: '#FBF3E2',
  diezmo: '#1E5A4C',
  diezmoTexto: '#3D5A52',
  diezmoSuave: '#EAF2EE',
  velo: 'rgba(58, 59, 56, 0.8)',
  destacado: '#FBF7EC',
} as const;

export type ColorName = keyof typeof colors;

/** En React Native cada peso es una familia distinta. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;

export const radius = {
  control: 10,
  boton: 12,
  tarjeta: 14,
  panel: 16,
  hoja: 22,
  pill: 999,
} as const;

/** Zona tocable minima (spec steward-ui-shell). */
export const TOCABLE = 44;
