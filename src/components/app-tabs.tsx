import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconsName, focused: boolean) {
  return <Ionicons name={name} size={22} color={focused ? C.gold : '#6f6b62'} />;
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(18,19,23,0.96)',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: '#6f6b62',
        tabBarLabelStyle: {
          fontFamily: 'Manrope_600SemiBold',
          fontSize: 10,
          letterSpacing: 0.4,
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
          title: 'Deudas',
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
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
