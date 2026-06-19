import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { StatusBar } from 'expo-status-bar';

import AppTabs from '@/components/app-tabs';
import { BudgetProvider, useBudget } from '@/store/budget';
import { C } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { ready } = useBudget();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  return <AppTabs />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    InstrumentSerif_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <BudgetProvider>
      <View style={{ flex: 1, backgroundColor: C.bg1 }}>
        <StatusBar style="light" />
        <AppContent />
      </View>
    </BudgetProvider>
  );
}
