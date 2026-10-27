import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, Texto } from './base';
import { colors, fonts } from './tokens';

/** Pantalla con scroll, fondo y margenes de los artboards (padding 24/20). Con `demo` muestra el aviso de datos de prueba. */
export function Pantalla({ children, demo = true, style, testID }: { children: ReactNode; demo?: boolean; style?: StyleProp<ViewStyle>; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.fondo, paddingTop: insets.top }} testID={testID}>
      {demo ? <AvisoDemo /> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 20 }, style]}>
        {children}
      </ScrollView>
    </View>
  );
}

export function AvisoDemo() {
  return (
    <View style={{ backgroundColor: colors.avisoSuave, paddingVertical: 6, paddingHorizontal: 16 }} accessibilityRole="text" testID="aviso-demo">
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.aviso, textAlign: 'center' }}>Datos de prueba · se guardan solo en este dispositivo</Text>
    </View>
  );
}

/** Encabezado de los artboards: "‹ Volver", rotulo y titulo grande; lo de la derecha como hijos. */
export function Encabezado({ titulo, rotulo, rotuloColor, volver, volverTexto = 'Volver', children }: { titulo: string; rotulo?: string; rotuloColor?: string; volver?: string | (() => void); volverTexto?: string; children?: ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      {volver ? (
        <Boton tipo="texto" titulo={`‹ ${volverTexto}`} onPress={() => (typeof volver === 'string' ? volverA(volver) : volver())} style={{ alignSelf: 'flex-start', minHeight: 36 }} />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1, gap: 2 }}>
          {rotulo ? <Texto v="rotulo" style={rotuloColor ? { color: rotuloColor } : undefined}>{rotulo}</Texto> : null}
          <Texto v="titulo" accessibilityRole="header">{titulo}</Texto>
        </View>
        {children}
      </View>
    </View>
  );
}

/** Vuelve atras si hay de donde (lo normal) o va a `respaldo` si la pantalla se abrio directo (enlace, prueba). */
export function volverA(respaldo: string): void {
  if (router.canGoBack()) router.back();
  else router.replace(respaldo as never);
}

/** Cierra una hoja de registro de Hoy. */
export function cerrarHoja(): void {
  volverA('/hoy');
}

/** Hoja de registro (formSheet): titulo, "Cancelar" y contenido, como Aporte/Pagar/Gasto.dc.html. */
export function Hoja({ titulo, antetitulo, antetituloColor, subtitulo, children }: { titulo: string; antetitulo?: string; antetituloColor?: string; subtitulo?: ReactNode; children: ReactNode }) {
  return (
    <ScrollView style={{ backgroundColor: colors.superficie }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1, gap: 4 }}>
          {antetitulo ? <Texto v="rotulo" style={antetituloColor ? { color: antetituloColor } : undefined}>{antetitulo}</Texto> : null}
          <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{titulo}</Texto>
          {subtitulo}
        </View>
        <Boton tipo="enlace" titulo="Cancelar" onPress={cerrarHoja} />
      </View>
      {children}
    </ScrollView>
  );
}
