import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F } from '@/constants/colors';

const GOLD_BAR = '#d8b659';
const GOLD_FLAP = '#c89b3c';
const GREEN_BODY = '#2d4a39';
const LEAF_LIGHT = '#b9cbb2';
const LEAF_MID = '#9db89a';
const LEAF_DARK = '#8aa583';
const CREAM = '#f3f0e7';

interface Props {
  onFinish: () => void;
}

export function SplashAnimation({ onFinish }: Props) {
  const insets = useSafeAreaInsets();

  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(10)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY = useRef(new Animated.Value(10)).current;

  const barOpacity = useRef(new Animated.Value(0)).current;
  const barY = useRef(new Animated.Value(10)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 120 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true, easing: ease }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true, easing: ease }),
        Animated.timing(titleY, { toValue: 0, duration: 500, useNativeDriver: true, easing: ease }),
      ]),
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true, easing: ease }),
        Animated.timing(tagY, { toValue: 0, duration: 500, delay: 150, useNativeDriver: true, easing: ease }),
      ]),
      Animated.parallel([
        Animated.timing(barOpacity, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true, easing: ease }),
        Animated.timing(barY, { toValue: 0, duration: 500, delay: 100, useNativeDriver: true, easing: ease }),
        Animated.timing(footerOpacity, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true, easing: ease }),
        Animated.timing(barProgress, { toValue: 1, duration: 1600, delay: 100, useNativeDriver: false, easing: Easing.out(Easing.quad) }),
      ]),
    ]).start(() => {
      setTimeout(onFinish, 300);
    });
  }, []);

  const barWidth = barProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '62%'] });

  return (
    <LinearGradient
      colors={['#3f6650', '#2d4a39', '#23382b']}
      locations={[0, 0.55, 1]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={s.root}
    >
      <View style={[s.ring, { top: -90, right: -90 }]} />
      <View style={[s.ring2, { bottom: 120, left: -110 }]} />

      <View style={s.center}>
        <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <WalletIcon />
        </Animated.View>

        <Animated.Text style={[s.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          Steward
        </Animated.Text>

        <Animated.Text style={[s.tag, { opacity: tagOpacity, transform: [{ translateY: tagY }] }]}>
          Mayordomía que transforma
        </Animated.Text>
      </View>

      <Animated.View style={[s.barWrap, { opacity: barOpacity, transform: [{ translateY: barY }], bottom: 78 }]}>
        <View style={s.barTrack}>
          <Animated.View style={[s.barFill, { width: barWidth }]} />
        </View>
      </Animated.View>

      <Animated.Text style={[s.footer, { opacity: footerOpacity, bottom: 34 + insets.bottom }]}>
        Hecho para tus finanzas personales
      </Animated.Text>
    </LinearGradient>
  );
}

function WalletIcon() {
  return (
    <View style={s.iconWrap}>
      {/* Gold corner flap (back layer) */}
      <View style={s.goldFlap} />
      {/* Light green flap (second layer) */}
      <View style={s.greenFlap} />
      {/* Main wallet body */}
      <View style={s.walletBody}>
        {/* Right-side card pocket */}
        <View style={s.walletPocket}>
          <View style={s.walletCoin} />
        </View>
        {/* Vertical stem */}
        <View style={s.stem} />
        {/* Left leaf */}
        <View style={s.leafLeft} />
        {/* Right leaf */}
        <View style={s.leafRight} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d1e12',
    shadowOffset: { width: 0, height: 22 },
    shadowRadius: 50,
    shadowOpacity: 0.55,
    elevation: 20,
  },
  title: {
    fontSize: 38,
    fontFamily: 'Lora_700Bold',
    color: '#fff',
    marginTop: 28,
    letterSpacing: 0.4,
  },
  tag: {
    fontSize: 14,
    fontFamily: F.medium,
    color: '#c2d2b6',
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
    backgroundColor: GOLD_BAR,
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
  // Wallet icon (View-based, approximates the SVG design)
  iconWrap: {
    width: 64,
    height: 58,
  },
  goldFlap: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 26,
    height: 9,
    borderRadius: 4,
    backgroundColor: GOLD_FLAP,
    transform: [{ skewX: '-12deg' }],
  },
  greenFlap: {
    position: 'absolute',
    top: 7,
    left: 2,
    width: 34,
    height: 8,
    borderRadius: 3,
    backgroundColor: LEAF_LIGHT,
    transform: [{ skewX: '-8deg' }],
  },
  walletBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 42,
    borderRadius: 12,
    backgroundColor: GREEN_BODY,
    overflow: 'hidden',
  },
  walletPocket: {
    position: 'absolute',
    right: -1,
    top: 8,
    width: 22,
    height: 16,
    borderRadius: 8,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCoin: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN_BODY,
  },
  stem: {
    position: 'absolute',
    left: 18,
    top: 7,
    bottom: 5,
    width: 2.5,
    borderRadius: 2,
    backgroundColor: LEAF_MID,
  },
  leafLeft: {
    position: 'absolute',
    left: 5,
    top: 11,
    width: 15,
    height: 10,
    borderRadius: 7,
    backgroundColor: LEAF_LIGHT,
    transform: [{ rotate: '-20deg' }],
  },
  leafRight: {
    position: 'absolute',
    left: 18,
    top: 18,
    width: 15,
    height: 10,
    borderRadius: 7,
    backgroundColor: LEAF_DARK,
    transform: [{ rotate: '20deg' }],
  },
});
