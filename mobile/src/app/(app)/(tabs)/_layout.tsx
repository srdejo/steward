import { Tabs } from 'expo-router';

import { colors, fonts, Icono } from '@/ui';

/** Barra inferior Hoy · Planear · Cuentas (HANDOFF, seccion 4). Ajustes se abre desde los avatares de Hoy. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.texto,
        tabBarInactiveTintColor: colors.secundario,
        tabBarStyle: { backgroundColor: colors.superficie, borderTopColor: colors.borde },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="hoy" options={{ title: 'Hoy', tabBarIcon: ({ color }) => <Icono nombre="hoy" color={color} /> }} />
      <Tabs.Screen name="planear" options={{ title: 'Planear', tabBarIcon: ({ color }) => <Icono nombre="planear" color={color} /> }} />
      <Tabs.Screen name="cuentas" options={{ title: 'Cuentas', tabBarIcon: ({ color }) => <Icono nombre="cuentas" color={color} /> }} />
    </Tabs>
  );
}
