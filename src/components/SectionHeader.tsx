import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '@/constants/colors';

interface Props {
  label: string;
  color?: string;
  onAdd?: () => void;
}

export function SectionHeader({ label, color = C.textDim, onAdd }: Props) {
  return (
    <View style={s.row}>
      <Text style={[s.label, { color }]}>{label}</Text>
      {onAdd ? (
        <TouchableOpacity onPress={onAdd} activeOpacity={0.7}>
          <Text style={s.add}>+ Agregar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  add: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: C.gold,
  },
});
