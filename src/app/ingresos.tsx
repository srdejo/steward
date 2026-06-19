import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { fmt, MONTHS, selectCurrentBudget, useBudget } from '@/store/budget';

export default function IngresosScreen() {
  const { state, dispatch } = useBudget();
  const { curIdx } = state;
  const monthName = MONTHS[curIdx];
  const budget = selectCurrentBudget(state);
  const hasBudget = !!budget?.exists;

  const recibidos = budget?.incomes.filter((i) => i.recibido) ?? [];
  const cajeroTotal = recibidos.reduce((s, i) => s + i.neto, 0);
  const diezmoTotal = (budget?.incomes ?? []).reduce((s, i) => s + Math.round(i.bruto * 0.1), 0);
  const porIngresar = (budget?.incomes ?? []).filter((i) => !i.recibido).reduce((s, i) => s + i.neto, 0);

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

        <SafeAreaView edges={['top']}>
          <View style={s.topPad}>
            <Text style={s.eyebrow}>{monthName}</Text>
            <Text style={s.title}>Ingresos</Text>
          </View>
        </SafeAreaView>

        {/* No budget */}
        {!hasBudget && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Crea el presupuesto de{'\n'}{monthName} primero</Text>
            <Text style={s.emptyHint}>Hazlo desde la pestaña Mes.</Text>
          </View>
        )}

        {hasBudget && (
          <>
            {/* Summary card */}
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Ingresos recibidos</Text>
              <Text style={s.summaryAmount}>{fmt(cajeroTotal)}</Text>
              <Text style={s.summaryMeta}>Lo neto que ya entró · por ingresar {fmt(porIngresar)}</Text>
            </View>

            {/* List */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>Fuentes de ingreso</Text>
                <TouchableOpacity
                  onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'income', mode: 'add', name: '', a1: '', a2: '' } })}
                  activeOpacity={0.7}>
                  <Text style={s.addBtn}>+ Agregar</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.tip}>Toca el estado para marcar recibido · toca la tarjeta para editar.</Text>

              {(budget?.incomes ?? []).map((inc) => {
                const diezmo = Math.round(inc.bruto * 0.1);
                const isRec = inc.recibido;
                return (
                  <View key={inc.id} style={s.incCard}>
                    <View style={s.incTop}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'income', mode: 'edit', id: inc.id, name: inc.name, a1: String(inc.bruto), a2: String(inc.neto) } })}
                        activeOpacity={0.7}>
                        <Text style={s.incName}>{inc.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.estadoBadge, isRec ? s.estadoBadgeActive : s.estadoBadgeInactive]}
                        onPress={() => dispatch({ type: 'TOGGLE_RECIBIDO', incId: inc.id })}
                        activeOpacity={0.7}>
                        <Text style={[s.estadoText, isRec ? s.estadoTextActive : s.estadoTextInactive]}>
                          {isRec ? 'Recibido' : 'Pendiente'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={s.incDetails}
                      onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'income', mode: 'edit', id: inc.id, name: inc.name, a1: String(inc.bruto), a2: String(inc.neto) } })}
                      activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>Salario</Text>
                        <Text style={s.detailAmount}>{fmt(inc.bruto)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>Diezmo 10%</Text>
                        <Text style={[s.detailAmount, { color: C.gold }]}>{fmt(diezmo)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>Entra</Text>
                        <Text style={[s.detailAmount, { color: isRec ? C.green : C.textMuted }]}>{fmt(inc.neto)}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Summary row */}
              <View style={s.totalCard}>
                <View style={s.totalRow}>
                  <Text style={s.totalKey}>Entró al cajero</Text>
                  <Text style={s.totalVal}>{fmt(cajeroTotal)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalKey}>Diezmo presupuestado</Text>
                  <Text style={[s.totalVal, { color: C.gold }]}>{fmt(diezmoTotal)}</Text>
                </View>
                <View style={s.totalDivider} />
                <Text style={s.totalNote}>El diezmo se calcula sobre el salario completo y se paga en <Text style={{ color: '#cfeae9' }}>Gastos</Text> (agrupado o separado por fecha). El neto alimenta el Disponible.</Text>
              </View>
            </View>
          </>
        )}
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
  emptyCard: {
    margin: 22,
    marginTop: 30,
    padding: 30,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,168,106,0.32)',
    borderRadius: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 19,
    fontFamily: 'InstrumentSerif_400Regular',
    color: C.textPrimary,
    textAlign: 'center',
    lineHeight: 25,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: C.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
  summaryCard: {
    margin: 22,
    marginTop: 18,
    padding: 24,
    backgroundColor: C.bg2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(200,168,106,0.18)',
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.gold,
  },
  summaryAmount: {
    fontSize: 40,
    fontFamily: 'SpaceMono_700Bold',
    color: C.textBright,
    marginTop: 14,
    letterSpacing: -0.8,
  },
  summaryMeta: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: C.textMuted,
    marginTop: 10,
  },
  section: {
    paddingHorizontal: 26,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#7c7870',
  },
  addBtn: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: C.gold,
  },
  tip: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    color: C.textDim,
    lineHeight: 15,
    paddingBottom: 4,
  },
  incCard: {
    marginTop: 14,
    padding: 16,
    backgroundColor: C.bg2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  incTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  incName: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: C.textPrimary,
  },
  estadoBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
  },
  estadoBadgeActive: {
    backgroundColor: 'rgba(123,214,160,0.15)',
  },
  estadoBadgeInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  estadoText: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  estadoTextActive: {
    color: C.green,
  },
  estadoTextInactive: {
    color: C.textSecondary,
  },
  incDetails: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  detailLabel: {
    fontSize: 9,
    fontFamily: 'Manrope_500Medium',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.textDim,
  },
  detailAmount: {
    fontSize: 13,
    fontFamily: 'SpaceMono_700Bold',
    color: '#cfc9bd',
    marginTop: 7,
  },
  totalCard: {
    marginTop: 20,
    padding: 18,
    backgroundColor: C.bg2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  totalKey: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: '#a8a092',
  },
  totalVal: {
    fontSize: 13,
    fontFamily: 'SpaceMono_700Bold',
    color: C.textPrimary,
  },
  totalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  totalNote: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: '#9fc4c2',
    lineHeight: 18,
  },
});
