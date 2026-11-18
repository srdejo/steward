/**
 * Tokens de Presupuesto Hogar, sistema "Libreta clara" (canvas del rediseño): los mismos valores que `@theme` en
 * frontend/src/styles.css. Papel claro, superficies sin bordes, un solo color de acción; Inter con cifras tabulares en la
 * UI y los montos, Space Grotesk en títulos y la cifra principal (design D1 y D2 de rediseno-libreta-clara).
 */
export const colors = {
  fondo: '#F6F5F1',
  superficie: '#FFFFFF',
  borde: '#E9E7E1',
  bordeCampo: '#DAD7CF',
  divisor: '#F0EEE9',
  hueco: '#EFEDE7',
  nota: '#F3F2EE',
  control: '#C9C6BD',
  texto: '#1A1D1A',
  textoSuave: '#4A4E48',
  secundario: '#63675F',
  acento: '#1F4D3B',
  acentoOscuro: '#163A2C',
  acentoSuave: '#EEF2EF',
  acentoElegido: '#E6EFEA',
  avatarSuave: '#DCE8E1',
  positivo: '#2F7A4F',
  negativo: '#B3261E',
  negativoSuave: '#FBE9E7',
  aviso: '#8A5200',
  avisoSuave: '#FBF1DC',
  diezmo: '#2C7A70',
  diezmoTexto: '#1E5E55',
  diezmoSuave: '#E3EFEC',
  velo: 'rgba(26, 29, 26, 0.45)',
  destacado: '#FBF7EC',
} as const;

export type ColorName = keyof typeof colors;

/** En React Native cada peso es una familia distinta. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'SpaceGrotesk_700Bold',
  displaySemibold: 'SpaceGrotesk_600SemiBold',
} as const;

export const radius = {
  control: 12,
  boton: 12,
  tarjeta: 16,
  panel: 20,
  hoja: 22,
  pill: 999,
} as const;

/** Zona tocable minima (spec steward-ui-shell). */
export const TOCABLE = 44;
