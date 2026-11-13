import { formatCop, MONTO_OCULTO, parseMonto, type Pesos } from '@steward/domain';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, Text, TextInput, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { useSesion } from '@/data/sesion';
import { colors, fonts, radius, TOCABLE } from './tokens';

type Variante = 'titulo' | 'tituloGrande' | 'subtitulo' | 'cuerpo' | 'detalle' | 'rotulo' | 'pequeno';

const VARIANTES: Record<Variante, TextStyle> = {
  tituloGrande: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, color: colors.texto },
  titulo: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: colors.texto },
  subtitulo: { fontFamily: fonts.semibold, fontSize: 16, color: colors.texto },
  cuerpo: { fontFamily: fonts.regular, fontSize: 15, color: colors.texto },
  detalle: { fontFamily: fonts.regular, fontSize: 12, color: colors.secundario },
  rotulo: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.96, color: colors.secundario, textTransform: 'uppercase' },
  pequeno: { fontFamily: fonts.regular, fontSize: 13, color: colors.secundario },
};

/** Texto con las variantes de los artboards. */
export function Texto({ v = 'cuerpo', style, ...props }: TextProps & { v?: Variante }) {
  return <Text {...props} style={[VARIANTES[v], style]} />;
}

/** Face ID y "Ocultar montos" llegan con passkeys: hasta entonces no se ofrecen ni aplican (spec steward-ajustes). */
export const SEGURIDAD_DISPONIBLE = false as boolean;

/** Monto en COP con JetBrains Mono. Con "Ocultar montos" se ve `$••••` hasta tocarlo. */
export function Monto({ valor, signo, style, siempreVisible, testID }: { valor: Pesos; signo?: boolean; style?: StyleProp<TextStyle>; siempreVisible?: boolean; testID?: string }) {
  const { preferencias } = useSesion();
  const [revelado, setRevelado] = useState(false);
  const oculto = SEGURIDAD_DISPONIBLE && preferencias.ocultarMontos && !revelado && !siempreVisible;
  const estilo = [{ fontFamily: fonts.mono, fontSize: 14, color: colors.texto }, style];
  if (oculto) {
    return (
      <Text testID={testID} style={estilo} onPress={() => setRevelado(true)} accessibilityRole="button" accessibilityLabel="Mostrar monto" suppressHighlighting>
        {MONTO_OCULTO}
      </Text>
    );
  }
  return (
    <Text testID={testID} style={estilo}>
      {formatCop(valor, { signo })}
    </Text>
  );
}

/** Campo de monto: solo digitos, se formatea en COP mientras se escribe (spec steward-ui-shell). */
export function MontoInput({ etiqueta, valor, onCambio, grande, ayuda, placeholder = '$0', testID }: { etiqueta: string; valor: Pesos | null; onCambio: (v: Pesos | null) => void; grande?: boolean; ayuda?: string; placeholder?: string; testID?: string }) {
  const [texto, setTexto] = useState(valor === null ? '' : formatCop(valor));
  useEffect(() => {
    if (parseMonto(texto).valor !== valor) setTexto(valor === null ? '' : formatCop(valor));
    // Solo cuando cambia el valor desde fuera (prellenado con el plan).
  }, [valor]);
  const teclado = useCerrarTeclado(true);
  return (
    <View style={{ gap: 8 }}>
      <Texto v="rotulo">{etiqueta}</Texto>
      <TextInput
        testID={testID}
        accessibilityLabel={etiqueta}
        keyboardType="number-pad"
        inputAccessoryViewID={teclado.id}
        value={texto}
        placeholder={placeholder}
        placeholderTextColor={colors.secundario}
        onChangeText={(t) => {
          const r = parseMonto(t);
          setTexto(r.texto);
          onCambio(r.valor);
        }}
        style={{
          height: grande ? 64 : 48, borderRadius: radius.boton, borderWidth: 1, borderColor: colors.borde, backgroundColor: colors.fondo,
          paddingHorizontal: 16, fontFamily: fonts.monoSemibold, fontSize: grande ? 28 : 16, color: colors.texto,
        }}
      />
      {teclado.barra}
      {ayuda ? <Texto v="detalle">{ayuda}</Texto> : null}
    </View>
  );
}

