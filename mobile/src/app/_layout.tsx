import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { puertosDeLaApp } from '@/data/instancia';
import { DatosProvider } from '@/data/puertos';
import { SesionProvider, useSesion } from '@/data/sesion';
import { colors } from '@/ui';
import { appFonts } from '@/ui/fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fuentes, errorFuentes] = useFonts(appFonts);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.fondo }}>
      <SafeAreaProvider>
        <DatosProvider puertos={puertosDeLaApp()}>
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
 * Sin sesion: Acceso. Con sesion y el hogar sin configurar: Activar Face ID y el onboarding. Con el hogar
 * configurado: la app. La invitacion se abre siempre (spec steward-acceso-onboarding).
 */
function Navegacion({ lista }: { lista: boolean }) {
  const { cargando, sesion } = useSesion();
  const esperando = !lista || cargando;
  useEffect(() => {
    if (!esperando) SplashScreen.hide();
  }, [esperando]);
  if (esperando) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.fondo } }}>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="acceso" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion && !sesion.hogarConfigurado}>
        <Stack.Screen name="face-id" />
        <Stack.Screen name="onboarding/[paso]" />
      </Stack.Protected>
      <Stack.Protected guard={!!sesion?.hogarConfigurado}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="invitacion/[token]" />
    </Stack>
  );
}
