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
import { C, F } from '@/constants/colors';
import { CAT_PALETTE, useBudget } from '@/store/budget';

const STEPS = [
  { tag: 'Bienvenido', title: '¿Cómo te llamas?', subtitle: 'Lo usaremos para saludarte en tu presupuesto.' },
  { tag: 'Aporte', title: '¿Deseas presupuestar tu diezmo?', subtitle: 'Si lo activas, apartamos el 10% de cada ingreso como aporte y lo verás en tus gastos.' },
  { tag: 'Organiza', title: 'Tus categorías', subtitle: 'Renómbralas, toca el color para cambiarlo o elimina las que no uses. Podrás ajustarlas luego.' },
];

export function OnboardingScreen() {
  const { state, dispatch } = useBudget();
  const { onboardStep, draft } = state;

  const isLast = onboardStep === 2;
  const canBack = onboardStep > 0;

  function handlePrimary() {
    if (!isLast) {
      dispatch({ type: 'ONBOARD_NEXT' });
    } else {
      dispatch({ type: 'ONBOARD_COMPLETE' });
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Progress pills */}
        <View style={s.pills}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[s.pill, i <= onboardStep && s.pillActive]} />
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Text style={s.tag}>{STEPS[onboardStep].tag}</Text>
          <Text style={s.title}>{STEPS[onboardStep].title}</Text>
          <Text style={s.subtitle}>{STEPS[onboardStep].subtitle}</Text>

          {/* Step 0: Name */}
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

          {/* Step 1: Diezmo */}
          {onboardStep === 1 && (
            <View style={s.diezmoCards}>
              <TouchableOpacity
                style={[s.diezmoCard, draft.diezmar === true && s.diezmoCardActive]}
                onPress={() => dispatch({ type: 'ONBOARD_SET_DIEZMAR', diezmar: true })}
                activeOpacity={0.7}>
                <View style={[s.diezmoCheck, draft.diezmar === true && s.diezmoCheckActive]}>
                  {draft.diezmar === true && <Text style={s.diezmoCheckIcon}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.diezmoCardTitle, draft.diezmar === true && { color: C.primary }]}>Sí, diezmo</Text>
                  <Text style={s.diezmoCardSub}>10% de cada ingreso</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.diezmoCard, draft.diezmar === false && s.diezmoCardActive]}
                onPress={() => dispatch({ type: 'ONBOARD_SET_DIEZMAR', diezmar: false })}
                activeOpacity={0.7}>
                <View style={[s.diezmoCheck, draft.diezmar === false && s.diezmoCheckActive]}>
                  {draft.diezmar === false && <Text style={s.diezmoCheckIcon}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.diezmoCardTitle, draft.diezmar === false && { color: C.primary }]}>No por ahora</Text>
                  <Text style={s.diezmoCardSub}>Sin aporte automático</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Categories */}
          {onboardStep === 2 && (
            <View style={s.catsWrap}>
              {draft.cats.map((c) => (
                <View key={c.id} style={s.catRow}>
                  <TouchableOpacity
                    style={[s.catColor, { backgroundColor: c.color }]}
                    onPress={() => dispatch({ type: 'ONBOARD_CYCLE_COLOR', id: c.id })}
                    activeOpacity={0.7}
                    hitSlop={4}
                  />
                  <TextInput
                    style={s.catInput}
                    value={c.label}
                    onChangeText={(t) => dispatch({ type: 'ONBOARD_SET_CAT_LABEL', id: c.id, label: t })}
                    returnKeyType="done"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    onPress={() => dispatch({ type: 'ONBOARD_REMOVE_CAT', id: c.id })}
                    activeOpacity={0.7}
                    hitSlop={8}
                    style={s.catDelete}>
                    <Text style={s.catDeleteIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addCatBtn} onPress={() => dispatch({ type: 'ONBOARD_ADD_CAT' })} activeOpacity={0.7}>
                <Text style={s.addCatText}>+ Nueva categoría</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Buttons */}
        <View style={s.footer}>
          {canBack && (
            <TouchableOpacity style={s.backBtn} onPress={() => dispatch({ type: 'ONBOARD_BACK' })} activeOpacity={0.7}>
              <Text style={s.backBtnText}>Atrás</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.primaryBtn, { flex: canBack ? 1 : undefined, width: canBack ? undefined : '100%' }]} onPress={handlePrimary} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>{isLast ? 'Crear presupuesto' : 'Siguiente'}</Text>
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
  subtitle: { fontSize: 14, fontFamily: F.regular, color: C.text3, lineHeight: 21, marginBottom: 32 },
  nameInput: {
    fontSize: 18,
    fontFamily: F.medium,
    color: C.text,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    borderRadius: 14,
    padding: 16,
  },
  diezmoCards: { gap: 12 },
  diezmoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  diezmoCardActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  diezmoCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  diezmoCheckActive: { backgroundColor: C.primary, borderColor: C.primary },
  diezmoCheckIcon: { fontSize: 12, color: '#fff', fontFamily: F.bold },
  diezmoCardTitle: { fontSize: 15, fontFamily: F.bold, color: C.text },
  diezmoCardSub: { fontSize: 12, fontFamily: F.regular, color: C.text3, marginTop: 3 },
  catsWrap: { gap: 10 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
  },
  catColor: { width: 22, height: 22, borderRadius: 11, flexShrink: 0 },
  catInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: F.medium,
    color: C.text,
    padding: 0,
  },
  catDelete: { padding: 4 },
  catDeleteIcon: { fontSize: 13, color: C.text4 },
  addCatBtn: { padding: 14, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: C.primaryBorder, borderRadius: 14 },
  addCatText: { fontSize: 14, fontFamily: F.bold, color: C.primary },
  footer: { flexDirection: 'row', gap: 10, padding: 20, paddingTop: 8 },
  backBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: C.surface2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, fontFamily: F.bold, color: C.text2 },
  primaryBtn: { paddingVertical: 16, paddingHorizontal: 24, backgroundColor: C.primary, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontFamily: F.bold, color: '#fff' },
});
