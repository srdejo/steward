import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
  Roboto_900Black,
} from '@expo-google-fonts/roboto';
import {
  RobotoMono_400Regular,
  RobotoMono_500Medium,
  RobotoMono_700Bold,
} from '@expo-google-fonts/roboto-mono';
import { Lora_700Bold } from '@expo-google-fonts/lora';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppTabs from '@/components/app-tabs';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { SplashAnimation } from '@/components/SplashAnimation';
import { BudgetProvider, useBudget } from '@/store/budget';
import { C } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { ready, state } = useBudget();
  const [splashDone, setSplashDone] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  // Muestra el splash animado la primera vez que abre la app
  if (!splashDone) {
    return <SplashAnimation onFinish={() => setSplashDone(true)} />;
  }

  if (!state.onboarded) return <OnboardingScreen />;
  return <AppTabs />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Roboto_900Black,
    RobotoMono_400Regular,
    RobotoMono_500Medium,
    RobotoMono_700Bold,
    Lora_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <BudgetProvider>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <StatusBar style="dark" />
          <AppContent />
        </View>
      </BudgetProvider>
    </SafeAreaProvider>
  );
}
