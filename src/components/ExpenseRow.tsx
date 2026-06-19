import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '@/constants/colors';

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
        {sub ? <Text style={[s.sub, { color: subColor ?? C.textMuted }]}>{sub}</Text> : null}
      </TouchableOpacity>
      <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
        <Text style={[s.amount, { color: amountColor ?? (paid ? C.textDim : C.textPrimary) }]}>{amountFmt}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.circle, paid && s.circlePaid]} onPress={onToggle} activeOpacity={0.7} hitSlop={8}>
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
    borderBottomColor: C.border,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: C.textPrimary,
    lineHeight: 18,
  },
  namePaid: {
    color: '#6c6860',
    textDecorationLine: 'line-through',
  },
  sub: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    marginTop: 4,
  },
  amount: {
    fontSize: 13,
    fontFamily: 'SpaceMono_700Bold',
  },
  circle: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(200,168,106,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  circlePaid: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  check: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#1a1408',
  },
});
