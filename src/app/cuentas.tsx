// Movimientos se muestran en la pestaña "Movimientos"
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { fmt, MONTHS, selectCurrentBudget, selectCuentasLabel, selectDisponible, useBudget } from '@/store/budget';

export default function CuentasScreen() {
  const { state, dispatch } = useBudget();
  const { curIdx } = state;

  const budget = selectCurrentBudget(state);
  const accounts = budget?.accounts ?? [];

  const disponible = selectDisponible(state);
  const cuentasLabel = selectCuentasLabel(state);

  if (!budget?.exists) {
    return (
      <View style={s.container}>
        <SafeAreaView edges={['top']}>
          <View style={s.topPad}>
            <Text style={s.eyebrow}>Trazabilidad</Text>
            <Text style={s.title}>Mis cuentas</Text>
          </View>
        </SafeAreaView>
        <View style={s.emptyCard}>
          <Text style={s.emptyTitle}>Crea el presupuesto de{'\n'}{MONTHS[curIdx]} primero</Text>
          <Text style={s.emptyHint}>Hazlo desde la pestaña Mes.</Text>
        </View>
        <BudgetBottomSheet />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <View style={s.topPad}>
            <Text style={s.eyebrow}>Trazabilidad</Text>
            <Text style={s.title}>Mis cuentas</Text>
          </View>
        </SafeAreaView>

        {/* Resumen */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Disponible en las cuentas</Text>
          <Text style={s.summaryAmount}>{fmt(disponible)}</Text>
          <Text style={s.summaryMeta}>{cuentasLabel || 'Sin cuentas en disponible'}</Text>
        </View>

        {/* Acciones */}
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

        {/* Lista cuentas */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Por cuenta</Text>
            <TouchableOpacity onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'cuenta', mode: 'add', name: '', a1: '', a2: '' } })} activeOpacity={0.7}>
              <Text style={s.addBtn}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          {accounts.length === 0 && (
            <Text style={s.emptyHint}>Agrega tus cuentas con el saldo de este mes.</Text>
          )}

          {accounts.map((ac) => (
            <View key={ac.id} style={s.accountCard}>
              <TouchableOpacity
                style={s.accountRow}
                onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'cuenta', mode: 'edit', id: ac.id, name: ac.name, a1: String(ac.saldo), a2: '' } })}
                activeOpacity={0.7}>
                <View style={[s.dot, { backgroundColor: ac.color }]} />
                <Text style={s.accountName}>{ac.name}</Text>
                <Text style={s.accountSaldo}>{fmt(ac.saldo)}</Text>
              </TouchableOpacity>
              <View style={s.incluirRow}>
                <Text style={s.incluirLabel}>Sumar al disponible</Text>
                <TouchableOpacity
                  style={[s.incluirChip, ac.incluir && s.incluirChipActive]}
                  onPress={() => dispatch({ type: 'TOGGLE_INCLUIR', accountId: ac.id })}
                  activeOpacity={0.7}>
                  <Text style={[s.incluirText, ac.incluir && s.incluirTextActive]}>
                    {ac.incluir ? 'En disponible' : 'Excluido'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={s.note}>
            <Text style={s.noteText}>El <Text style={{ color: C.primary }}>Disponible</Text> es la suma de las cuentas marcadas <Text style={{ color: C.primary }}>En disponible</Text>. Cada mes tiene sus propios saldos — pagar un gasto descuenta del saldo de este mes únicamente.</Text>
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
  emptyCard: { margin: 22, marginTop: 30, padding: 30, backgroundColor: C.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: C.primaryBorder, borderRadius: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 19, fontFamily: F.bold, color: C.text, textAlign: 'center', lineHeight: 25 },
  emptyHint: { fontSize: 13, fontFamily: F.regular, color: C.text3, marginTop: 10, textAlign: 'center', lineHeight: 19 },
  summaryCard: {
    margin: 22, marginTop: 18, padding: 24, backgroundColor: C.primary, borderRadius: 24,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 16 }, shadowRadius: 32, shadowOpacity: 0.5, elevation: 12,
  },
  summaryLabel: { fontSize: 11, fontFamily: F.bold, letterSpacing: 2, textTransform: 'uppercase', color: C.primaryDim },
  summaryAmount: { fontSize: 38, fontFamily: F.monoBold, color: '#fff', marginTop: 14 },
  summaryMeta: { fontSize: 13, fontFamily: F.regular, color: C.primaryDim2, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 22 },
  actionPrimary: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 14 },
  actionPrimaryText: { fontSize: 13, fontFamily: F.bold, color: C.primary },
  actionSecondary: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14 },
  actionSecondaryText: { fontSize: 13, fontFamily: F.bold, color: C.text2 },
  section: { paddingHorizontal: 26, paddingTop: 20, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  sectionLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.6, textTransform: 'uppercase', color: C.text3 },
  addBtn: { fontSize: 12, fontFamily: F.bold, color: C.primary },
  accountCard: { marginTop: 12, padding: 16, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 99, flexShrink: 0 },
  accountName: { flex: 1, fontSize: 15, fontFamily: F.bold, color: C.text },
  accountSaldo: { fontSize: 15, fontFamily: F.monoBold, color: C.text },
  incluirRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  incluirLabel: { fontSize: 11, fontFamily: F.medium, color: C.text3 },
  incluirChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: C.surface3, borderWidth: 1, borderColor: C.border },
  incluirChipActive: { backgroundColor: C.primaryBg, borderColor: C.primaryBorder },
  incluirText: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.4, color: C.text3 },
  incluirTextActive: { color: C.primary },
  note: { marginTop: 18, padding: 14, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 14 },
  noteText: { fontSize: 12, fontFamily: F.regular, color: C.text3, lineHeight: 18 },
});
