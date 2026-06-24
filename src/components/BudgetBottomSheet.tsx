import { useEffect, useRef } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/constants/colors';
import { ACCT_PALETTE, CAT_PALETTE, selectCurrentBudget, useBudget } from '@/store/budget';
import type { CategoryDef } from '@/types';

function maskMoney(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('es-CO');
}

function stripMoney(formatted: string): string {
  return formatted.replace(/[^0-9]/g, '');
}

// Fallback si el profile no tiene cats cargadas aún
const FALLBACK_CATS: CategoryDef[] = [
  { id: 'cat_cred', key: 'cred', label: 'Crediservir', color: C.green },
  { id: 'cat_fijo', key: 'fijo', label: 'Fijo', color: C.orange },
  { id: 'cat_tarjeta', key: 'tarjeta', label: 'Tarjeta', color: C.purple },
  { id: 'cat_var', key: 'var', label: 'Variable', color: C.text3 },
];

export function BudgetBottomSheet() {
  const { state, dispatch } = useBudget();
  const { sheet } = state;
  const accounts = selectCurrentBudget(state)?.accounts ?? [];
  const cats = state.profile?.cats?.length ? state.profile.cats : FALLBACK_CATS;
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sheet) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [sheet != null]);

  if (!sheet) return null;
  const activeSheet = sheet;

  function close() {
    Keyboard.dismiss();
    dispatch({ type: 'CLOSE_SHEET' });
  }

  const isPay = activeSheet.kind === 'pay';
  const isProfile = activeSheet.kind === 'profile';
  const isForm = !isPay && !isProfile;
  const isEdit = activeSheet.mode === 'edit';

  function sheetTitle() {
    if (isPay) return activeSheet.gastoName ?? '';
    switch (activeSheet.kind) {
      case 'gasto': return isEdit ? 'Editar gasto' : 'Nuevo gasto';
      case 'income': return isEdit ? 'Editar ingreso' : 'Nuevo ingreso';
      case 'cuenta': return isEdit ? 'Editar cuenta' : 'Nueva cuenta';
      case 'deuda': return isEdit ? 'Editar deuda' : 'Nueva deuda';
      case 'mov': return activeSheet.type === 'transfer' ? 'Mover dinero' : 'Retirar dinero';
      default: return '';
    }
  }

  function a1Label() {
    if (activeSheet.kind === 'deuda') return 'Saldo actual';
    if (activeSheet.kind === 'income') return 'Salario bruto';
    if (activeSheet.kind === 'mov') return 'Monto';
    return 'Monto presupuestado';
  }

  function a2Label() {
    if (activeSheet.kind === 'gasto') return 'Monto real (si difiere)';
    if (activeSheet.kind === 'income') return 'Neto a recibir';
    if (activeSheet.kind === 'deuda') return 'Tasa E.A. %';
    return '';
  }

  const showCat = activeSheet.kind === 'gasto';
  const showFromTo = activeSheet.kind === 'mov';
  const showTo = showFromTo && activeSheet.type === 'transfer';
  const showA2 = (activeSheet.kind === 'gasto' && isEdit) || activeSheet.kind === 'income' || activeSheet.kind === 'deuda';
  const showDelete = isEdit && (activeSheet.kind === 'gasto' || activeSheet.kind === 'income' || activeSheet.kind === 'cuenta' || activeSheet.kind === 'deuda');

  const accountNames = accounts.map((a) => a.name);
  const toNames = ['Efectivo', ...accountNames.filter((n) => n !== activeSheet.from)];
  const payGastoId = activeSheet.gastoId ?? '';
  const paySources = [
    ...accounts.map((a) => ({ id: a.id, name: a.name, color: a.color, sub: fmt(a.saldo) + ' disponible' })),
    { id: 'efectivo', name: 'Efectivo', color: C.text3, sub: 'No afecta ninguna cuenta' },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: 'rgba(20,28,40,0.4)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <KeyboardAvoidingView style={s.kvWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={s.handle} />

          {isPay && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: '90%' }}>
              <Text style={s.title}>{sheetTitle()}</Text>
              <Text style={s.subtitle}>Selecciona cuánto pagaste y desde dónde</Text>

              <View style={s.payBudgetRow}>
                <Text style={s.payBudgetKey}>Presupuestado</Text>
                <Text style={s.payBudgetVal}>{'$' + Math.round(activeSheet.payBudgeted ?? 0).toLocaleString('es-CO')}</Text>
              </View>

              <Text style={s.fieldLabel}>¿Cuánto pagaste?</Text>
              <View style={s.payModeToggle}>
                <TouchableOpacity style={[s.payModeOpt, activeSheet.payMode !== 'otro' && s.payModeOptActive]} onPress={() => dispatch({ type: 'SET_SHEET', patch: { payMode: 'same' } })} activeOpacity={0.7}>
                  <Text style={[s.payModeText, activeSheet.payMode !== 'otro' && s.payModeTextActive]}>Lo presupuestado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.payModeOpt, activeSheet.payMode === 'otro' && s.payModeOptActive]} onPress={() => dispatch({ type: 'SET_SHEET', patch: { payMode: 'otro' } })} activeOpacity={0.7}>
                  <Text style={[s.payModeText, activeSheet.payMode === 'otro' && s.payModeTextActive]}>Otro valor</Text>
                </TouchableOpacity>
              </View>

              {activeSheet.payMode === 'otro' && (
                <TextInput
                  style={[s.inputMono, { marginBottom: 16, borderColor: C.primaryBorder }]}
                  value={maskMoney(activeSheet.payAmt ?? '')}
                  onChangeText={(t) => dispatch({ type: 'SET_SHEET', patch: { payAmt: stripMoney(t) } })}
                  placeholder="0"
                  placeholderTextColor={C.text4}
                  keyboardType="numeric"
                  returnKeyType="done"
                  autoFocus
                />
              )}

              <Text style={s.fieldLabel}>¿De qué cuenta salió?</Text>
              {paySources.map((src) => (
                <TouchableOpacity key={src.id} style={s.payRow} onPress={() => dispatch({ type: 'TOGGLE_GASTO_PAID', gastoId: payGastoId, sourceId: src.id, sourceName: src.name })} activeOpacity={0.7}>
                  <View style={[s.dot, { backgroundColor: src.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.payName}>{src.name}</Text>
                    <Text style={s.paySub}>{src.sub}</Text>
                  </View>
                  <Text style={s.payArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {isProfile && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: '90%' }}>
              <Text style={s.title}>Perfil y ajustes</Text>

              <Text style={s.fieldLabel}>Tu nombre</Text>
              <TextInput
                style={s.input}
                value={state.draft.name}
                onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_NAME', name: t })}
                placeholder="Tu nombre"
                placeholderTextColor={C.text4}
                returnKeyType="done"
              />

              <Text style={s.fieldLabel}>Diezmo</Text>
              <View style={[s.profileToggleRow, state.draft.diezmar === true && s.profileToggleActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.profileToggleTitle}>Apartar 10% de cada ingreso</Text>
                  <Text style={s.profileToggleSub}>{state.draft.diezmar ? 'Activado' : 'Desactivado'}</Text>
                </View>
                <TouchableOpacity
                  style={[s.diezmoTogglePill, state.draft.diezmar ? s.diezmoTogglePillOn : s.diezmoTogglePillOff]}
                  onPress={() => dispatch({ type: 'ONBOARD_SET_DIEZMAR', diezmar: !state.draft.diezmar })}
                  activeOpacity={0.7}>
                  <Text style={[s.diezmoTogglePillText, state.draft.diezmar ? s.diezmoTogglePillTextOn : s.diezmoTogglePillTextOff]}>
                    {state.draft.diezmar ? 'Sí' : 'No'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={s.fieldLabel}>Categorías</Text>
              {state.draft.cats.map((c) => (
                <View key={c.id} style={s.profileCatRow}>
                  <TouchableOpacity
                    style={[s.profileCatColor, { backgroundColor: c.color }]}
                    onPress={() => dispatch({ type: 'ONBOARD_CYCLE_COLOR', id: c.id })}
                    activeOpacity={0.7}
                    hitSlop={4}
                  />
                  <TextInput
                    style={s.profileCatInput}
                    value={c.label}
                    onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_CAT_LABEL', id: c.id, label: t })}
                    returnKeyType="done"
                  />
                  <TouchableOpacity onPress={() => dispatch({ type: 'ONBOARD_REMOVE_CAT', id: c.id })} activeOpacity={0.7} hitSlop={8}>
                    <Text style={s.profileCatDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.profileAddCat} onPress={() => dispatch({ type: 'ONBOARD_ADD_CAT' })} activeOpacity={0.7}>
                <Text style={s.profileAddCatText}>+ Nueva categoría</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.saveBtn, { marginTop: 24, marginBottom: 8 }]} onPress={() => dispatch({ type: 'PROFILE_SAVE' })} activeOpacity={0.8}>
                <Text style={s.saveBtnText}>Listo</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {isForm && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.title}>{sheetTitle()}</Text>

              {/* Swatches de color para cuentas */}
              {activeSheet.kind === 'cuenta' && (
                <>
                  <Text style={s.fieldLabel}>Color</Text>
                  <View style={s.swatchRow}>
                    {ACCT_PALETTE.map((col) => (
                      <TouchableOpacity
                        key={col}
                        style={[s.swatch, { backgroundColor: col }, activeSheet.color === col && s.swatchActive]}
                        onPress={() => dispatch({ type: 'SET_SHEET', patch: { color: col } })}
                        activeOpacity={0.7}
                      />
                    ))}
                  </View>
                </>
              )}

              {activeSheet.kind !== 'mov' && (
                <>
                  <Text style={s.fieldLabel}>
                    {activeSheet.kind === 'cuenta' ? 'Nombre de la cuenta' : activeSheet.kind === 'deuda' ? 'Nombre de la deuda' : activeSheet.kind === 'income' ? 'Fuente de ingreso' : 'Nombre del gasto'}
                  </Text>
                  <TextInput
                    style={s.input}
                    value={activeSheet.name ?? ''}
                    onChangeText={(t) => dispatch({ type: 'SET_SHEET', patch: { name: t } })}
                    placeholder="Nombre"
                    placeholderTextColor={C.text4}
                    returnKeyType="done"
                  />
                </>
              )}

              {showCat && (
                <>
                  <Text style={s.fieldLabel}>Categoría</Text>
                  <View style={s.catRow}>
                    {cats.map((c) => {
                      const active = activeSheet.cat === c.key;
                      return (
                        <TouchableOpacity key={c.key} style={[s.catChip, active && { backgroundColor: c.color + '18', borderColor: c.color }]} onPress={() => dispatch({ type: 'SET_SHEET', patch: { cat: c.key } })} activeOpacity={0.7}>
                          <Text style={[s.catLabel, { color: active ? c.color : C.text3 }]}>{c.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {showFromTo && (
                <View style={s.fromToRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Desde</Text>
                    <View style={s.selectBox}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {accountNames.map((n) => (
                          <TouchableOpacity key={n} style={[s.selectChip, activeSheet.from === n && s.selectChipActive]} onPress={() => dispatch({ type: 'SET_SHEET', patch: { from: n } })} activeOpacity={0.7}>
                            <Text style={[s.selectChipText, activeSheet.from === n && s.selectChipTextActive]}>{n}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                  {showTo && (
                    <View style={{ flex: 1 }}>
                      <Text style={s.fieldLabel}>Hacia</Text>
                      <View style={s.selectBox}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {toNames.map((n) => (
                            <TouchableOpacity key={n} style={[s.selectChip, activeSheet.to === n && s.selectChipActive]} onPress={() => dispatch({ type: 'SET_SHEET', patch: { to: n } })} activeOpacity={0.7}>
                              <Text style={[s.selectChipText, activeSheet.to === n && s.selectChipTextActive]}>{n}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Selector de cuenta destino (solo ingresos) */}
              {activeSheet.kind === 'income' && accounts.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>Entra a la cuenta</Text>
                  <View style={s.selectBox}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {accounts.map((a) => (
                        <TouchableOpacity
                          key={a.id}
                          style={[s.selectChip, activeSheet.accountId === a.id && s.selectChipActive]}
                          onPress={() => dispatch({ type: 'SET_SHEET', patch: { accountId: a.id } })}
                          activeOpacity={0.7}>
                          <View style={[s.dot, { backgroundColor: a.color, marginRight: 5 }]} />
                          <Text style={[s.selectChipText, activeSheet.accountId === a.id && s.selectChipTextActive]}>{a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </>
              )}

              {/* Toggle Fijo / Solo este mes (solo ingresos) */}
              {activeSheet.kind === 'income' && (
                <>
                  <Text style={s.fieldLabel}>Frecuencia</Text>
                  <View style={s.recToggleRow}>
                    {([{ val: true, label: 'Ingreso fijo', sub: 'Se repite cada mes' }, { val: false, label: 'Solo este mes', sub: 'No se repite' }] as const).map((opt) => (
                      <TouchableOpacity
                        key={String(opt.val)}
                        style={[s.recToggleOpt, activeSheet.recurrente === opt.val && s.recToggleOptActive]}
                        onPress={() => dispatch({ type: 'SET_SHEET', patch: { recurrente: opt.val } })}
                        activeOpacity={0.7}>
                        <Text style={[s.recToggleTitle, activeSheet.recurrente === opt.val && s.recToggleTitleActive]}>{opt.label}</Text>
                        <Text style={s.recToggleSub}>{opt.sub}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={s.amtRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>{a1Label()}</Text>
                  <TextInput
                    style={s.inputMono}
                    value={maskMoney(activeSheet.a1 ?? '')}
                    onChangeText={(t) => dispatch({ type: 'SET_SHEET', patch: { a1: stripMoney(t) } })}
                    placeholder="0"
                    placeholderTextColor={C.text4}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
                {showA2 && (
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>{a2Label()}</Text>
                    <TextInput
                      style={s.inputMono}
                      value={activeSheet.kind === 'deuda' ? (activeSheet.a2 ?? '') : maskMoney(activeSheet.a2 ?? '')}
                      onChangeText={(t) => dispatch({ type: 'SET_SHEET', patch: { a2: activeSheet.kind === 'deuda' ? t : stripMoney(t) } })}
                      placeholder={activeSheet.kind === 'deuda' ? '0,00' : '0'}
                      placeholderTextColor={C.text4}
                      keyboardType="numeric"
                      returnKeyType="done"
                    />
                  </View>
                )}
              </View>

              <View style={s.actionRow}>
                {showDelete && (
                  <TouchableOpacity style={s.deleteBtn} onPress={() => dispatch({ type: 'DELETE_SHEET' })} activeOpacity={0.7}>
                    <Text style={s.deleteIcon}>✕</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.saveBtn} onPress={() => dispatch({ type: 'SAVE_SHEET' })} activeOpacity={0.8}>
                  <Text style={s.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Agregar'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function fmt(n: number) { return '$' + Math.round(n || 0).toLocaleString('es-CO'); }

const s = StyleSheet.create({
  kvWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    paddingHorizontal: 24,
    shadowColor: C.sheetShadow,
    shadowOffset: { width: 0, height: -12 },
    shadowRadius: 40,
    shadowOpacity: 1,
    elevation: 20,
  },
  handle: { width: 38, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontFamily: F.bold, color: C.text, marginBottom: 6 },
  subtitle: { fontSize: 13, fontFamily: F.regular, color: C.text3, marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.2, textTransform: 'uppercase', color: C.text3, marginBottom: 9, marginTop: 14 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 14, color: C.text, fontSize: 15, fontFamily: F.medium },
  inputMono: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 14, color: C.text, fontSize: 15, fontFamily: F.monoBold },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  catLabel: { fontSize: 12, fontFamily: F.bold },
  fromToRow: { flexDirection: 'row', gap: 12 },
  selectBox: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingVertical: 6, paddingHorizontal: 8, minHeight: 48 },
  selectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 4 },
  selectChipActive: { backgroundColor: C.primaryBg },
  selectChipText: { fontSize: 13, fontFamily: F.medium, color: C.text3 },
  selectChipTextActive: { color: C.primary, fontFamily: F.bold },
  amtRow: { flexDirection: 'row', gap: 12 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 8 },
  deleteBtn: { width: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBorder, borderRadius: 14 },
  deleteIcon: { fontSize: 16, color: C.red },
  saveBtn: { flex: 1, padding: 16, backgroundColor: C.primary, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: F.bold, color: '#fff' },
  payBudgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginBottom: 16 },
  payBudgetKey: { fontSize: 12, fontFamily: F.medium, color: C.text3 },
  payBudgetVal: { fontSize: 15, fontFamily: F.monoBold, color: C.text2 },
  payModeToggle: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 99, padding: 3, marginBottom: 14 },
  payModeOpt: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 99, alignItems: 'center' },
  payModeOptActive: { backgroundColor: C.bg },
  payModeText: { fontSize: 12, fontFamily: F.bold, color: C.text3, textAlign: 'center' },
  payModeTextActive: { color: C.text },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginBottom: 10 },
  dot: { width: 11, height: 11, borderRadius: 99, flexShrink: 0 },
  payName: { fontSize: 15, fontFamily: F.bold, color: C.text },
  paySub: { fontSize: 11, fontFamily: F.regular, color: C.text3, marginTop: 5 },
  payArrow: { fontSize: 18, color: C.text3, fontFamily: F.bold },
  profileToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginBottom: 8 },
  profileToggleActive: { borderColor: C.primaryBorder, backgroundColor: C.primaryBg },
  profileToggleTitle: { fontSize: 14, fontFamily: F.medium, color: C.text },
  profileToggleSub: { fontSize: 12, fontFamily: F.regular, color: C.text3, marginTop: 2 },
  diezmoTogglePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  diezmoTogglePillOn: { backgroundColor: C.primary, borderColor: C.primary },
  diezmoTogglePillOff: { backgroundColor: C.surface2, borderColor: C.border },
  diezmoTogglePillText: { fontSize: 13, fontFamily: F.bold },
  diezmoTogglePillTextOn: { color: '#fff' },
  diezmoTogglePillTextOff: { color: C.text3 },
  profileCatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8 },
  profileCatColor: { width: 20, height: 20, borderRadius: 10, flexShrink: 0 },
  profileCatInput: { flex: 1, fontSize: 14, fontFamily: F.medium, color: C.text, padding: 0 },
  profileCatDelete: { fontSize: 13, color: C.text4, padding: 4 },
  profileAddCat: { padding: 12, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: C.primaryBorder, borderRadius: 12 },
  profileAddCatText: { fontSize: 13, fontFamily: F.bold, color: C.primary },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  swatchActive: { borderWidth: 3, borderColor: C.text },
  recToggleRow: { flexDirection: 'row', gap: 10 },
  recToggleOpt: { flex: 1, padding: 13, paddingVertical: 12, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 14 },
  recToggleOptActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  recToggleTitle: { fontSize: 13, fontFamily: F.bold, color: C.text },
  recToggleTitleActive: { color: C.primary },
  recToggleSub: { fontSize: 11, fontFamily: F.regular, color: C.text3, marginTop: 3 },
});
