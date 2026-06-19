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
import { C } from '@/constants/colors';
import { selectCurrentBudget, useBudget } from '@/store/budget';
import type { Category } from '@/types';

// Formatea número como moneda colombiana: 1500000 → "1.500.000"
function maskMoney(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('es-CO');
}

// Extrae solo dígitos para guardar en el store
function stripMoney(formatted: string): string {
  return formatted.replace(/[^0-9]/g, '');
}

const CATS: { key: Category; label: string; color: string }[] = [
  { key: 'cred', label: 'Crediservir', color: '#5f9d72' },
  { key: 'fijo', label: 'Fijo', color: '#c79a4a' },
  { key: 'tarjeta', label: 'Tarjeta', color: '#9b7ad6' },
  { key: 'var', label: 'Variable', color: C.textSecondary },
];

export function BudgetBottomSheet() {
  const { state, dispatch } = useBudget();
  const { sheet } = state;
  const accounts = selectCurrentBudget(state)?.accounts ?? [];
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
  const isForm = activeSheet.kind !== 'pay';
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
  const showA2 = activeSheet.kind === 'gasto' || activeSheet.kind === 'income' || activeSheet.kind === 'deuda';
  const showDelete = isEdit && (activeSheet.kind === 'gasto' || activeSheet.kind === 'income' || activeSheet.kind === 'cuenta' || activeSheet.kind === 'deuda');

  const accountNames = accounts.map((a) => a.name);
  const toNames = ['Efectivo', ...accountNames.filter((n) => n !== activeSheet.from)];

  const payGastoId = activeSheet.gastoId ?? '';
  const paySources = [
    ...accounts.map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      sub: '$' + Math.round(a.saldo).toLocaleString('es-CO') + ' disponible',
    })),
    { id: 'efectivo', name: 'Efectivo', color: '#a8a092', sub: 'No afecta ninguna cuenta' },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <KeyboardAvoidingView
        style={s.kvWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={s.handle} />

          {isPay && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: '90%' }}>
              <Text style={s.title}>{sheetTitle()}</Text>
              <Text style={s.subtitle}>Selecciona cuánto pagaste y desde dónde</Text>

              {/* Presupuestado */}
              <View style={s.payBudgetRow}>
                <Text style={s.payBudgetKey}>Presupuestado</Text>
                <Text style={s.payBudgetVal}>
                  {'$' + Math.round(activeSheet.payBudgeted ?? 0).toLocaleString('es-CO')}
                </Text>
              </View>

              {/* ¿Cuánto pagaste? */}
              <Text style={s.fieldLabel}>¿Cuánto pagaste?</Text>
              <View style={s.payModeToggle}>
                <TouchableOpacity
                  style={[s.payModeOpt, activeSheet.payMode !== 'otro' && s.payModeOptActive]}
                  onPress={() => dispatch({ type: 'SET_SHEET', patch: { payMode: 'same' } })}
                  activeOpacity={0.7}>
                  <Text style={[s.payModeText, activeSheet.payMode !== 'otro' && s.payModeTextActive]}>
                    Lo presupuestado
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.payModeOpt, activeSheet.payMode === 'otro' && s.payModeOptActive]}
                  onPress={() => dispatch({ type: 'SET_SHEET', patch: { payMode: 'otro' } })}
                  activeOpacity={0.7}>
                  <Text style={[s.payModeText, activeSheet.payMode === 'otro' && s.payModeTextActive]}>
                    Otro valor
                  </Text>
                </TouchableOpacity>
              </View>

              {activeSheet.payMode === 'otro' && (
                <TextInput
                  style={[s.inputMono, { marginBottom: 16, borderColor: 'rgba(200,168,106,0.35)' }]}
                  value={maskMoney(activeSheet.payAmt ?? '')}
                  onChangeText={(t) => dispatch({ type: 'SET_SHEET', patch: { payAmt: stripMoney(t) } })}
                  placeholder="0"
                  placeholderTextColor={C.textDeep}
                  keyboardType="numeric"
                  returnKeyType="done"
                  autoFocus
                />
              )}

              {/* Cuenta */}
              <Text style={s.fieldLabel}>¿De qué cuenta salió?</Text>
              {paySources.map((src) => (
                <TouchableOpacity
                  key={src.id}
                  style={s.payRow}
                  onPress={() => dispatch({ type: 'TOGGLE_GASTO_PAID', gastoId: payGastoId, sourceId: src.id, sourceName: src.name })}
                  activeOpacity={0.7}>
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

          {isForm && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.title}>{sheetTitle()}</Text>

              {activeSheet.kind !== 'mov' && (
                <>
                  <Text style={s.fieldLabel}>{activeSheet.kind === 'cuenta' ? 'Nombre de la cuenta' : activeSheet.kind === 'deuda' ? 'Nombre de la deuda' : activeSheet.kind === 'income' ? 'Fuente de ingreso' : 'Nombre del gasto'}</Text>
                  <TextInput
                    style={s.input}
                    value={activeSheet.name ?? ''}
                    onChangeText={(t) => dispatch({ type: 'SET_SHEET', patch: { name: t } })}
                    placeholder="Nombre"
                    placeholderTextColor={C.textDeep}
                    returnKeyType="done"
                  />
                </>
              )}

              {showCat && (
                <>
                  <Text style={s.fieldLabel}>Categoría</Text>
                  <View style={s.catRow}>
                    {CATS.map((c) => {
                      const active = activeSheet.cat === c.key;
                      return (
                        <TouchableOpacity
                          key={c.key}
                          style={[s.catChip, active && { backgroundColor: c.color + '33', borderColor: c.color }]}
                          onPress={() => dispatch({ type: 'SET_SHEET', patch: { cat: c.key } })}
                          activeOpacity={0.7}>
                          <Text style={[s.catLabel, { color: active ? c.color : C.textMuted }]}>{c.label}</Text>
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
                          <TouchableOpacity
                            key={n}
                            style={[s.selectChip, activeSheet.from === n && s.selectChipActive]}
                            onPress={() => dispatch({ type: 'SET_SHEET', patch: { from: n } })}
                            activeOpacity={0.7}>
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
                            <TouchableOpacity
                              key={n}
                              style={[s.selectChip, activeSheet.to === n && s.selectChipActive]}
                              onPress={() => dispatch({ type: 'SET_SHEET', patch: { to: n } })}
                              activeOpacity={0.7}>
                              <Text style={[s.selectChipText, activeSheet.to === n && s.selectChipTextActive]}>{n}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <View style={s.amtRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>{a1Label()}</Text>
                  <TextInput
                    style={s.inputMono}
                    value={maskMoney(activeSheet.a1 ?? '')}
                    onChangeText={(t) => dispatch({ type: 'SET_SHEET', patch: { a1: stripMoney(t) } })}
                    placeholder="0"
                    placeholderTextColor={C.textDeep}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
                {showA2 && (
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>{a2Label()}</Text>
                    <TextInput
                      style={s.inputMono}
                      value={activeSheet.kind === 'deuda'
                        ? (activeSheet.a2 ?? '')
                        : maskMoney(activeSheet.a2 ?? '')}
                      onChangeText={(t) => dispatch({
                        type: 'SET_SHEET',
                        patch: { a2: activeSheet.kind === 'deuda' ? t : stripMoney(t) },
                      })}
                      placeholder={activeSheet.kind === 'deuda' ? '0,00' : '0'}
                      placeholderTextColor={C.textDeep}
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

const s = StyleSheet.create({
  kvWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,168,106,0.2)',
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#3a3c43',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'InstrumentSerif_400Regular',
    color: C.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: C.textMuted,
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#7c7870',
    marginBottom: 9,
    marginTop: 14,
  },
  input: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.borderMid,
    borderRadius: 13,
    padding: 14,
    color: C.textPrimary,
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
  },
  inputMono: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.borderMid,
    borderRadius: 13,
    padding: 14,
    color: C.textPrimary,
    fontSize: 15,
    fontFamily: 'SpaceMono_700Bold',
  },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.borderMid,
  },
  catLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
  },
  fromToRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectBox: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.borderMid,
    borderRadius: 13,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 4,
  },
  selectChipActive: {
    backgroundColor: C.goldBg,
  },
  selectChipText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: C.textMuted,
  },
  selectChipTextActive: {
    color: C.goldLight,
    fontFamily: 'Manrope_600SemiBold',
  },
  amtRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  deleteBtn: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: 'rgba(224,108,108,0.3)',
    borderRadius: 14,
  },
  deleteIcon: {
    fontSize: 16,
    color: C.red,
  },
  saveBtn: {
    flex: 1,
    padding: 16,
    backgroundColor: C.gold,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: '#1a1408',
  },
  payBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    marginBottom: 16,
  },
  payBudgetKey: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: C.textMuted,
  },
  payBudgetVal: {
    fontSize: 15,
    fontFamily: 'SpaceMono_700Bold',
    color: '#cfc9bd',
  },
  payModeToggle: {
    flexDirection: 'row',
    backgroundColor: C.bg3,
    borderRadius: 99,
    padding: 3,
    marginBottom: 14,
  },
  payModeOpt: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 99,
    alignItems: 'center',
  },
  payModeOptActive: {
    backgroundColor: C.bg1,
  },
  payModeText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: C.textDim,
    textAlign: 'center',
  },
  payModeTextActive: {
    color: C.textPrimary,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    marginBottom: 10,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 99,
    flexShrink: 0,
  },
  payName: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: C.textPrimary,
  },
  paySub: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    color: C.textMuted,
    marginTop: 5,
  },
  payArrow: {
    fontSize: 18,
    color: C.textSecondary,
    fontFamily: 'Manrope_600SemiBold',
  },
});
