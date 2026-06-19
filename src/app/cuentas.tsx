import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { fmt, MONTHS, selectCurrentBudget, selectCuentasLabel, selectDisponible, useBudget } from '@/store/budget';
// Movimientos se muestran en la pestaña "Movimientos"

export default function CuentasScreen() {
  const { state, dispatch } = useBudget();
  const { curIdx } = state;

  const budget = selectCurrentBudget(state);
  const accounts = budget?.accounts ?? [];

  const disponible = selectDisponible(state);
  const cuentasLabel = selectCuentasLabel(state);

  // Si el mes no tiene presupuesto aún, mostrar estado vacío
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
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

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
            onPress={() => dispatch({
              type: 'OPEN_SHEET',
              sheet: { kind: 'mov', mode: 'add', type: 'transfer', name: '', a1: '', from: accounts[0]?.name ?? '', to: 'Efectivo' },
            })}
            activeOpacity={0.7}>
            <Text style={s.actionIcon}>⇄</Text>
            <Text style={s.actionPrimaryText}>Mover dinero</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionSecondary}
            onPress={() => dispatch({
              type: 'OPEN_SHEET',
              sheet: { kind: 'mov', mode: 'add', type: 'retiro', name: '', a1: '', from: accounts[0]?.name ?? '', to: 'Efectivo' },
            })}
            activeOpacity={0.7}>
            <Text style={s.actionIcon2}>↓</Text>
            <Text style={s.actionSecondaryText}>Retirar</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de cuentas */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Por cuenta</Text>
            <TouchableOpacity
              onPress={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'cuenta', mode: 'add', name: '', a1: '', a2: '' } })}
              activeOpacity={0.7}>
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
            <Text style={s.noteText}>El <Text style={{ color: C.goldLight }}>Disponible</Text> es la suma de las cuentas marcadas <Text style={{ color: C.goldLight }}>En disponible</Text>. Cada mes tiene sus propios saldos — pagar un gasto descuenta del saldo de este mes únicamente.</Text>
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
  topPad: { paddingHorizontal: 26, paddingTop: 16, paddingBottom: 6 },
  eyebrow: { fontSize: 11, fontFamily: 'Manrope_500Medium', letterSpacing: 1.6, textTransform: 'uppercase', color: '#8c887e' },
  title: { fontSize: 26, fontFamily: 'InstrumentSerif_400Regular', color: C.textPrimary, marginTop: 5 },
  emptyCard: { margin: 22, marginTop: 30, padding: 30, backgroundColor: C.bg2, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,168,106,0.32)', borderRadius: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 19, fontFamily: 'InstrumentSerif_400Regular', color: C.textPrimary, textAlign: 'center', lineHeight: 25 },
  emptyHint: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: C.textMuted, marginTop: 10, textAlign: 'center', lineHeight: 19 },
  summaryCard: { margin: 22, marginTop: 18, padding: 24, backgroundColor: C.bg2, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(200,168,106,0.18)' },
  summaryLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 2, textTransform: 'uppercase', color: C.gold },
  summaryAmount: { fontSize: 38, fontFamily: 'SpaceMono_700Bold', color: C.textBright, marginTop: 14, letterSpacing: -0.76 },
  summaryMeta: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: C.textMuted, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 22 },
  actionPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: 'rgba(200,168,106,0.1)', borderWidth: 1, borderColor: 'rgba(200,168,106,0.3)', borderRadius: 14 },
  actionIcon: { fontSize: 16, color: C.goldLight },
  actionPrimaryText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: C.goldLight },
  actionSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.borderMid, borderRadius: 14 },
  actionIcon2: { fontSize: 16, color: '#cfc9bd' },
  actionSecondaryText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#cfc9bd' },
  section: { paddingHorizontal: 26, paddingTop: 20, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  sectionLabel: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', letterSpacing: 1.6, textTransform: 'uppercase', color: '#7c7870' },
  addBtn: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: C.gold },
  accountCard: { marginTop: 12, padding: 16, backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 99, flexShrink: 0 },
  accountName: { flex: 1, fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: C.textPrimary },
  accountSaldo: { fontSize: 15, fontFamily: 'SpaceMono_700Bold', color: C.textPrimary },
  incluirRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  incluirLabel: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: C.textMuted },
  incluirChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: C.borderMid },
  incluirChipActive: { backgroundColor: 'rgba(200,168,106,0.12)', borderColor: 'rgba(200,168,106,0.4)' },
  incluirText: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.4, color: C.textDim },
  incluirTextActive: { color: C.gold },
  movRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  movIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  movIconText: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
  movDesc: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: C.textPrimary },
  movMeta: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: '#7c7870', marginTop: 4 },
  movMonto: { fontSize: 13, fontFamily: 'SpaceMono_700Bold', color: C.textPrimary },
  note: { marginTop: 18, padding: 14, backgroundColor: 'rgba(200,168,106,0.07)', borderWidth: 1, borderColor: 'rgba(200,168,106,0.18)', borderRadius: 14 },
  noteText: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#a8a092', lineHeight: 18 },
});