export function Campo({ etiqueta, valor, onCambio, placeholder, teclado, testID }: { etiqueta: string; valor: string; onCambio: (t: string) => void; placeholder?: string; teclado?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad'; testID?: string }) {
  const cerrar = useCerrarTeclado(teclado === 'number-pad' || teclado === 'decimal-pad');
  return (
    <View style={{ gap: 8 }}>
      <Texto v="rotulo">{etiqueta}</Texto>
      <TextInput
        testID={testID}
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={onCambio}
        placeholder={placeholder}
        placeholderTextColor={colors.secundario}
        keyboardType={teclado ?? 'default'}
        inputAccessoryViewID={cerrar.id}
        autoCapitalize={teclado === 'email-address' ? 'none' : 'sentences'}
        style={{ height: 52, borderRadius: radius.tarjeta, borderWidth: 1, borderColor: colors.bordeCampo, backgroundColor: colors.superficie, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 16, color: colors.texto }}
      />
      {cerrar.barra}
    </View>
  );
}

type TipoBoton = 'primario' | 'secundario' | 'atras' | 'enlace' | 'texto' | 'peligro';

/** Botones de los artboards. Primario y secundario de 52 px; enlace y texto con zona tocable de 44 px. */
export function Boton({ titulo, onPress, tipo = 'primario', deshabilitado, style, icono, testID }: { titulo: string; onPress: () => void; tipo?: TipoBoton; deshabilitado?: boolean; style?: StyleProp<ViewStyle>; icono?: ReactNode; testID?: string }) {
  const fondo: Record<TipoBoton, string> = { primario: colors.acento, secundario: colors.superficie, atras: colors.hueco, enlace: 'transparent', texto: 'transparent', peligro: colors.negativo };
  const colorTexto = tipo === 'primario' || tipo === 'peligro' ? '#FFFFFF' : tipo === 'enlace' || tipo === 'texto' ? colors.acento : colors.texto;
  const conCaja = tipo === 'primario' || tipo === 'secundario' || tipo === 'atras' || tipo === 'peligro';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      hitSlop={conCaja ? undefined : 8}
      style={({ pressed }) => [
        {
          minHeight: conCaja ? 52 : TOCABLE, borderRadius: 14, backgroundColor: fondo[tipo], flexDirection: 'row', gap: 8,
          alignItems: 'center', justifyContent: tipo === 'texto' ? 'flex-start' : 'center', paddingHorizontal: conCaja ? 16 : 0,
          borderWidth: tipo === 'secundario' ? 1 : 0, borderColor: colors.control, opacity: deshabilitado ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icono}
      <Text style={{ fontFamily: conCaja ? fonts.semibold : tipo === 'texto' ? fonts.semibold : fonts.medium, fontSize: conCaja ? 16 : 14, color: colorTexto }}>{titulo}</Text>
    </Pressable>
  );
}

/** Fila de lista: titulo de 15 px y detalle de 12 px a la izquierda, lo de la derecha como hijos. */
export function Fila({ titulo, detalle, tonoDetalle, children, onPress, ultima, testID }: { titulo: string; detalle?: string; tonoDetalle?: string; children?: ReactNode; onPress?: () => void; ultima?: boolean; testID?: string }) {
  const contenido = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, minHeight: TOCABLE, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: colors.divisor }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Texto numberOfLines={1}>{titulo}</Texto>
        {detalle ? <Texto v="detalle" style={tonoDetalle ? { color: tonoDetalle } : undefined}>{detalle}</Texto> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{children}</View>
    </View>
  );
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress}>
      {contenido}
    </Pressable>
  ) : (
    <View testID={testID}>{contenido}</View>
  );
}

export function Tarjeta({ children, style, punteada }: { children: ReactNode; style?: StyleProp<ViewStyle>; punteada?: boolean }) {
  return (
    <View style={[{ backgroundColor: colors.superficie, borderRadius: radius.panel, borderWidth: 1, borderColor: punteada ? colors.control : colors.borde, borderStyle: punteada ? 'dashed' : 'solid', padding: 18, gap: 12 }, style]}>
      {children}
    </View>
  );
}

export function Avatar({ inicial, variante = 'fuerte', tamano = 32, nombre, style }: { inicial: string; variante?: 'fuerte' | 'suave'; tamano?: number; nombre?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessible={!!nombre}
      accessibilityLabel={nombre}
      style={[{ width: tamano, height: tamano, borderRadius: tamano / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: variante === 'fuerte' ? colors.acento : colors.avatarSuave }, style]}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: tamano * 0.42, color: variante === 'fuerte' ? '#FFFFFF' : colors.acento }}>{inicial}</Text>
    </View>
  );
}

/** Cifra pequeña con su rotulo. Con `enfasis` ("Falta pagar"), rotulo y cifra en negrita y el color solo en el rotulo (Main.dc.html). */
export function Kpi({ etiqueta, valor, color, enfasis, testID }: { etiqueta: string; valor: Pesos; color?: string; enfasis?: boolean; testID?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }} testID={testID}>
      <Texto style={{ fontSize: 11, color: enfasis ? (color ?? colors.secundario) : colors.secundario, fontFamily: enfasis ? fonts.semibold : fonts.regular }}>{etiqueta}</Texto>
      <Monto valor={valor} style={{ fontSize: enfasis ? 14 : 13, color: enfasis ? colors.texto : (color ?? colors.texto), fontFamily: enfasis ? fonts.monoSemibold : fonts.mono }} />
    </View>
  );
}

export function Aviso({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <Texto accessibilityRole="alert" style={{ fontSize: 14, color: colors.negativo }}>
      {texto}
    </Texto>
  );
}

/**
 * Barra "Listo" encima del teclado numerico de iOS, que no trae tecla para cerrarse.
 * Devuelve el id para `inputAccessoryViewID` y la vista; en Android no hace nada.
 */
function useCerrarTeclado(activo: boolean): { id: string | undefined; barra: ReactNode } {
  const id = `teclado-${useId().replace(/:/g, '')}`;
  if (Platform.OS !== 'ios' || !activo) return { id: undefined, barra: null };
  return {
    id,
    barra: (
      <InputAccessoryView nativeID={id}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: colors.hueco, borderTopWidth: 1, borderTopColor: colors.borde, paddingHorizontal: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={{ minHeight: TOCABLE, justifyContent: 'center', paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.acento }}>Listo</Text>
          </Pressable>
        </View>
      </InputAccessoryView>
    ),
  };
}
