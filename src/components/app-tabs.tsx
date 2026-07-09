import { C, F } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconsName, focused: boolean) {
  return <Ionicons name={name} size={22} color={focused ? C.primary : C.text3} />;
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.navBg,
          borderTopColor: C.border2,
          borderTopWidth: 1,
          height: (Platform.OS === 'ios' ? 60 : 52) + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.text3,
        tabBarLabelStyle: {
          fontFamily: F.bold,
          fontSize: 10,
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mes',
          tabBarIcon: ({ focused }) => tabIcon('calendar-outline', focused),
        }}
      />
      <Tabs.Screen
        name="cuentas"
        options={{
          title: 'Cuentas',
          tabBarIcon: ({ focused }) => tabIcon('card-outline', focused),
        }}
      />
      <Tabs.Screen
        name="movimientos"
        options={{
          title: 'Movim.',
          tabBarIcon: ({ focused }) => tabIcon('swap-horizontal-outline', focused),
        }}
      />
      <Tabs.Screen
        name="deudas"
        options={{
          title: 'Créditos',
          tabBarIcon: ({ focused }) => tabIcon('business-outline', focused),
        }}
      />
      <Tabs.Screen
        name="ingresos"
        options={{
          title: 'Ingresos',
          tabBarIcon: ({ focused }) => tabIcon('arrow-down-circle-outline', focused),
        }}
      />
    </Tabs>
  );
}
