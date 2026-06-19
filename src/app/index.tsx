import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';
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
  const noBudget = !hasBudget;
  const hasPrev = curIdx > 0 && !!budgets[MONTHS[curIdx - 1]];
  const prevName = curIdx > 0 ? MONTHS[curIdx - 1] : '';

  const disponible = selectDisponible(state);
  const pendiente = selectPendiente(state);
  const ahorro = disponible - pendiente;
  const ejecutado = selectEjecutado(state);
  const total = ejecutado + pendiente;
  const pct = total > 0 ? Math.round((ejecutado / total) * 100) : 0;
  const cuentasLabel = selectCuentasLabel(state);

  const credItems = budget?.gastos.filter((g) => g.cat === 'cred') ?? [];
  const fijoItems = budget?.gastos.filter((g) => g.cat === 'fijo') ?? [];
  const tarjetaItems = budget?.gastos.filter((g) => g.cat === 'tarjeta') ?? [];
  const varItems = budget?.gastos.filter((g) => g.cat === 'var') ?? [];
  const diezmos = budget ? diezmoEntries(budget) : [];

  function decorateGasto(g: (typeof credItems)[0]): { sub?: string; subColor: string; shown: number; paid: boolean } {
    const paid = g.paid;
    const diff = paid && g.real != null && g.real !== g.amount;
    const shown = paid && g.real != null ? g.real : g.amount;
    let sub = '';
    let subColor: string = C.textMuted;
    if (g.cat === 'tarjeta') { sub = 'Tarjeta de crédito'; }
    if (paid && g.sourceName) { sub = 'Pagado desde ' + g.sourceName; subColor = '#8a857c'; }
    if (diff) { sub = (paid && g.sourceName ? 'Desde ' + g.sourceName + ' · ' : '') + 'presup. ' + fmt(g.amount); subColor = C.green; }
    return { sub: sub || undefined, subColor, shown, paid };
  }

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <SafeAreaView edges={['top']}>
          <View style={s.header}>
            <View>
              <Text style={s.user}>Daniel Ríos</Text>
              <Text style={s.monthTitle}>{monthName}</Text>
            </View>
            <View style={s.navRow}>
              <TouchableOpacity
                style={[s.navBtn, { borderColor: curIdx === 0 ? 'transparent' : C.goldBorder }]}
                onPress={() => dispatch({ type: 'PREV_MONTH' })}
                activeOpacity={0.7}>
                <Text style={[s.navArrow, { color: curIdx === 0 ? C.bg2 : C.textSecondary }]}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.navBtn, { borderColor: curIdx === MONTHS.length - 1 ? 'transparent' : 'rgba(200,168,106,0.45)' }]}
                onPress={() => dispatch({ type: 'NEXT_MONTH' })}
                activeOpacity={0.7}>
                <Text style={[s.navArrow, { color: curIdx === MONTHS.length - 1 ? C.bg2 : C.gold }]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Empty state */}
        {noBudget && (
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
              <Text style={s.summaryMeta}>{cuentasLabel}</Text>
              <View style={s.divider} />
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.metaLabel}>Pendiente</Text>
                  <Text style={[s.metaAmount, { color: C.orange }]}>{fmt(pendiente)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.metaLabel}>Ahorro proyectado</Text>
                  <Text style={[s.metaAmount, { color: C.green }]}>{fmt(ahorro)}</Text>
                </View>
              </View>
            </View>

            {/* Progress bar */}
            <View style={s.progressWrap}>
              <View style={s.progressRow}>
                <Text style={s.progressLabel}>EJECUTADO · {fmt(ejecutado)}</Text>
                <Text style={s.progressPct}>{pct}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.min(pct, 100)}%` as `${number}%` }]} />
              </View>
            </View>

            {/* Expense lists */}
            <View style={s.lists}>
              <Text style={s.gastosSectionTitle}>Gastos del mes</Text>
              <Text style={s.gastosTip}>toca el círculo al pagar</Text>

              {/* Crediservir */}
              <SectionHeader label="Deudas Crediservir" color="#5f9d72" onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'cred', name: '', a1: '', a2: '' } })} />
              {credItems.map((g) => {
                const { sub, subColor, shown, paid } = decorateGasto(g);
                return (
                  <ExpenseRow
                    key={g.id}
                    name={g.name}
                    amountFmt={fmt(shown)}
                    paid={paid}
                    sub={sub}
                    subColor={subColor}
                    amountColor={paid ? '#6c6860' : C.textPrimary}
                    onEdit={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'edit', id: g.id, cat: g.cat, name: g.name, a1: String(g.amount), a2: g.real != null ? String(g.real) : '' } })}
                    onToggle={() => {
                      if (paid) dispatch({ type: 'UNPAY_GASTO', gastoId: g.id });
                      else dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'pay', gastoId: g.id, gastoName: g.name, payBudgeted: g.amount, payMode: 'same', payAmt: String(g.amount) } });
                    }}
                  />
                );
              })}

              {/* Diezmo */}
              <View style={s.diezmoHeaderRow}>
                <Text style={[s.sectionLabelText, { color: '#5aa6a4' }]}>Diezmo</Text>
                <View style={s.toggle}>
                  <TouchableOpacity
                    style={[s.toggleOpt, budget.diezmoMode === 'separado' && s.toggleOptActive]}
                    onPress={() => dispatch({ type: 'SET_DIEZMO_MODE', mode: 'separado' })}
                    activeOpacity={0.7}>
                    <Text style={[s.toggleText, budget.diezmoMode === 'separado' && s.toggleTextActive]}>Separado</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.toggleOpt, budget.diezmoMode === 'agrupado' && s.toggleOptActive]}
                    onPress={() => dispatch({ type: 'SET_DIEZMO_MODE', mode: 'agrupado' })}
                    activeOpacity={0.7}>
                    <Text style={[s.toggleText, budget.diezmoMode === 'agrupado' && s.toggleTextActive]}>Agrupado</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {diezmos.map((e) => {
                const waiting = !e.payable;
                const paid = e.paid;
                let sub = '';
                let subColor: string = C.textDim;
                if (waiting) { sub = 'Espera el ingreso'; }
                else if (paid) { sub = e.isGroup ? `${(budget.incomes.filter(i => i.recibido).length)} ingresos recibidos` : `Diezmado · ${e.fecha ?? ''}`; subColor = C.green; }
                else { sub = e.isGroup ? `${(budget.incomes.filter(i => i.recibido).length)} ingresos recibidos` : 'Listo para diezmar'; subColor = C.textMuted; }

                return (
                  <View key={e.id} style={{ opacity: waiting ? 0.4 : 1 }}>
                    <ExpenseRow
                      name={e.name}
                      amountFmt={fmt(e.amount)}
                      paid={paid}
                      sub={sub}
                      subColor={subColor}
                      amountColor={paid ? '#6c6860' : waiting ? C.textDim : C.textPrimary}
                      onToggle={() => { if (!waiting) dispatch({ type: 'TOGGLE_DIEZMO', incId: e.incId, isGroup: e.isGroup }); }}
                    />
                  </View>
                );
              })}

              {/* Fijos */}
              <SectionHeader label="Gastos fijos" color="#c79a4a" onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'fijo', name: '', a1: '', a2: '' } })} />
              {fijoItems.map((g) => {
                const { sub, subColor, shown, paid } = decorateGasto(g);
                return (
                  <ExpenseRow
                    key={g.id}
                    name={g.name}
                    amountFmt={fmt(shown)}
                    paid={paid}
                    sub={sub}
                    subColor={subColor}
                    amountColor={paid ? '#6c6860' : C.textPrimary}
                    onEdit={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'edit', id: g.id, cat: g.cat, name: g.name, a1: String(g.amount), a2: g.real != null ? String(g.real) : '' } })}
                    onToggle={() => {
                      if (paid) dispatch({ type: 'UNPAY_GASTO', gastoId: g.id });
                      else dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'pay', gastoId: g.id, gastoName: g.name, payBudgeted: g.amount, payMode: 'same', payAmt: String(g.amount) } });
                    }}
                  />
                );
              })}

              {/* Tarjetas */}
              <SectionHeader label="Tarjetas y cuotas" color="#9b7ad6" onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'tarjeta', name: '', a1: '', a2: '' } })} />
              {tarjetaItems.map((g) => {
                const { sub, subColor, shown, paid } = decorateGasto(g);
                return (
                  <ExpenseRow
                    key={g.id}
                    name={g.name}
                    amountFmt={fmt(shown)}
                    paid={paid}
                    sub={sub ?? 'Tarjeta de crédito'}
                    subColor={subColor}
                    amountColor={paid ? '#6c6860' : C.textPrimary}
                    onEdit={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'edit', id: g.id, cat: g.cat, name: g.name, a1: String(g.amount), a2: g.real != null ? String(g.real) : '' } })}
                    onToggle={() => {
                      if (paid) dispatch({ type: 'UNPAY_GASTO', gastoId: g.id });
                      else dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'pay', gastoId: g.id, gastoName: g.name, payBudgeted: g.amount, payMode: 'same', payAmt: String(g.amount) } });
                    }}
                  />
                );
              })}

              {/* Variables */}
              <SectionHeader label="Variables" color={C.textSecondary} onAdd={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'add', cat: 'var', name: '', a1: '', a2: '' } })} />
              {varItems.map((g) => {
                const { sub, subColor, shown, paid } = decorateGasto(g);
                return (
                  <ExpenseRow
                    key={g.id}
                    name={g.name}
                    amountFmt={fmt(shown)}
                    paid={paid}
                    sub={sub}
                    subColor={subColor}
                    amountColor={paid ? '#6c6860' : C.textPrimary}
                    onEdit={() => dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'gasto', mode: 'edit', id: g.id, cat: g.cat, name: g.name, a1: String(g.amount), a2: g.real != null ? String(g.real) : '' } })}
                    onToggle={() => {
                      if (paid) dispatch({ type: 'UNPAY_GASTO', gastoId: g.id });
                      else dispatch({ type: 'OPEN_SHEET', sheet: { kind: 'pay', gastoId: g.id, gastoName: g.name, payBudgeted: g.amount, payMode: 'same', payAmt: String(g.amount) } });
                    }}
                  />
                );
              })}

              <Text style={s.tip}>Toca un gasto para editar su valor o registrar lo que <Text style={{ color: '#a8a092' }}>realmente</Text> gastaste. Toca el círculo para marcarlo pagado.</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingTop: 16,
    paddingBottom: 6,
  },
  user: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#8c887e',
  },
  monthTitle: {
    fontSize: 26,
    fontFamily: 'InstrumentSerif_400Regular',
    color: C.textPrimary,
    marginTop: 5,
  },
  navRow: { flexDirection: 'row', gap: 8 },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    lineHeight: 22,
  },
  emptyCard: {
    margin: 22,
    marginTop: 30,
    padding: 24,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,168,106,0.32)',
    borderRadius: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: C.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 21,
    fontFamily: 'InstrumentSerif_400Regular',
    color: C.textPrimary,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 26,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: C.textMuted,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 19,
  },
  btnPrimary: {
    padding: 15,
    backgroundColor: C.gold,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: '#1a1408',
  },
  btnSecondary: {
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: '#cfc9bd',
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
    fontSize: 42,
    fontFamily: 'SpaceMono_700Bold',
    color: C.textBright,
    marginTop: 14,
    letterSpacing: -0.84,
  },
  summaryMeta: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: C.textMuted,
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(200,168,106,0.4)',
    marginVertical: 20,
  },
  metaLabel: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#6f6b62',
  },
  metaAmount: {
    fontSize: 16,
    fontFamily: 'SpaceMono_700Bold',
    marginTop: 8,
  },
  progressWrap: {
    marginHorizontal: 28,
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 0.4,
    color: C.textMuted,
  },
  progressPct: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: C.gold,
  },
  progressTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: '#23252c',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: C.gold,
  },
  lists: {
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 8,
  },
  gastosSectionTitle: {
    fontSize: 18,
    fontFamily: 'InstrumentSerif_400Regular',
    color: C.textPrimary,
  },
  gastosTip: {
    fontSize: 10,
    fontFamily: 'Manrope_500Medium',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7c7870',
    marginTop: 2,
  },
  sectionLabelText: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  diezmoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 8,
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
  tip: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    color: '#6f6b62',
    paddingTop: 18,
    lineHeight: 16,
  },
});
