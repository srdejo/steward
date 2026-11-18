import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useMesDeHoy } from '@/data/mes-de-hoy';
import { useConsulta } from '@/data/puertos';
import { colors, fonts, HojaIncrustada, Icono, Monto, Texto } from '@/ui';
import { SCROLL_CON_TECLADO } from '@/ui/pantalla';
import Aporte from './aporte';
import Gasto from './gasto';
import Pagar from './pagar/[itemId]';

type Tipo = 'gasto' | 'aporte' | 'pago';
const PESTANAS: { tipo: Tipo; etiqueta: string }[] = [
  { tipo: 'gasto', etiqueta: 'Gasto' },
  { tipo: 'aporte', etiqueta: 'Aporte' },
  { tipo: 'pago', etiqueta: 'Pago' },
];

/**
 * Agregar (artboard "Agregar · gasto, aporte o pago"): el + de la barra abre esta hoja con las pestañas Gasto, Aporte y
 * Pago, que montan las hojas de siempre sin su marco (spec steward-hoy, "Agregar desde un solo botón"; design D3 de
 * rediseno-libreta-clara). `?tipo=` elige la pestaña y `?item=` el gasto o el pago.
 */
export default function Agregar() {
  const params = useLocalSearchParams<{ tipo?: string; item?: string }>();
  const inicial: Tipo = params.tipo === 'aporte' || params.tipo === 'pago' ? params.tipo : 'gasto';
  const [tipo, setTipo] = useState<Tipo>(inicial);
  const [elegido, setElegido] = useState<string | null>(null);
  const item = elegido ?? (tipo === inicial ? params.item ?? null : null);

  const { ref } = useMesDeHoy();
  const resumen = useConsulta(['resumen', ref], (p) => p.movimientos.resumenMes(ref));
  const pendientes = (resumen.data?.porPagar ?? []).filter((i) => i.item.tipo !== 'VARIABLE');

  return (
    <ScrollView style={{ backgroundColor: colors.superficie }} {...SCROLL_CON_TECLADO} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.hueco }}>
          {PESTANAS.map((p) => {
            const activa = p.tipo === tipo;
            return (
              <Pressable
                key={p.tipo}
                testID={`pestana-${p.tipo}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                onPress={() => {
                  setTipo(p.tipo);
                  setElegido(null);
                }}
                style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: activa ? colors.superficie : 'transparent' }}
              >
                <Texto style={{ fontFamily: activa ? fonts.semibold : fonts.medium, fontSize: 14, color: activa ? colors.texto : colors.textoSuave }}>{p.etiqueta}</Texto>
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icono nombre="cerrar" color={colors.secundario} tamano={20} />
        </Pressable>
      </View>

      <HojaIncrustada.Provider value>
        {tipo === 'gasto' && <Gasto />}
        {tipo === 'aporte' && <Aporte />}
        {tipo === 'pago' &&
          (item ? (
            <Pagar elegido={item} />
          ) : (
            <View testID="pendientes-agregar" style={{ gap: 8 }}>
              <Texto style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.textoSuave }}>¿Qué pagaste?</Texto>
              {pendientes.length === 0 && <Texto v="pequeno">Todo pagado este mes.</Texto>}
              {pendientes.map((i) => (
                <Pressable
                  key={i.item.id}
                  testID={`pendiente-${i.item.nombre}`}
                  accessibilityRole="button"
                  onPress={() => setElegido(i.item.id)}
                  style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, backgroundColor: colors.fondo, paddingHorizontal: 14, paddingVertical: 10 }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Texto style={{ fontFamily: fonts.medium }}>{i.item.nombre}</Texto>
                    <Texto v="detalle" style={i.vencido ? { color: colors.negativo, fontFamily: fonts.semibold } : undefined}>{i.detalle}</Texto>
                  </View>
                  <Monto valor={i.pendiente} style={{ fontFamily: fonts.semibold, fontSize: 15 }} />
                </Pressable>
              ))}
            </View>
          ))}
      </HojaIncrustada.Provider>
    </ScrollView>
  );
}
