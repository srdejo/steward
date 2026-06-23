import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { fmt, selectCurrentBudget, useBudget } from '@/store/budget';
import type { MovType } from '@/types';

function movGlyph(type: MovType): string {
  if (type === 'transfer') return '⇄';
  if (type === 'retiro') return '↓';
  return '✓';
}
function movColor(type: MovType): string {
  if (type === 'transfer') return C.primary;
  if (type === 'retiro') return C.text3;
  return C.green;
}
function movBg(type: MovType): string {
  if (type === 'transfer') return C.primaryBg;
  if (type === 'retiro') return C.surface2;
  return C.greenBg;
}

export default function MovimientosScreen() {
  const { state, dispatch } = useBudget();
  const budget = selectCurrentBudget(state);
  const accounts = budget?.accounts ?? [];
  const movimientos = budget?.movimientos ?? [];

  return (
    <View style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <View style={s.topPad}>
            <Text style={s.eyebrow}>Trazabilidad</Text>
            <Text style={s.title}>Movimientos del mes</Text>
          </View>
        </SafeAreaView>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.actionPrimary}
            onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'mov', mode: 'add', type: 'transfer', name: '', a1: '', from: accounts[0]?.name ?? '', to: 'Efectivo' } })}
            activeOpacity={0.7}>
            <Text style={s.actionPrimaryText}>⇄  Mover dinero</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionSecondary}
            onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'mov', mode: 'add', type: 'retiro', name: '', a1: '', from: accounts[0]?.name ?? '', to: 'Efectivo' } })}
            activeOpacity={0.7}>
            <Text style={s.actionSecondaryText}>↓  Retirar</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Historial</Text>

          {movimientos.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>Aún no hay movimientos</Text>
              <Text style={s.emptyHint}>Mueve o retira dinero, o paga un gasto desde una cuenta, y aparecerá aquí.</Text>
            </View>
          ) : (
            movimientos.map((mv) => (
              <View key={mv.id} style={s.movRow}>
                <View style={[s.movIconBox, { backgroundColor: movBg(mv.type) }]}>
                  <Text style={[s.movGlyph, { color: movColor(mv.type) }]}>{movGlyph(mv.type)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.movDesc}>{mv.desc}</Text>
                  <Text style={s.movMeta}>{mv.meta}</Text>
                </View>
                <Text style={s.movMonto}>{fmt(mv.monto)}</Text>
              </View>
            ))
          )}

          <View style={s.note}>
            <Text style={s.noteText}>Cada pago, transferencia o retiro queda registrado aquí. Pagar desde una cuenta baja su saldo; el efectivo solo se marca y no cruza ninguna cuenta.</Text>
          </View>
        </View>
      </ScrollView>
      <BudgetBottomSheet />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  topPad: { paddingHorizontal: 26, paddingTop: 16, paddingBottom: 6 },
  eyebrow: { fontSize: 11, fontFamily: F.medium, letterSpacing: 1.6, textTransform: 'uppercase', color: C.text3 },
  title: { fontSize: 24, fontFamily: F.bold, color: C.text, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, margin: 22, marginTop: 18 },
  actionPrimary: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 14 },
  actionPrimaryText: { fontSize: 13, fontFamily: F.bold, color: C.primary },
  actionSecondary: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14 },
  actionSecondaryText: { fontSize: 13, fontFamily: F.bold, color: C.text2 },
  section: { paddingHorizontal: 26, paddingTop: 4, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.6, textTransform: 'uppercase', color: C.text3, paddingBottom: 4 },
  emptyCard: { marginTop: 14, padding: 30, backgroundColor: C.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: C.primaryBorder, borderRadius: 20, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: F.bold, color: C.text, textAlign: 'center' },
  emptyHint: { fontSize: 13, fontFamily: F.regular, color: C.text3, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  movRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border2 },
  movIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  movGlyph: { fontSize: 15, fontFamily: F.bold },
  movDesc: { fontSize: 14, fontFamily: F.medium, color: C.text },
  movMeta: { fontSize: 11, fontFamily: F.regular, color: C.text3, marginTop: 4 },
  movMonto: { fontSize: 13, fontFamily: F.monoBold, color: C.text },
  note: { marginTop: 18, padding: 14, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 14 },
  noteText: { fontSize: 12, fontFamily: F.regular, color: C.text3, lineHeight: 18 },
});
