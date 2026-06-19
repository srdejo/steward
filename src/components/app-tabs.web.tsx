import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import { C } from '@/constants/colors';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="mes" href="/" asChild>
            <TabButton>Mes</TabButton>
          </TabTrigger>
          <TabTrigger name="cuentas" href="/cuentas" asChild>
            <TabButton>Cuentas</TabButton>
          </TabTrigger>
          <TabTrigger name="deudas" href="/deudas" asChild>
            <TabButton>Deudas</TabButton>
          </TabTrigger>
          <TabTrigger name="ingresos" href="/ingresos" asChild>
            <TabButton>Ingresos</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && s.pressed}>
      <View style={[s.chip, isFocused && s.chipActive]}>
        <Text style={[s.chipText, isFocused && s.chipTextActive]}>{children}</Text>
      </View>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={s.bar}>
      <View style={s.inner}>
        <Text style={s.brand}>Steward</Text>
        {props.children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg2,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 40,
    gap: 4,
    maxWidth: 600,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  brand: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 16,
    color: C.gold,
    marginRight: 'auto',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  chipActive: {
    backgroundColor: 'rgba(200,168,106,0.15)',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: C.textSecondary,
  },
  chipTextActive: {
    color: C.gold,
    fontFamily: 'Manrope_600SemiBold',
  },
  pressed: { opacity: 0.7 },
});
