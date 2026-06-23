import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import { C, F } from '@/constants/colors';

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
          <TabTrigger name="movimientos" href="/movimientos" asChild>
            <TabButton>Movimientos</TabButton>
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
    backgroundColor: C.bg,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 40,
    gap: 4,
    maxWidth: 640,
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    shadowOpacity: 0.08,
    elevation: 4,
  },
  brand: {
    fontFamily: F.bold,
    fontSize: 16,
    color: C.primary,
    marginRight: 'auto',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  chipActive: {
    backgroundColor: C.primaryBg,
  },
  chipText: {
    fontSize: 13,
    fontFamily: F.medium,
    color: C.text3,
  },
  chipTextActive: {
    color: C.primary,
    fontFamily: F.bold,
  },
  pressed: { opacity: 0.7 },
});
