import type { FiltroTitular as Filtro } from '@steward/domain';
import { Pressable, Text, View } from 'react-native';

import { useMiembros } from '@/data/miembros';
import { colors, fonts } from '@/ui';

/** Filtro por titular de los artboards (Todas · Daniel · Esposa · Conjuntas). */
export function FiltroTitular({ valor, onCambio }: { valor: Filtro; onCambio: (v: Filtro) => void }) {
  const m = useMiembros();
  const opciones: { valor: Filtro; etiqueta: string }[] = [{ valor: 'TODAS', etiqueta: 'Todas' }, ...m.miembros.map((x) => ({ valor: x.usuario.id, etiqueta: x.usuario.nombre })), { valor: 'CONJUNTAS', etiqueta: 'Conjuntas' }];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Filtrar por titular" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable key={o.valor} accessibilityRole="radio" accessibilityState={{ checked: activa }} hitSlop={6} onPress={() => onCambio(o.valor)}
            style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: activa ? colors.acento : colors.superficie, borderWidth: activa ? 0 : 1, borderColor: colors.borde }}>
            <Text style={{ fontFamily: activa ? fonts.semibold : fonts.regular, fontSize: 13, color: activa ? '#FFFFFF' : colors.texto }}>{o.etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
