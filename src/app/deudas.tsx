import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { fmt, useBudget } from '@/store/budget';

export default function DeudasScreen() {
  const { state, dispatch } = useBudget();
  const { debts, debtSort } = state;

  const activeDebts = debts.filter((d) => d.saldo > 0);
  const totalDebt = debts.reduce((s, d) => s + d.saldo, 0);
  const sorted = [...debts].sort((a, b) => debtSort === 'tasa' ? b.tasa - a.tasa : b.saldo - a.saldo);
  const priority = sorted.find((d) => d.saldo > 0);

  function rateColor(tasa: number) {
    if (tasa >= 18) return C.red;
    if (tasa >= 14) return C.orange;
    return C.text2;
  }
  function rateBg(tasa: number) {
    if (tasa >= 18) return C.redBg;
    if (tasa >= 14) return C.orangeBg;
    return C.surface2;
  }

  return (
    <View style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <View style={s.topPad}>
            <Text style={s.eyebrow}>Abono a capital</Text>
            <Text style={s.title}>Deudas pendientes</Text>
          </View>
        </SafeAreaView>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Total que debo</Text>
          <Text style={s.summaryAmount}>{fmt(totalDebt)}</Text>
          <Text style={s.summaryMeta}>{activeDebts.length} deuda{activeDebts.length !== 1 ? 's' : ''} activa{activeDebts.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Priority hint */}
        {priority && priority.saldo > 0 && (
          <View style={s.priorityCard}>
            <View style={s.priorityIcon}>
              <Text style={{ fontSize: 16, color: C.primary }}>⚡</Text>
            </View>
            <Text style={s.priorityText}>
              Abona primero a <Text style={s.priorityName}>{priority.name}</Text> — la tasa más alta ({priority.tasa.toFixed(2)}% E.A.).
            </Text>
          </View>
        )}

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sortRow}>
              <Text style={s.sectionLabel}>Ordenar</Text>
              <View style={s.toggle}>
                <TouchableOpacity style={[s.toggleOpt, debtSort === 'tasa' && s.toggleOptActive]} onPress={() => dispatch({ type: 'SET_DEBT_SORT', sort: 'tasa' })} activeOpacity={0.7}>
                  <Text style={[s.toggleText, debtSort === 'tasa' && s.toggleTextActive]}>Tasa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.toggleOpt, debtSort === 'saldo' && s.toggleOptActive]} onPress={() => dispatch({ type: 'SET_DEBT_SORT', sort: 'saldo' })} activeOpacity={0.7}>
                  <Text style={[s.toggleText, debtSort === 'saldo' && s.toggleTextActive]}>Saldo</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'deuda', mode: 'add', name: '', a1: '', a2: '' } })} activeOpacity={0.7}>
              <Text style={s.addBtn}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          {sorted.map((d) => {
            const isPrio = d.id === priority?.id && d.saldo > 0;
            return (
              <TouchableOpacity
                key={d.id}
                style={[s.debtCard, isPrio && s.debtCardPrio]}
                onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'deuda', mode: 'edit', id: d.id, name: d.name, a1: String(d.saldo), a2: String(d.tasa) } })}
                activeOpacity={0.7}>
                <View style={s.debtTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.debtName}>{d.name}</Text>
                    {isPrio && <Text style={s.prioLabel}>★  Prioriza abono</Text>}
                  </View>
                  <View style={[s.rateBadge, { backgroundColor: rateBg(d.tasa) }]}>
                    <Text style={[s.rateText, { color: rateColor(d.tasa) }]}>{d.tasa.toFixed(2)}% E.A.</Text>
                  </View>
                </View>
                <Text style={s.debtSaldo}>{fmt(d.saldo)}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={s.note}>
            <Text style={s.noteText}>Toca cualquier deuda para actualizar su saldo o tasa a mano. Ordénalas por tasa para saber dónde rinde más cada abono extra.</Text>
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
  summaryCard: {
    margin: 22, marginTop: 18, padding: 24, backgroundColor: C.red, borderRadius: 24,
    shadowColor: C.red, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24, shadowOpacity: 0.4, elevation: 10,
  },
  summaryLabel: { fontSize: 11, fontFamily: F.bold, letterSpacing: 2, textTransform: 'uppercase', color: C.redDim },
  summaryAmount: { fontSize: 38, fontFamily: F.monoBold, color: '#fff', marginTop: 14 },
  summaryMeta: { fontSize: 13, fontFamily: F.regular, color: 'rgba(255,255,255,0.7)', marginTop: 10 },
  priorityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 22, padding: 15, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 16, marginBottom: 4 },
  priorityIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.primaryBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  priorityText: { flex: 1, fontSize: 12, fontFamily: F.regular, color: C.text2, lineHeight: 17 },
  priorityName: { fontFamily: F.bold, color: C.primary },
  section: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.2, textTransform: 'uppercase', color: C.text3 },
  toggle: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 99, padding: 3 },
  toggleOpt: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  toggleOptActive: { backgroundColor: C.bg },
  toggleText: { fontSize: 10, fontFamily: F.bold, color: C.text3 },
  toggleTextActive: { color: C.text },
  addBtn: { fontSize: 12, fontFamily: F.bold, color: C.primary },
  debtCard: { marginTop: 12, padding: 16, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  debtCardPrio: { borderColor: C.primaryBorder },
  debtTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  debtName: { fontSize: 15, fontFamily: F.bold, color: C.text, lineHeight: 20 },
  prioLabel: { fontSize: 9, fontFamily: F.bold, letterSpacing: 1, textTransform: 'uppercase', color: C.primary, marginTop: 5 },
  rateBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, flexShrink: 0 },
  rateText: { fontSize: 11, fontFamily: F.monoBold },
  debtSaldo: { fontSize: 19, fontFamily: F.monoBold, color: C.text, marginTop: 13 },
  note: { marginTop: 18, padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14 },
  noteText: { fontSize: 12, fontFamily: F.regular, color: C.text3, lineHeight: 18 },
});
