import { C, F } from '@/constants/colors';
import { useBudget } from '@/store/budget';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TOTAL_STEPS = 6;

const STEP_META = [
  { tag: 'Bienvenido',    title: '¿Cómo te llamas?',           subtitle: 'Lo usaremos para saludarte en tu presupuesto.' },
  { tag: 'Aporte',        title: '¿Deseas presupuestar tu diezmo?', subtitle: 'Si lo activas, apartamos el 10% de cada ingreso como aporte y lo verás en tus gastos.' },
  { tag: 'Organiza',      title: 'Tus categorías',             subtitle: 'Renómbralas, toca el color para cambiarlo o elimina las que no uses. Podrás ajustarlas luego.' },
  { tag: 'Cuentas',       title: '¿Dónde recibes tu dinero?',  subtitle: 'Cada ingreso entrará a una de estas cuentas. Pon su saldo de hoy para empezar.' },
  { tag: 'Ingresos fijos',title: 'Lo que entra cada mes',      subtitle: 'Defínelos una sola vez —como tu salario— y los repetimos en todos los meses del año.' },
  { tag: 'Deudas',        title: '¿Tienes créditos?',            subtitle: 'Si las registras, te ayudamos a ver cuánto debes y a priorizar el abono por tasa.' },
];

function maskNum(s: string) {
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('es-CO');
}
function stripNum(s: string) { return s.replace(/[^0-9]/g, ''); }

