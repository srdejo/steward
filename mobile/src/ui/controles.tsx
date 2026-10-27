import { Pressable, Switch, Text, View, type ColorValue } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { Texto } from './base';
import { colors, fonts, TOCABLE } from './tokens';

export interface Opcion<T> {
  valor: T;
  etiqueta: string;
}

/**
 * Seleccion entre pocas opciones como los artboards: botones de 48 px en cuadricula ("Daniel / Esposa") o,
 * con `chips`, pildoras de 40 px que se pueden dejar sin elegir ("Davivienda · Nu · Su cuenta").
 */
export function Segmentado<T extends string>({ etiqueta, opciones, valor, onCambio, chips, opcional }: { etiqueta?: string; opciones: Opcion<T>[]; valor: T | null; onCambio: (v: T | null) => void; chips?: boolean; opcional?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      {etiqueta ? <Texto v="rotulo">{etiqueta}</Texto> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={etiqueta} style={chips ? { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } : { flexDirection: 'row', gap: 8 }}>
        {opciones.map((o) => {
          const activa = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: activa }}
              onPress={() => onCambio(opcional && activa ? null : o.valor)}
              hitSlop={chips ? 4 : 0}
              style={{
                flex: chips ? undefined : 1, height: chips ? 40 : 48, paddingHorizontal: chips ? 14 : 8, borderRadius: chips ? 20 : 12,
                borderWidth: activa ? 2 : 1, borderColor: activa ? colors.acento : colors.borde, backgroundColor: activa ? colors.acentoSuave : colors.superficie,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: activa ? fonts.semibold : fonts.medium, fontSize: chips ? 14 : 15, color: activa ? colors.acento : colors.texto }}>{o.etiqueta}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Interruptor con su texto: "Aplicar diezmo", "Ocultar montos". */
export function Interruptor({ titulo, detalle, activo, onCambio }: { titulo: string; detalle?: string; activo: boolean; onCambio: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: TOCABLE }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Texto style={{ fontSize: 14, fontFamily: fonts.medium }}>{titulo}</Texto>
        {detalle ? <Texto v="detalle">{detalle}</Texto> : null}
      </View>
      <Switch accessibilityLabel={titulo} value={activo} onValueChange={onCambio} trackColor={{ true: colors.acento, false: colors.control }} thumbColor="#FFFFFF" />
    </View>
  );
}

const TRAZOS: Record<string, React.ReactNode> = {
  hoy: [<Circle key="c" cx="12" cy="12" r="8" />, <Path key="p" d="M12 8v4l3 2" />],
  planear: [<Rect key="r" x="4" y="5" width="16" height="15" rx="2" />, <Path key="p" d="M4 10h16M9 3v4M15 3v4" />],
  cuentas: [<Rect key="r" x="3" y="6" width="18" height="13" rx="2" />, <Path key="p" d="M3 10h18" />],
  candado: [<Rect key="r" x="5" y="11" width="14" height="9" rx="2" />, <Path key="p" d="M8 11V8a4 4 0 0 1 8 0v3" />],
  rostro: [<Path key="a" d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />, <Path key="b" d="M9 9v1M15 9v1M12 9v4h-1M9.5 16c1.5 1 3.5 1 5 0" />],
  casa: [<Path key="a" d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />, <Path key="b" d="M9 20v-5h6v5" />],
};

/** Iconos de trazo de los artboards (24×24, trazo 1.8). Decorativos. */
export function Icono({ nombre, tamano = 22, color = colors.texto }: { nombre: string; tamano?: number; color?: ColorValue }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {TRAZOS[nombre]}
    </Svg>
  );
}
