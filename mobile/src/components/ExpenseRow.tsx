import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, F } from '@/constants/colors';

interface Props {
  name: string;
  amountFmt: string;
  paid: boolean;
  sub?: string;
  subColor?: string;
  amountColor?: string;
  onToggle: () => void;
  onEdit?: () => void;
}

export function ExpenseRow({ name, amountFmt, paid, sub, subColor, amountColor, onToggle, onEdit }: Props) {
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.info} onPress={onEdit} activeOpacity={0.7}>
        <Text style={[s.name, paid && s.namePaid]}>{name}</Text>
        {sub ? <Text style={[s.sub, { color: subColor ?? C.text3 }]}>{sub}</Text> : null}
      </TouchableOpacity>
      <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
        <Text style={[s.amount, { color: amountColor ?? (paid ? C.text4 : C.text) }]}>{amountFmt}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.circle, paid && s.circlePaid]}
        onPress={onToggle}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        {paid ? <Text style={s.check}>✓</Text> : null}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border2,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontFamily: F.medium, color: C.text, lineHeight: 18 },
  namePaid: { color: '#6c6860', textDecorationLine: 'line-through' },
  sub: { fontSize: 11, fontFamily: F.regular, marginTop: 4 },
  amount: { fontSize: 13, fontFamily: F.monoBold },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#dfe3ea',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  circlePaid: { backgroundColor: '#e8e8e8', borderColor: '#d0d0d0' },
  check: { fontSize: 12, fontFamily: F.bold, color: '#6c6860' },
});
