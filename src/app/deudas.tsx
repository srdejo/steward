import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { fmt, useBudget } from '@/store/budget';

export default function DeudasScreen() {
  const { state, dispatch } = useBudget();
  const { debts, debtSort } = state;

  const activeDebts = debts.filter((d) => d.saldo > 0);
  const totalDebt = debts.reduce((s, d) => s + d.saldo, 0);

  const sorted = [...debts].sort((a, b) =>
    debtSort === 'tasa' ? b.tasa - a.tasa : b.saldo - a.saldo,
  );

  const priority = sorted.find((d) => d.saldo > 0);

  function rateColor(tasa: number) {
    if (tasa >= 18) return '#ef8a8a';
    if (tasa >= 14) return '#e0a87a';
    return '#c8c4b8';
  }

  function rateBg(tasa: number) {
    if (tasa >= 18) return 'rgba(239,106,106,0.15)';
    if (tasa >= 14) return 'rgba(224,168,122,0.15)';
    return 'rgba(200,196,184,0.1)';
  }

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

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
              <Text style={{ fontSize: 16, color: C.goldLight }}>★</Text>
            </View>
            <Text style={s.priorityText}>
              Abona primero a <Text style={s.priorityName}>{priority.name}</Text> — la tasa más alta ({priority.tasa.toFixed(2)}% E.A.).
            </Text>
          </View>
        )}

        {/* List */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sortRow}>
              <Text style={s.sectionLabel}>Ordenar</Text>
              <View style={s.toggle}>
                <TouchableOpacity
                  style={[s.toggleOpt, debtSort === 'tasa' && s.toggleOptActive]}
                  onPress={() => dispatch({ type: 'SET_DEBT_SORT', sort: 'tasa' })}
                  activeOpacity={0.7}>
                  <Text style={[s.toggleText, debtSort === 'tasa' && s.toggleTextActive]}>Tasa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.toggleOpt, debtSort === 'saldo' && s.toggleOptActive]}
                  onPress={() => dispatch({ type: 'SET_DEBT_SORT', sort: 'saldo' })}
                  activeOpacity={0.7}>
                  <Text style={[s.toggleText, debtSort === 'saldo' && s.toggleTextActive]}>Saldo</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'deuda', mode: 'add', name: '', a1: '', a2: '' } })}
              activeOpacity={0.7}>
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
                    {isPrio && (
                      <View style={s.prioRow}>
                        <Text style={s.prioStar}>★</Text>
                        <Text style={s.prioText}>Prioriza abono</Text>
                      </View>
                    )}
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
  container: { flex: 1, backgroundColor: C.bg1 },
  scroll: { paddingBottom: 40 },
  topPad: {
    paddingHorizontal: 26,
    paddingTop: 16,
    paddingBottom: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#8c887e',
  },
  title: {
    fontSize: 26,
    fontFamily: 'InstrumentSerif_400Regular',
    color: C.textPrimary,
    marginTop: 5,
  },
  summaryCard: {
    margin: 22,
    marginTop: 18,
    padding: 24,
    backgroundColor: '#241c1c',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239,106,106,0.22)',
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#ef8a8a',
  },
  summaryAmount: {
    fontSize: 38,
    fontFamily: 'SpaceMono_700Bold',
    color: C.textBright,
    marginTop: 14,
    letterSpacing: -0.76,
  },
  summaryMeta: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: '#9a8a8a',
    marginTop: 10,
  },
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 22,
    padding: 15,
    backgroundColor: 'rgba(200,168,106,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,168,106,0.28)',
    borderRadius: 16,
    marginBottom: 4,
  },
  priorityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(200,168,106,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priorityText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: '#cabf9f',
    lineHeight: 17,
  },
  priorityName: {
    fontFamily: 'Manrope_700Bold',
    color: '#f0e6c8',
  },
  section: {
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#7c7870',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: C.bg3,
    borderRadius: 99,
    padding: 3,
  },
  toggleOpt: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
  },
  toggleOptActive: {
    backgroundColor: C.bg1,
  },
  toggleText: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    color: C.textDim,
  },
  toggleTextActive: {
    color: C.textPrimary,
  },
  addBtn: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: C.gold,
  },
  debtCard: {
    marginTop: 12,
    padding: 16,
    backgroundColor: C.bg2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  debtCardPrio: {
    borderColor: 'rgba(200,168,106,0.4)',
  },
  debtTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  debtName: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: C.textPrimary,
    lineHeight: 20,
  },
  prioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  prioStar: {
    fontSize: 9,
    color: C.goldLight,
  },
  prioText: {
    fontSize: 9,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.goldLight,
  },
  rateBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  rateText: {
    fontSize: 11,
    fontFamily: 'SpaceMono_700Bold',
  },
  debtSaldo: {
    fontSize: 19,
    fontFamily: 'SpaceMono_700Bold',
    color: C.textBright,
    marginTop: 13,
  },
  note: {
    marginTop: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
  },
  noteText: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: '#8a857c',
    lineHeight: 18,
  },
});
