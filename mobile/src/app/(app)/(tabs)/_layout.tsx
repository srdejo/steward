import { router, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors, fonts, Icono } from '@/ui';

/**
 * Barra inferior de cinco espacios: Hoy · Planear · + · Cuentas · Ajustes (spec steward-ui-shell, "Navegación principal";
 * rediseno-libreta-clara). El + no es una pantalla: abre la hoja Agregar sobre la pestaña actual.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.acento,
        tabBarInactiveTintColor: colors.secundario,
        tabBarStyle: { backgroundColor: colors.superficie, borderTopColor: colors.borde },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="hoy" options={{ title: 'Hoy', tabBarIcon: ({ color }) => <Icono nombre="hoy" color={color} /> }} />
      <Tabs.Screen name="planear" options={{ title: 'Planear', tabBarIcon: ({ color }) => <Icono nombre="planear" color={color} /> }} />
      <Tabs.Screen
        name="nuevo"
        options={{
          title: 'Agregar',
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Pressable
                testID="agregar"
                accessibilityRole="button"
                accessibilityLabel="Agregar gasto, aporte o pago"
                onPress={() => router.push('/agregar')}
                style={{ marginTop: -18, width: 52, height: 52, borderRadius: 26, borderWidth: 4, borderColor: colors.fondo, backgroundColor: colors.acento, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icono nombre="mas" color={colors.superficie} tamano={24} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="cuentas" options={{ title: 'Cuentas', tabBarIcon: ({ color }) => <Icono nombre="cuentas" color={color} /> }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: ({ color }) => <Icono nombre="ajustes" color={color} /> }} />
    </Tabs>
  );
}
