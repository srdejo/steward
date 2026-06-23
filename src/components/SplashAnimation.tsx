import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F } from '@/constants/colors';

interface Props {
  onFinish: () => void;
}

export function SplashAnimation({ onFinish }: Props) {
  const insets = useSafeAreaInsets();

  // Card: pop in
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Title + tagline: fade up
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(10)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY = useRef(new Animated.Value(10)).current;

  // Bar + footer: fade up
  const barOpacity = useRef(new Animated.Value(0)).current;
  const barY = useRef(new Animated.Value(10)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.sequence([
      // Card pop in (0ms)
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 120 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true, easing: ease }),
      ]),
      // Title fade up (after card = ~500ms)
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true, easing: ease }),
        Animated.timing(titleY, { toValue: 0, duration: 500, useNativeDriver: true, easing: ease }),
      ]),
      // Tagline (+150ms)
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true, easing: ease }),
        Animated.timing(tagY, { toValue: 0, duration: 500, delay: 150, useNativeDriver: true, easing: ease }),
      ]),
      // Bar + footer (+100ms)
      Animated.parallel([
        Animated.timing(barOpacity, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true, easing: ease }),
        Animated.timing(barY, { toValue: 0, duration: 500, delay: 100, useNativeDriver: true, easing: ease }),
        Animated.timing(footerOpacity, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true, easing: ease }),
        // Bar fill (no nativeDriver — width animation)
        Animated.timing(barProgress, { toValue: 1, duration: 1600, delay: 100, useNativeDriver: false, easing: Easing.out(Easing.quad) }),
      ]),
    ]).start(() => {
      // Pequeña pausa antes de revelar la app
      setTimeout(onFinish, 300);
    });
  }, []);

  const barWidth = barProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '62%'] });

  return (
    <View style={s.root}>
      {/* Destellos de fondo */}
      <View style={[s.ring, { top: -90, right: -90 }]} />
      <View style={[s.ring2, { bottom: 120, left: -110 }]} />

      {/* Centro */}
      <View style={s.center}>
        {/* Tarjeta icono */}
        <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <WalletIcon />
        </Animated.View>

        {/* Título */}
        <Animated.Text style={[s.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          Presupuesto
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[s.tag, { opacity: tagOpacity, transform: [{ translateY: tagY }] }]}>
          Tu mes, bajo control
        </Animated.Text>
      </View>

      {/* Barra de carga */}
      <Animated.View style={[s.barWrap, { opacity: barOpacity, transform: [{ translateY: barY }], bottom: 78 }]}>
        <View style={s.barTrack}>
          <Animated.View style={[s.barFill, { width: barWidth }]} />
        </View>
      </Animated.View>

      {/* Footer */}
      <Animated.Text style={[s.footer, { opacity: footerOpacity, bottom: 34 + insets.bottom }]}>
        Hecho para tus finanzas personales
      </Animated.Text>
    </View>
  );
}

// Ícono billetera construido con Views (sin react-native-svg)
function WalletIcon() {
  return (
    <View style={s.iconWrap}>
      {/* Cuerpo principal */}
      <View style={s.walletBody}>
        {/* Tapa superior */}
        <View style={s.walletFlap} />
        {/* Bolsillo */}
        <View style={s.walletPocket}>
          <View style={s.walletCoin} />
        </View>
      </View>
    </View>
  );
}

const BLUE = '#2563eb';

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ring2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  center: {
    alignItems: 'center',
    marginBottom: 40,
  },
  card: {
    width: 128,
    height: 128,
    borderRadius: 34,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(13,40,90,0.6)',
    shadowOffset: { width: 0, height: 22 },
    shadowRadius: 50,
    shadowOpacity: 1,
    elevation: 20,
  },
  title: {
    fontSize: 30,
    fontFamily: F.black,
    color: '#fff',
    marginTop: 28,
    letterSpacing: -0.3,
  },
  tag: {
    fontSize: 14,
    fontFamily: F.medium,
    color: '#cfddff',
    marginTop: 11,
  },
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  barTrack: {
    width: 140,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#fff',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: F.medium,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.6)',
  },
  // Wallet icon (View-based approximation)
  iconWrap: {
    width: 60,
    height: 44,
    position: 'relative',
  },
  walletBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 34,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: 'transparent',
  },
  walletFlap: {
    position: 'absolute',
    top: -12,
    left: 6,
    right: 0,
    height: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 2,
    borderColor: BLUE,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  walletPocket: {
    position: 'absolute',
    right: -1,
    top: 7,
    width: 22,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCoin: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: BLUE,
  },
});
