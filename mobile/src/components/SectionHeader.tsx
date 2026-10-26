import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, F } from '@/constants/colors';

interface Props {
  label: string;
  color?: string;
  onAdd?: () => void;
}

export function SectionHeader({ label, color = C.text3, onAdd }: Props) {
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
    fontFamily: F.bold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  add: {
    fontSize: 12,
    fontFamily: F.bold,
    color: C.primary,
  },
});
