import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '@/constants/colors';
import { BudgetBottomSheet } from '@/components/BudgetBottomSheet';
import { ExpenseRow } from '@/components/ExpenseRow';
import { SectionHeader } from '@/components/SectionHeader';
import {
  diezmoEntries,
  fmt,
  MONTHS,
  selectCuentasLabel,
  selectDisponible,
  selectEjecutado,
  selectPendiente,
  useBudget,
} from '@/store/budget';

export default function MesScreen() {
  const { state, dispatch } = useBudget();
  const { curIdx, budgets } = state;
  const monthName = MONTHS[curIdx];
  const budget = budgets[monthName];
  const hasBudget = !!budget?.exists;
  const hasPrev = curIdx > 0 && !!budgets[MONTHS[curIdx - 1]];
  const prevName = curIdx > 0 ? MONTHS[curIdx - 1] : '';

  const disponible = selectDisponible(state);
  const pendiente = selectPendiente(state);
  const ahorro = disponible - pendiente;
  const ejecutado = selectEjecutado(state);
  const total = ejecutado + pendiente;
  const pct = total > 0 ? Math.round((ejecutado / total) * 100) : 0;
  const cuentasLabel = selectCuentasLabel(state);

  const { profile } = state;
  const catDef = (key: string) => profile.cats.find((c) => c.key === key);

  const credItems = budget?.gastos.filter((g) => g.cat === 'cred') ?? [];
  const fijoItems = budget?.gastos.filter((g) => g.cat === 'fijo') ?? [];
  const tarjetaItems = budget?.gastos.filter((g) => g.cat === 'tarjeta') ?? [];
  const varItems = budget?.gastos.filter((g) => g.cat === 'var') ?? [];
  const diezmos = (budget && profile.diezmar) ? diezmoEntries(budget) : [];

  function decorateGasto(g: (typeof credItems)[0]): { sub?: string; subColor: string; shown: number; paid: boolean } {
    const paid = g.paid;
    const diff = paid && g.real != null && g.real !== g.amount;
    const shown = paid && g.real != null ? g.real : g.amount;
    let sub = '';
    let subColor: string = C.text3;
    if (g.cat === 'tarjeta') { sub = 'Tarjeta de crédito'; }
    if (paid && g.sourceName) { sub = 'Pagado desde ' + g.sourceName; subColor = C.text3; }
    if (diff) { sub = (paid && g.sourceName ? 'Desde ' + g.sourceName + ' · ' : '') + 'presup. ' + fmt(g.amount); subColor = C.green; }
    return { sub: sub || undefined, subColor, shown, paid };
  }

  function openPay(g: { id: string; name: string; amount: number }) {
    dispatch({
      type: 'OPEN_SHEET',
      sheet: { kind: 'pay', gastoId: g.id, gastoName: g.name, payBudgeted: g.amount, payMode: 'same', payAmt: String(g.amount) },
    });
  }

  function renderGastoRows(items: typeof credItems) {
    return items.map((g) => {
      const { sub, subColor, shown, paid } = decorateGasto(g);
      return (
        <ExpenseRow
          key={g.id}
          name={g.name}
          amountFmt={fmt(shown)}
          paid={paid}
          sub={sub}
          subColor={subColor}
          amountColor={paid ? C.text4 : C.text}
          onEdit={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'edit', id: g.id, cat: g.cat, name: g.name, a1: String(g.amount), a2: g.real != null ? String(g.real) : '' } })}
          onToggle={() => { if (paid) dispatch({ type: 'UNPAY_GASTO', gastoId: g.id }); else openPay(g); }}
        />
      );
    });
  }

  return (
    <View style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <View style={s.header}>
            <View>
              <Text style={s.user}>{state.profile.name}</Text>
              <Text style={s.monthTitle}>{monthName}</Text>
            </View>
            <View style={s.navRow}>
              <TouchableOpacity style={s.navBtn} onPress={() => dispatch({ type: 'PREV_MONTH' })} activeOpacity={0.7} disabled={curIdx === 0}>
                <Text style={[s.navArrow, { color: curIdx === 0 ? C.text4 : C.text2 }]}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.navBtn} onPress={() => dispatch({ type: 'NEXT_MONTH' })} activeOpacity={0.7} disabled={curIdx === MONTHS.length - 1}>
                <Text style={[s.navArrow, { color: curIdx === MONTHS.length - 1 ? C.text4 : C.text2 }]}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.navBtn} onPress={() => dispatch({ type: 'PROFILE_OPEN' })} activeOpacity={0.7}>
                <Text style={[s.navArrow, { color: C.text3, fontSize: 16 }]}>⚙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Empty state */}
        {!hasBudget && (
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}>
              <Text style={{ fontSize: 22 }}>📅</Text>
            </View>
            <Text style={s.emptyTitle}>Aún no hay presupuesto{'\n'}para {monthName}</Text>
            <Text style={s.emptyHint}>Empieza copiando el mes anterior o desde cero.</Text>
            <View style={{ gap: 10, marginTop: 22 }}>
              {hasPrev && (
                <TouchableOpacity style={s.btnPrimary} onPress={() => dispatch({ type: 'COPY_PREV' })} activeOpacity={0.8}>
                  <Text style={s.btnPrimaryText}>Copiar {prevName}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnSecondary} onPress={() => dispatch({ type: 'START_EMPTY' })} activeOpacity={0.8}>
                <Text style={s.btnSecondaryText}>Empezar desde cero</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Budget content */}
        {hasBudget && (
          <>
            {/* Summary card */}
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Disponible</Text>
              <Text style={s.summaryAmount}>{fmt(disponible)}</Text>
              <Text style={s.summaryMeta}>{cuentasLabel || 'Sin cuentas en disponible'}</Text>
              <View style={s.divider} />
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.metaLabel}>Pendiente</Text>
                  <Text style={[s.metaAmount, { color: '#fbbf24' }]}>{fmt(pendiente)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.metaLabel}>Ahorro proyectado</Text>
                  <Text style={[s.metaAmount, { color: '#86efac' }]}>{fmt(ahorro)}</Text>
                </View>
              </View>
            </View>

            {/* Progress */}
            <View style={s.progressWrap}>
              <View style={s.progressRow}>
                <Text style={s.progressLabel}>EJECUTADO · {fmt(ejecutado)}</Text>
                <Text style={[s.progressPct, { color: C.primary }]}>{pct}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.min(pct, 100)}%` as `${number}%` }]} />
              </View>
            </View>

            {/* Expense lists */}
            <View style={s.lists}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
                <Text style={s.gastosSectionTitle}>Gastos del mes</Text>
                <Text style={s.gastosTip}>toca el círculo al pagar</Text>
              </View>

              {/* Crediservir */}
              <SectionHeader label={catDef('cred')?.label ?? 'Deudas'} color={catDef('cred')?.color ?? C.green} onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'cred', name: '', a1: '', a2: '' } })} />
              {renderGastoRows(credItems)}

              {/* Diezmo — solo si el usuario lo habilitó */}
              {profile.diezmar && <View style={s.diezmoHeaderRow}>
                <Text style={[s.sectionLabelText, { color: C.teal }]}>Diezmo</Text>
                <View style={s.toggle}>
                  <TouchableOpacity style={[s.toggleOpt, budget.diezmoMode === 'separado' && s.toggleOptActive]} onPress={() => dispatch({ type: 'SET_DIEZMO_MODE', mode: 'separado' })} activeOpacity={0.7}>
                    <Text style={[s.toggleText, budget.diezmoMode === 'separado' && s.toggleTextActive]}>Separado</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.toggleOpt, budget.diezmoMode === 'agrupado' && s.toggleOptActive]} onPress={() => dispatch({ type: 'SET_DIEZMO_MODE', mode: 'agrupado' })} activeOpacity={0.7}>
                    <Text style={[s.toggleText, budget.diezmoMode === 'agrupado' && s.toggleTextActive]}>Agrupado</Text>
                  </TouchableOpacity>
                </View>
              </View>}
              {diezmos.map((e) => {
                const waiting = !e.payable;
                const paid = e.paid;
                let sub = '';
                let subColor: string = C.text4;
                if (waiting) { sub = 'Espera el ingreso'; }
                else if (paid) { sub = e.isGroup ? `${budget.incomes.filter(i => i.recibido).length} ingresos recibidos` : `Diezmado · ${e.fecha ?? ''}`; subColor = C.green; }
                else { sub = e.isGroup ? `${budget.incomes.filter(i => i.recibido).length} ingresos recibidos` : 'Listo para diezmar'; subColor = C.text3; }
                return (
                  <View key={e.id} style={{ opacity: waiting ? 0.4 : 1 }}>
                    <ExpenseRow
                      name={e.name}
                      amountFmt={fmt(e.amount)}
                      paid={paid}
                      sub={sub}
                      subColor={subColor}
                      amountColor={paid ? C.text4 : waiting ? C.text4 : C.text}
                      onToggle={() => { if (!waiting) dispatch({ type: 'TOGGLE_DIEZMO', incId: e.incId, isGroup: e.isGroup }); }}
                    />
                  </View>
                );
              })}

              {/* Fijos */}
              <SectionHeader label={catDef('fijo')?.label ?? 'Gastos fijos'} color={catDef('fijo')?.color ?? C.orange} onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'fijo', name: '', a1: '', a2: '' } })} />
              {renderGastoRows(fijoItems)}

              {/* Tarjetas */}
              <SectionHeader label={catDef('tarjeta')?.label ?? 'Tarjetas y cuotas'} color={catDef('tarjeta')?.color ?? C.purple} onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'tarjeta', name: '', a1: '', a2: '' } })} />
              {renderGastoRows(tarjetaItems)}

              {/* Variables */}
              <SectionHeader label={catDef('var')?.label ?? 'Variables'} color={catDef('var')?.color ?? C.text3} onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'var', name: '', a1: '', a2: '' } })} />
              {renderGastoRows(varItems)}

              <Text style={s.tip}>Toca un gasto para editar su valor o registrar lo que <Text style={{ color: C.text2 }}>realmente</Text> gastaste. Toca el círculo para marcarlo pagado.</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 16, paddingBottom: 6 },
  user: { fontSize: 13, fontFamily: F.medium, color: C.text3 },
  monthTitle: { fontSize: 22, fontFamily: F.bold, color: C.text, marginTop: 3 },
  navRow: { flexDirection: 'row', gap: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 18, fontFamily: F.bold, lineHeight: 22 },
  emptyCard: { margin: 22, marginTop: 30, padding: 24, backgroundColor: C.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c5d6f7', borderRadius: 24, alignItems: 'center' },
  emptyIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 21, fontFamily: F.bold, color: C.text, textAlign: 'center', marginTop: 18, lineHeight: 28 },
  emptyHint: { fontSize: 13, fontFamily: F.regular, color: C.text3, marginTop: 10, textAlign: 'center', lineHeight: 19 },
  btnPrimary: { padding: 15, backgroundColor: C.primary, borderRadius: 14, alignItems: 'center' },
  btnPrimaryText: { fontSize: 14, fontFamily: F.bold, color: '#fff' },
  btnSecondary: { padding: 15, borderWidth: 1, borderColor: C.border, borderRadius: 14, alignItems: 'center', backgroundColor: C.surface },
  btnSecondaryText: { fontSize: 14, fontFamily: F.bold, color: C.text2 },
  summaryCard: {
    margin: 22, marginTop: 18, padding: 24,
    backgroundColor: C.primary, borderRadius: 24,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 16 }, shadowRadius: 32, shadowOpacity: 0.5, elevation: 12,
  },
  summaryLabel: { fontSize: 11, fontFamily: F.bold, letterSpacing: 2, textTransform: 'uppercase', color: C.primaryDim },
  summaryAmount: { fontSize: 42, fontFamily: F.monoBold, color: '#fff', marginTop: 14, letterSpacing: -0.84 },
  summaryMeta: { fontSize: 13, fontFamily: F.regular, color: C.primaryDim2, marginTop: 10 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 20 },
  metaLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' },
  metaAmount: { fontSize: 16, fontFamily: F.monoBold, marginTop: 8 },
  progressWrap: { marginHorizontal: 28, marginBottom: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  progressLabel: { fontSize: 11, fontFamily: F.bold, letterSpacing: 0.4, color: C.text3 },
  progressPct: { fontSize: 11, fontFamily: F.bold },
  progressTrack: { height: 7, borderRadius: 99, backgroundColor: C.surface3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: C.primary },
  lists: { paddingHorizontal: 26, paddingTop: 22, paddingBottom: 8 },
  gastosSectionTitle: { fontSize: 18, fontFamily: F.bold, color: C.text },
  gastosTip: { fontSize: 10, fontFamily: F.medium, letterSpacing: 1, textTransform: 'uppercase', color: C.text3 },
  sectionLabelText: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.6, textTransform: 'uppercase' },
  diezmoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 8 },
  toggle: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 99, padding: 3 },
  toggleOpt: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  toggleOptActive: { backgroundColor: C.bg },
  toggleText: { fontSize: 10, fontFamily: F.bold, color: C.text3 },
  toggleTextActive: { color: C.text },
  tip: { fontSize: 11, fontFamily: F.regular, color: C.text4, paddingTop: 18, lineHeight: 16 },
});