export function OnboardingScreen() {
  const { state, dispatch } = useBudget();
  const { onboardStep, draft } = state;

  const isLast = onboardStep === TOTAL_STEPS - 1;
  const canBack = onboardStep > 0;
  const meta = STEP_META[onboardStep];

  function handlePrimary() {
    if (!isLast) dispatch({ type: 'ONBOARD_NEXT' });
    else dispatch({ type: 'ONBOARD_COMPLETE' });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Progress pills */}
        <View style={s.pills}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[s.pill, i <= onboardStep && s.pillActive]} />
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={s.tag}>{meta.tag}</Text>
          <Text style={s.title}>{meta.title}</Text>
          <Text style={s.subtitle}>{meta.subtitle}</Text>

          {/* ─── Paso 0: Nombre ─── */}
          {onboardStep === 0 && (
            <TextInput
              style={s.nameInput}
              value={draft.name}
              onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_NAME', name: t })}
              placeholder="Tu nombre"
              placeholderTextColor={C.text4}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handlePrimary}
            />
          )}

          {/* ─── Paso 1: Diezmo ─── */}
          {onboardStep === 1 && (
            <View style={s.diezmoCards}>
              {[{ val: true, label: 'Sí, diezmo', sub: '10% de cada ingreso' }, { val: false, label: 'No por ahora', sub: 'Sin aporte automático' }].map((opt) => (
                <TouchableOpacity
                  key={String(opt.val)}
                  style={[s.diezmoCard, draft.diezmar === opt.val && s.diezmoCardActive]}
                  onPress={() => dispatch({ type: 'ONBOARD_SET_DIEZMAR', diezmar: opt.val })}
                  activeOpacity={0.7}>
                  <View style={[s.diezmoCheck, draft.diezmar === opt.val && s.diezmoCheckActive]}>
                    {draft.diezmar === opt.val && <Text style={s.diezmoCheckIcon}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.diezmoCardTitle, draft.diezmar === opt.val && { color: C.primary }]}>{opt.label}</Text>
                    <Text style={s.diezmoCardSub}>{opt.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ─── Paso 2: Categorías ─── */}
          {onboardStep === 2 && (
            <View style={s.catsWrap}>
              {draft.cats.map((c) => (
                <View key={c.id} style={s.catRow}>
                  <TouchableOpacity style={[s.catColor, { backgroundColor: c.color }]} onPress={() => dispatch({ type: 'ONBOARD_CYCLE_COLOR', id: c.id })} activeOpacity={0.7} hitSlop={4} />
                  <TextInput style={s.catInput} value={c.label} onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_CAT_LABEL', id: c.id, label: t })} returnKeyType="done" selectTextOnFocus />
                  <TouchableOpacity onPress={() => dispatch({ type: 'ONBOARD_REMOVE_CAT', id: c.id })} activeOpacity={0.7} hitSlop={8} style={s.catDelete}>
                    <Text style={s.catDeleteIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addDashed} onPress={() => dispatch({ type: 'ONBOARD_ADD_CAT' })} activeOpacity={0.7}>
                <Text style={s.addDashedText}>+ Nueva categoría</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Paso 3: Cuentas ─── */}
          {onboardStep === 3 && (
            <View>
              {draft.accounts.map((a) => (
                <View key={a.id} style={s.acctRow}>
                  <TouchableOpacity style={[s.acctColor, { backgroundColor: a.color }]} onPress={() => dispatch({ type: 'ONBOARD_CYCLE_ACCOUNT_COLOR', id: a.id })} activeOpacity={0.7} hitSlop={4} />
                  <TextInput
                    style={s.acctNameInput}
                    value={a.name}
                    onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_ACCOUNT', id: a.id, patch: { name: t } })}
                    placeholder="Nombre de la cuenta"
                    placeholderTextColor={C.text4}
                    returnKeyType="next"
                  />
                  <TextInput
                    style={s.acctSaldoInput}
                    value={maskNum(a.saldo)}
                    onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_ACCOUNT', id: a.id, patch: { saldo: stripNum(t) } })}
                    placeholder="0"
                    placeholderTextColor={C.text4}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                  <TouchableOpacity onPress={() => dispatch({ type: 'ONBOARD_REMOVE_ACCOUNT', id: a.id })} activeOpacity={0.7} hitSlop={8}>
                    <Text style={s.catDeleteIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addDashed} onPress={() => dispatch({ type: 'ONBOARD_ADD_ACCOUNT' })} activeOpacity={0.7}>
                <Text style={s.addDashedText}>+ Nueva cuenta</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Paso 4: Ingresos fijos ─── */}
          {onboardStep === 4 && (
            <View>
              {draft.incomes.map((inc) => (
                <View key={inc.id} style={s.incCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TextInput
                      style={[s.catInput, { flex: 1 }]}
                      value={inc.name}
                      onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_INCOME', id: inc.id, patch: { name: t } })}
                      placeholder="Ej. Salario"
                      placeholderTextColor={C.text4}
                      returnKeyType="next"
                    />
                    <TouchableOpacity onPress={() => dispatch({ type: 'ONBOARD_REMOVE_INCOME', id: inc.id })} activeOpacity={0.7} hitSlop={8}>
                      <Text style={s.catDeleteIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.incLabel}>Bruto</Text>
                      <TextInput
                        style={s.incInput}
                        value={maskNum(inc.bruto)}
                        onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_INCOME', id: inc.id, patch: { bruto: stripNum(t) } })}
                        placeholder="0"
                        placeholderTextColor={C.text4}
                        keyboardType="numeric"
                        returnKeyType="next"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.incLabel}>Entra (neto)</Text>
                      <TextInput
                        style={s.incInput}
                        value={maskNum(inc.neto)}
                        onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_INCOME', id: inc.id, patch: { neto: stripNum(t) } })}
                        placeholder="0"
                        placeholderTextColor={C.text4}
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                  {draft.accounts.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={s.incLabel}>Entra a la cuenta</Text>
                      <View style={s.accountPicker}>
                        {draft.accounts.map((a) => (
                          <TouchableOpacity
                            key={a.id}
                            style={[s.accountChip, inc.accountId === a.id && s.accountChipActive]}
                            onPress={() => dispatch({ type: 'ONBOARD_SET_INCOME', id: inc.id, patch: { accountId: a.id } })}
                            activeOpacity={0.7}>
                            <View style={[s.accountChipDot, { backgroundColor: a.color }]} />
                            <Text style={[s.accountChipText, inc.accountId === a.id && s.accountChipTextActive]}>{a.name || 'Cuenta'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity style={s.addDashed} onPress={() => dispatch({ type: 'ONBOARD_ADD_INCOME' })} activeOpacity={0.7}>
                <Text style={s.addDashedText}>+ Otro ingreso fijo</Text>
              </TouchableOpacity>
              <Text style={s.helpText}>Después podrás añadir ingresos puntuales (bonos, ventas) mes a mes, sin que se repitan.</Text>
            </View>
          )}

          {/* ─── Paso 5: Deudas ─── */}
          {onboardStep === 5 && (
            <View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                {[{ val: true, label: 'Sí, registrar', sub: 'Cuota, saldo y tasa' }, { val: false, label: 'No tengo', sub: 'Omitir por ahora' }].map((opt) => (
                  <TouchableOpacity
                    key={String(opt.val)}
                    style={[s.debtChoice, draft.hasDebts === opt.val && s.debtChoiceActive]}
                    onPress={() => dispatch({ type: 'ONBOARD_SET_HAS_DEBTS', value: opt.val })}
                    activeOpacity={0.7}>
                    <Text style={s.debtChoiceTitle}>{opt.label}</Text>
                    <Text style={s.debtChoiceSub}>{opt.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {draft.hasDebts === true && (
                <View style={{ marginTop: 18 }}>
                  {draft.debts.map((d) => (
                    <View key={d.id} style={s.incCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TextInput
                          style={[s.catInput, { flex: 1 }]}
                          value={d.name}
                          onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_DEBT', id: d.id, patch: { name: t } })}
                          placeholder="Ej. Tarjeta de crédito"
                          placeholderTextColor={C.text4}
                          returnKeyType="next"
                        />
                        <TouchableOpacity onPress={() => dispatch({ type: 'ONBOARD_REMOVE_DEBT', id: d.id })} activeOpacity={0.7} hitSlop={8}>
                          <Text style={s.catDeleteIcon}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ marginTop: 10 }}>
                        <Text style={s.incLabel}>Saldo que debo</Text>
                        <TextInput
                          style={s.incInput}
                          value={maskNum(d.saldo)}
                          onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_DEBT', id: d.id, patch: { saldo: stripNum(t) } })}
                          placeholder="0"
                          placeholderTextColor={C.text4}
                          keyboardType="numeric"
                          returnKeyType="next"
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.incLabel}>Cuota mensual</Text>
                          <TextInput
                            style={s.incInput}
                            value={maskNum(d.cuota)}
                            onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_DEBT', id: d.id, patch: { cuota: stripNum(t) } })}
                            placeholder="0"
                            placeholderTextColor={C.text4}
                            keyboardType="numeric"
                            returnKeyType="next"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.incLabel}>Tasa E.A. %</Text>
                          <TextInput
                            style={s.incInput}
                            value={d.tasa}
                            onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_DEBT', id: d.id, patch: { tasa: t } })}
                            placeholder="0"
                            placeholderTextColor={C.text4}
                            keyboardType="decimal-pad"
                            returnKeyType="next"
                          />
                        </View>
                        <View style={{ width: 72 }}>
                          <Text style={s.incLabel}>Día pago</Text>
                          <TextInput
                            style={s.incInput}
                            value={d.dia ?? ''}
                            onChangeText={(t) => {
                              const digits = t.replace(/[^0-9]/g, '');
                              const num = parseInt(digits, 10);
                              const val = isNaN(num) ? '' : String(Math.min(31, Math.max(1, num)));
                              dispatch({ type: 'ONBOARD_SET_DEBT', id: d.id, patch: { dia: digits === '' ? '' : val } });
                            }}
                            placeholder="1–31"
                            placeholderTextColor={C.text4}
                            keyboardType="numeric"
                            returnKeyType="done"
                            maxLength={2}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={s.addDashed} onPress={() => dispatch({ type: 'ONBOARD_ADD_DEBT' })} activeOpacity={0.7}>
                    <Text style={s.addDashedText}>+ Otro crédito</Text>
                  </TouchableOpacity>
                  <View style={s.debtNote}>
                    <Text style={s.debtNoteText}>La cuota mensual aparecerá automáticamente en tus gastos cada mes. Ordenamos por tasa para priorizar el abono al más caro.</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Botones */}
        <View style={s.footer}>
          {canBack && (
            <TouchableOpacity style={s.backBtn} onPress={() => dispatch({ type: 'ONBOARD_BACK' })} activeOpacity={0.7}>
              <Text style={s.backBtnText}>Atrás</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handlePrimary}
            activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>{isLast ? 'Empezar' : 'Continuar'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  pills: { flexDirection: 'row', gap: 6, paddingHorizontal: 26, paddingTop: 20 },
  pill: { flex: 1, height: 5, borderRadius: 99, backgroundColor: C.surface3 },
  pillActive: { backgroundColor: C.primary },
  scroll: { paddingHorizontal: 26, paddingTop: 32, paddingBottom: 24 },
  tag: { fontSize: 12, fontFamily: F.bold, textTransform: 'uppercase', color: C.primary, letterSpacing: 1.2, marginBottom: 12 },
  title: { fontSize: 30, fontFamily: F.black, color: C.text, lineHeight: 36, marginBottom: 10 },
  subtitle: { fontSize: 14, fontFamily: F.regular, color: C.text3, lineHeight: 21, marginBottom: 28 },

  // Paso 0
  nameInput: { fontSize: 18, fontFamily: F.medium, color: C.text, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.primaryBorder, borderRadius: 14, padding: 16 },

  // Paso 1
  diezmoCards: { gap: 12 },
  diezmoCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 16 },
  diezmoCardActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  diezmoCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  diezmoCheckActive: { backgroundColor: C.primary, borderColor: C.primary },
  diezmoCheckIcon: { fontSize: 12, color: '#fff', fontFamily: F.bold },
  diezmoCardTitle: { fontSize: 15, fontFamily: F.bold, color: C.text },
  diezmoCardSub: { fontSize: 12, fontFamily: F.regular, color: C.text3, marginTop: 3 },

  // Paso 2 — Categorías
  catsWrap: { gap: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14 },
  catColor: { width: 22, height: 22, borderRadius: 11, flexShrink: 0 },
  catInput: { flex: 1, fontSize: 14, fontFamily: F.medium, color: C.text, padding: 0 },
  catDelete: { padding: 4 },
  catDeleteIcon: { fontSize: 13, color: C.text4 },

  // Paso 3 — Cuentas
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, paddingHorizontal: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginBottom: 10 },
  acctColor: { width: 30, height: 30, borderRadius: 9, flexShrink: 0 },
  acctNameInput: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: F.medium, color: C.text, padding: 8, paddingHorizontal: 0, backgroundColor: 'transparent' },
  acctSaldoInput: { width: 98, padding: 8, paddingHorizontal: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, fontSize: 13, fontFamily: F.monoBold, color: C.text, textAlign: 'right' },

  // Paso 4 — Ingresos
  incCard: { padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, marginBottom: 12 },
  incLabel: { fontSize: 9, fontFamily: F.medium, letterSpacing: 0.8, textTransform: 'uppercase', color: C.text4, marginBottom: 6 },
  incInput: { width: '100%', padding: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, fontSize: 13, fontFamily: F.monoBold, color: C.text },
  accountPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 99 },
  accountChipActive: { backgroundColor: C.primaryBg, borderColor: C.primaryBorder },
  accountChipDot: { width: 8, height: 8, borderRadius: 4 },
  accountChipText: { fontSize: 12, fontFamily: F.medium, color: C.text3 },
  accountChipTextActive: { color: C.primary, fontFamily: F.bold },
  helpText: { marginTop: 12, fontSize: 12, fontFamily: F.regular, color: C.text4, lineHeight: 18 },

  // Paso 5 — Deudas
  debtChoice: { flex: 1, padding: 18, paddingVertical: 18, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 18 },
  debtChoiceActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  debtChoiceTitle: { fontSize: 16, fontFamily: F.bold, color: C.text, lineHeight: 20 },
  debtChoiceSub: { fontSize: 12, fontFamily: F.regular, color: C.text3, marginTop: 6, lineHeight: 16 },
  debtNote: { marginTop: 14, padding: 13, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, borderRadius: 14 },
  debtNoteText: { fontSize: 12, fontFamily: F.regular, color: C.text2, lineHeight: 18 },

  // Shared
  addDashed: { padding: 13, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.dashedBorder, borderRadius: 14, marginTop: 2 },
  addDashedText: { fontSize: 13, fontFamily: F.bold, color: C.primary },

  // Footer
  footer: { flexDirection: 'row', gap: 10, padding: 20, paddingTop: 8 },
  backBtn: { paddingVertical: 16, paddingHorizontal: 20, backgroundColor: C.surface2, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 15, fontFamily: F.bold, color: C.text2 },
  primaryBtn: { flex: 1, paddingVertical: 16, paddingHorizontal: 24, backgroundColor: C.primary, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontFamily: F.bold, color: '#fff' },
});
