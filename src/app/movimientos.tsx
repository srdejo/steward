import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { fmt, selectCurrentBudget, useBudget } from '@/store/budget';
import type { MovType } from '@/types';

function movIconGlyph(type: MovType): string {
  if (type === 'transfer') return '⇄';
  if (type === 'retiro') return '↓';
  return '✓';
}
function movIconColor(type: MovType): string {
  if (type === 'transfer') return C.gold;
  if (type === 'retiro') return C.textSecondary;
  return C.green;
}

export default function MovimientosScreen() {
  const { state, dispatch } = useBudget();
  const budget = selectCurrentBudget(state);
  const accounts = budget?.accounts ?? [];
  const movimientos = budget?.movimientos ?? [];
  const hasMovs = movimientos.length > 0;

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

        <SafeAreaView edges={['top']}>
          <View style={s.topPad}>
            <Text style={s.eyebrow}>Trazabilidad</Text>
            <Text style={s.title}>Movimientos del mes</Text>
          </View>
        </SafeAreaView>

        {/* Acciones */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.actionPrimary}
            onPress={() => dispatch({
              type: 'OPEN_SHEET',
              sheet: { kind: 'mov', mode: 'add', type: 'transfer', name: '', a1: '', from: accounts[0]?.name ?? '', to: 'Efectivo' },
            })}
            activeOpacity={0.7}>
            <SwapIcon />
            <Text style={s.actionPrimaryText}>Mover dinero</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionSecondary}
            onPress={() => dispatch({
              type: 'OPEN_SHEET',
              sheet: { kind: 'mov', mode: 'add', type: 'retiro', name: '', a1: '', from: accounts[0]?.name ?? '', to: 'Efectivo' },
            })}
            activeOpacity={0.7}>
            <WalletIcon />
            <Text style={s.actionSecondaryText}>Retirar</Text>
          </TouchableOpacity>
        </View>

        {/* Historial */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Historial</Text>

          {hasMovs ? (
            movimientos.map((mv) => (
              <View key={mv.id} style={s.movRow}>
                <View style={[s.movIconBox, { backgroundColor: movIconColor(mv.type) + '22' }]}>
                  <Text style={[s.movGlyph, { color: movIconColor(mv.type) }]}>{movIconGlyph(mv.type)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.movDesc}>{mv.desc}</Text>
                  <Text style={s.movMeta}>{mv.meta}</Text>
                </View>
                <Text style={s.movMonto}>{fmt(mv.monto)}</Text>
              </View>
            ))
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>Aún no hay movimientos</Text>
              <Text style={s.emptyHint}>Mueve o retira dinero, o paga un gasto desde una cuenta, y aparecerá aquí.</Text>
            </View>
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

function SwapIcon() {
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16, color: C.goldLight }}>⇄</Text>
    </View>
  );
}

function WalletIcon() {
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16, color: '#cfc9bd' }}>↓</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg1 },
  scroll: { paddingBottom: 40 },
  topPad: { paddingHorizontal: 26, paddingTop: 16, paddingBottom: 6 },
  eyebrow: { fontSize: 11, fontFamily: 'Manrope_500Medium', letterSpacing: 1.6, textTransform: 'uppercase', color: '#8c887e' },
  title: { fontSize: 26, fontFamily: 'InstrumentSerif_400Regular', color: C.textPrimary, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 10, margin: 22, marginTop: 18 },
  actionPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: 'rgba(200,168,106,0.1)', borderWidth: 1, borderColor: 'rgba(200,168,106,0.3)', borderRadius: 14 },
  actionPrimaryText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: C.goldLight },
  actionSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.borderMid, borderRadius: 14 },
  actionSecondaryText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#cfc9bd' },
  section: { paddingHorizontal: 26, paddingTop: 4, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', letterSpacing: 1.6, textTransform: 'uppercase', color: '#7c7870', paddingBottom: 4 },
  movRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  movIconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  movGlyph: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  movDesc: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: C.textPrimary },
  movMeta: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: '#7c7870', marginTop: 4 },
  movMonto: { fontSize: 13, fontFamily: 'SpaceMono_700Bold', color: C.textPrimary },
  emptyCard: { marginTop: 14, padding: 30, backgroundColor: C.bg2, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,168,106,0.28)', borderRadius: 20, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: 'InstrumentSerif_400Regular', color: C.textPrimary, textAlign: 'center', lineHeight: 24 },
  emptyHint: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: C.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  note: { marginTop: 18, padding: 14, backgroundColor: 'rgba(200,168,106,0.07)', borderWidth: 1, borderColor: 'rgba(200,168,106,0.18)', borderRadius: 14 },
  noteText: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#a8a092', lineHeight: 18 },
});
