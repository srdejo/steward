import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { Puertos } from '@steward/domain';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { avisarSiVieneDeLaV1 } from '@/data/acceso-nativo';
import { prepararPuertos, puertosListos } from '@/data/instancia';
import { DatosProvider } from '@/data/puertos';
import { SesionProvider, useSesion } from '@/data/sesion';
import { Aviso, Boton, colors } from '@/ui';
import { appFonts } from '@/ui/fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fuentes, errorFuentes] = useFonts(appFonts);
  const [puertos, setPuertos] = useState<Puertos | null>(puertosListos);
  useEffect(() => {
    if (!puertos) void prepararPuertos().then(setPuertos);
  }, [puertos]);
  if (!puertos) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.fondo }}>
      <SafeAreaProvider>
        <DatosProvider puertos={puertos}>
          <SesionProvider>
            <StatusBar style="dark" />
            <Navegacion lista={fuentes || !!errorFuentes} />
          </SesionProvider>
        </DatosProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Sin sesion: Acceso. Con sesion y el hogar sin configurar: el onboarding. Con el hogar
 * configurado: la app. La invitacion se abre siempre (spec steward-acceso-onboarding).
 */
function Navegacion({ lista }: { lista: boolean }) {
  const { cargando, sesion, errorCarga, recargar } = useSesion();
  const esperando = !lista || cargando;
  useEffect(() => {
    if (!esperando) SplashScreen.hide();
  }, [esperando]);
  const conSesion = !!sesion;
  useEffect(() => {
    if (conSesion) void avisarSiVieneDeLaV1();
  }, [conSesion]);
  if (esperando) return null;
  if (errorCarga && !sesion) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.fondo }}>
        <Aviso texto={errorCarga} />
        <Boton titulo="Reintentar" onPress={() => void recargar()} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.fondo } }}>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="acceso" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion && !sesion.hogarConfigurado}>
        <Stack.Screen name="onboarding/[paso]" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion?.hogarConfigurado}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="invitacion/[token]" />
    </Stack>
  );
}
