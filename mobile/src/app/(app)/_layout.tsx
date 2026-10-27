import { Stack } from 'expo-router';

import { colors } from '@/ui';

const hoja = { presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true, sheetCornerRadius: 22 } as const;

/** Con sesion: las pestañas y, encima, las pantallas de detalle y las hojas de registro (formSheet). */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.fondo } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="aporte" options={hoja} />
      <Stack.Screen name="pagar/[itemId]" options={hoja} />
      <Stack.Screen name="gasto" options={hoja} />
    </Stack>
  );
}
