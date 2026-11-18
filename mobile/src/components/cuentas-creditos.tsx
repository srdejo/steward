import { formatTasa, nombreMes, type Credito, type MesRef } from '@steward/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { MetodoCredito } from '@/components/metodo-credito';
import { useConsulta } from '@/data/puertos';
import { Boton, colors, fonts, Monto, Tarjeta as Caja, Texto } from '@/ui';

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
      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View style={{ gap: 4 }}>
          <Texto v="rotulo">Deben en créditos</Texto>
          <Monto testID="deben-creditos" valor={r.deben} style={{ fontSize: 26, fontFamily: fonts.semibold }} />
        </View>
        <View style={{ gap: 4 }}>
          <Texto v="rotulo">Pagan al mes</Texto>
          <Monto testID="pagan-mes" valor={r.pagan} style={{ fontSize: 26, fontFamily: fonts.semibold, color: colors.textoSuave }} />
        </View>
      </View>
      {r.creditos.length === 0 && <Texto v="pequeno">Sin créditos.</Texto>}
      {r.creditos.map((v) => {
        const c = v.credito;
        const g = v.progreso;
        return (
          <Pressable key={c.id} testID={`credito-${c.nombre}`} accessibilityRole="button" onPress={() => router.push(`/credito/${c.id}`)}>
            <Caja style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View>
                  <Texto style={{ fontSize: 15, fontFamily: fonts.semibold }}>{c.nombre}</Texto>
                  <Texto v="detalle">{c.entidad}</Texto>
                </View>
                <Texto style={{ fontSize: 11, fontFamily: fonts.semibold, color: colors.acentoOscuro }}>{METODO[c.metodo]}{c.metodo === 'TASA' ? ` · ${formatTasa(c.tasaEM)}` : ''}</Texto>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Monto valor={c.saldo} style={{ fontSize: 22, fontFamily: fonts.semibold }} />
                {g && <Texto v="detalle">Cuota {g.actual} de {g.total}</Texto>}
              </View>
              {g && (
                <>
                  <View accessibilityLabel={`${g.actual - 1} cuotas pagadas de ${g.total}`} style={{ height: 6, borderRadius: 3, backgroundColor: colors.divisor, overflow: 'hidden' }}>
                    <View style={{ width: `${(100 * (g.actual - 1)) / g.total}%`, height: 6, backgroundColor: MORADO }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Texto v="detalle">{g.actual - 1} pagadas</Texto>
                    <Texto v="detalle">faltan {g.total - g.actual + 1}{v.termina ? ` · ${mesCorto(v.termina)}` : ''}</Texto>
                  </View>
                </>
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
      <Boton tipo="texto" titulo="+ Agregar crédito" onPress={() => setNuevo(true)} />
      {nuevo && <MetodoCredito credito={null} onCerrar={() => setNuevo(false)} />}
    </>
  );
}
