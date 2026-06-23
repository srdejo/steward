import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '@/constants/colors';
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <View style={s.topPad}>
            <Text style={s.eyebrow}>{monthName}</Text>
            <Text style={s.title}>Ingresos</Text>
          </View>
        </SafeAreaView>

        {!hasBudget && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Crea el presupuesto de{'\n'}{monthName} primero</Text>
            <Text style={s.emptyHint}>Hazlo desde la pestaña Mes.</Text>
          </View>
        )}

        {hasBudget && (
          <>
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Ingresos recibidos</Text>
              <Text style={s.summaryAmount}>{fmt(cajeroTotal)}</Text>
              <Text style={s.summaryMeta}>Lo neto que ya entró · por ingresar {fmt(porIngresar)}</Text>
            </View>

            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>Fuentes de ingreso</Text>
                <TouchableOpacity onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'income', mode: 'add', name: '', a1: '', a2: '' } })} activeOpacity={0.7}>
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
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'income', mode: 'edit', id: inc.id, name: inc.name, a1: String(inc.bruto), a2: String(inc.neto) } })} activeOpacity={0.7}>
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
                        <Text style={[s.detailAmount, { color: C.teal }]}>{fmt(diezmo)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>Entra</Text>
                        <Text style={[s.detailAmount, { color: isRec ? C.green : C.text3 }]}>{fmt(inc.neto)}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}

              <View style={s.totalCard}>
                <View style={s.totalRow}>
                  <Text style={s.totalKey}>Entró al cajero</Text>
                  <Text style={s.totalVal}>{fmt(cajeroTotal)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalKey}>Diezmo presupuestado</Text>
                  <Text style={[s.totalVal, { color: C.teal }]}>{fmt(diezmoTotal)}</Text>
                </View>
                <View style={s.totalDivider} />
                <Text style={s.totalNote}>El diezmo se calcula sobre el salario completo y se paga en <Text style={{ color: C.teal }}>Gastos</Text> (agrupado o separado por fecha). El neto alimenta el Disponible.</Text>
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
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  topPad: { paddingHorizontal: 26, paddingTop: 16, paddingBottom: 6 },
  eyebrow: { fontSize: 11, fontFamily: F.medium, letterSpacing: 1.6, textTransform: 'uppercase', color: C.text3 },
  title: { fontSize: 24, fontFamily: F.bold, color: C.text, marginTop: 3 },
  emptyCard: { margin: 22, marginTop: 30, padding: 30, backgroundColor: C.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: C.primaryBorder, borderRadius: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 19, fontFamily: F.bold, color: C.text, textAlign: 'center', lineHeight: 25 },
  emptyHint: { fontSize: 13, fontFamily: F.regular, color: C.text3, marginTop: 10, textAlign: 'center' },
  summaryCard: {
    margin: 22, marginTop: 18, padding: 24, backgroundColor: C.primary, borderRadius: 24,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 16 }, shadowRadius: 32, shadowOpacity: 0.5, elevation: 12,
  },
  summaryLabel: { fontSize: 11, fontFamily: F.bold, letterSpacing: 2, textTransform: 'uppercase', color: C.primaryDim },
  summaryAmount: { fontSize: 40, fontFamily: F.monoBold, color: '#fff', marginTop: 14 },
  summaryMeta: { fontSize: 13, fontFamily: F.regular, color: C.primaryDim2, marginTop: 10 },
  section: { paddingHorizontal: 26, paddingTop: 4, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  sectionLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.6, textTransform: 'uppercase', color: C.text3 },
  addBtn: { fontSize: 12, fontFamily: F.bold, color: C.primary },
  tip: { fontSize: 11, fontFamily: F.regular, color: C.text4, lineHeight: 15, paddingBottom: 4 },
  incCard: { marginTop: 14, padding: 16, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  incTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  incName: { fontSize: 15, fontFamily: F.bold, color: C.text },
  estadoBadge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  estadoBadgeActive: { backgroundColor: C.greenBg },
  estadoBadgeInactive: { backgroundColor: C.surface2 },
  estadoText: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.6, textTransform: 'uppercase' },
  estadoTextActive: { color: C.green },
  estadoTextInactive: { color: C.text3 },
  incDetails: { flexDirection: 'row', gap: 10, marginTop: 14 },
  detailLabel: { fontSize: 9, fontFamily: F.medium, letterSpacing: 1, textTransform: 'uppercase', color: C.text4 },
  detailAmount: { fontSize: 13, fontFamily: F.monoBold, color: C.text2, marginTop: 7 },
  totalCard: { marginTop: 20, padding: 18, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12 },
  totalKey: { fontSize: 13, fontFamily: F.medium, color: C.text3 },
  totalVal: { fontSize: 13, fontFamily: F.monoBold, color: C.text },
  totalDivider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  totalNote: { fontSize: 12, fontFamily: F.regular, color: C.text3, lineHeight: 18 },
});
