import { formatTasa, nombreMes, type Credito, type MesRef } from '@steward/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { MetodoCredito } from '@/components/metodo-credito';
import { useConsulta } from '@/data/puertos';
import { colors, fonts, Monto, Tarjeta as Caja, Texto } from '@/ui';

const MORADO = '#6B5BA8';
export const METODO: Record<Credito['metodo'], string> = { TASA: 'Con la tasa', PLAN: 'Plan de pagos', MANUAL: 'A mano' };

export function mesCorto(ref: MesRef): string {
  return `${nombreMes(ref.mes).slice(0, 3)} ${ref.anio}`;
}

/**
 * CreditosMovil.dc.html: "Deben en créditos", "Pagan al mes" y una tarjeta por crédito con su método, saldo, progreso de
 * cuotas y la próxima cuota (spec steward-cuentas, "Proyección de créditos").
 */
export function CuentasCreditos() {
  const resumen = useConsulta(['creditos', 'resumen'], (p) => p.cuentas.resumenCreditos());
  const [nuevo, setNuevo] = useState(false);
  const r = resumen.data;
  if (!r) return null;
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 12, padding: 18, borderRadius: 20, backgroundColor: colors.superficie }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Texto style={{ fontSize: 12, color: colors.secundario }}>Deben en créditos</Texto>
          <Monto testID="deben-creditos" valor={r.deben} style={{ fontSize: 24, fontFamily: fonts.display }} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Texto style={{ fontSize: 12, color: colors.secundario }}>Pagan al mes</Texto>
          <Monto testID="pagan-mes" valor={r.pagan} style={{ fontSize: 24, fontFamily: fonts.display, color: colors.textoSuave }} />
        </View>
      </View>
      {r.creditos.length === 0 && <Texto v="pequeno">Sin créditos.</Texto>}
      {r.creditos.map((v) => {
        const c = v.credito;
        const g = v.progreso;
        return (
          <Pressable key={c.id} testID={`credito-${c.nombre}`} accessibilityRole="button" onPress={() => router.push(`/credito/${c.id}`)}>
            <Caja style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flexShrink: 1, gap: 2 }}>
                  <Texto style={{ fontSize: 16, fontFamily: fonts.semibold }}>{c.nombre}</Texto>
                  <Texto v="detalle">{c.entidad} · {METODO[c.metodo]}{c.metodo === 'TASA' ? ` · ${formatTasa(c.tasaEM)}` : ''}</Texto>
                </View>
                <Monto valor={c.saldo} style={{ fontSize: 17, fontFamily: fonts.bold }} />
              </View>
              {g && (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Texto style={{ fontSize: 13, fontFamily: fonts.semibold }}>Cuota {g.actual} de {g.total}</Texto>
                    <Texto style={{ fontSize: 13, color: colors.secundario }}>{g.actual - 1} pagadas · faltan {g.total - g.actual + 1}{v.termina ? ` · ${mesCorto(v.termina)}` : ''}</Texto>
                  </View>
                  <View accessibilityLabel={`${g.actual - 1} cuotas pagadas de ${g.total}`} style={{ height: 6, borderRadius: 3, backgroundColor: colors.hueco, overflow: 'hidden' }}>
                    <View style={{ width: `${(100 * (g.actual - 1)) / g.total}%`, height: 6, borderRadius: 3, backgroundColor: MORADO }} />
                  </View>
                </View>
              )}
              {v.proxima ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.divisor, paddingTop: 10 }}>
                  <Texto style={{ fontSize: 13 }}>Próxima cuota · {mesCorto(v.proxima.ref)}</Texto>
                  <Texto v="detalle"><Monto valor={v.proxima.capital} style={{ fontSize: 12, color: colors.secundario }} /> a capital</Texto>
                </View>
              ) : v.actualizar ? (
                <Texto style={{ fontSize: 12, color: colors.aviso }}>Actualiza el saldo con el extracto</Texto>
              ) : null}
            </Caja>
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" onPress={() => setNuevo(true)}
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9C6BD', alignItems: 'center', justifyContent: 'center' }}>
        <Texto style={{ fontSize: 14, fontFamily: fonts.semibold }}>+ Agregar crédito</Texto>
      </Pressable>
      {nuevo && <MetodoCredito credito={null} onCerrar={() => setNuevo(false)} />}
    </>
  );
}
