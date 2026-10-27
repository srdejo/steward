import { claveMes, formatCop, formatNumero, nombreMes, nombreMesCapital, parseClaveMes, repartoValido, sumarMeses } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, colors, Encabezado, fonts, Monto, MontoInput, Pantalla, Texto } from '@/ui';

/**
 * Cierre.dc.html: plan vs real por categoria, "Sin registrar" y el reparto del sobrante entre ahorro y el mes
 * siguiente. Cerrar deja el mes en solo lectura (spec steward-planear).
 */
export default function Cierre() {
  const { mes } = useLocalSearchParams<{ mes: string }>();
  const ref = parseClaveMes(mes)!;
  const siguiente = sumarMeses(ref, 1);
  const vista = useConsulta(['cierre', mes], (p) => p.cierre.vista(ref));
  const accion = useAccion();
  const [aAhorro, setAAhorro] = useState<number | null>(null);
  const [aSiguiente, setASiguiente] = useState<number | null>(0);
  const v = vista.data;

  // Por defecto todo lo que sobro va a ahorro; se ajusta moviendo una parte al mes siguiente.
  useEffect(() => {
    if (v && !v.cerrado && aAhorro === null) setAAhorro(Math.max(0, v.sobrante));
  }, [v, aAhorro]);

  if (!v) return <Pantalla><Texto v="pequeno">Cargando…</Texto></Pantalla>;
  const valido = repartoValido(v.sobrante, aAhorro ?? 0, aSiguiente ?? 0);
  const fila = (nombre: string, plan: number | null, real: number, opciones: { negrita?: boolean; detalle?: string; tono?: string }) => (
    <View key={nombre} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto style={{ fontSize: 14, fontFamily: opciones.negrita ? fonts.semibold : fonts.regular }}>{nombre}</Texto>
        {opciones.detalle ? <Texto style={{ fontSize: 11, color: colors.secundario }}>{opciones.detalle}</Texto> : null}
      </View>
      <Texto style={{ width: 84, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: colors.secundario }}>{plan === null ? '—' : formatNumero(plan)}</Texto>
      <Texto style={{ width: 84, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: opciones.tono ?? colors.texto }}>{formatNumero(real)}</Texto>
    </View>
  );

  return (
    <Pantalla>
      <Encabezado titulo={`${nombreMesCapital(ref.mes)} terminó con`} rotulo={`Cierre de mes${v.cerrado ? ' · cerrado' : ''}`} volver="/planear" volverTexto={nombreMesCapital(ref.mes)} />
      <View style={{ gap: 6, marginTop: -12 }}>
        <Monto testID="sobrante" valor={v.sobrante} style={{ fontSize: 34, fontFamily: fonts.monoSemibold, color: v.sobrante >= 0 ? colors.acento : colors.negativo }} />
        <Texto style={{ fontSize: 14, color: colors.secundario }}>El plan esperaba {formatCop(v.librePlaneado)} libres.</Texto>
      </View>

      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borde, backgroundColor: colors.superficie, paddingHorizontal: 16, paddingVertical: 6 }}>
        <View style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
          <View style={{ flex: 1 }} />
          <Texto style={{ width: 84, textAlign: 'right', fontSize: 11, fontFamily: fonts.semibold, color: colors.secundario }}>PLAN</Texto>
          <Texto style={{ width: 84, textAlign: 'right', fontSize: 11, fontFamily: fonts.semibold, color: colors.secundario }}>REAL</Texto>
        </View>
        {v.filas.map((f, i) =>
          fila(f.nombre, f.plan, f.real, {
            negrita: i === 0,
            tono: f.plan === null ? undefined : i === 0 ? (f.real >= f.plan ? colors.positivo : colors.negativo) : f.real > f.plan ? colors.negativo : undefined,
          }),
        )}
        {fila('Sin registrar', null, v.sinRegistrar, { detalle: 'de cuadrar cuentas' })}
      </View>

      {v.cerrado ? (
        <View style={{ gap: 10, padding: 16, borderRadius: 14, backgroundColor: colors.nota }}>
          <Texto style={{ fontSize: 13, fontFamily: fonts.semibold }}>Así se repartió</Texto>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Texto style={{ fontSize: 14 }}>A ahorro</Texto><Monto valor={v.aAhorro} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Texto style={{ fontSize: 14 }}>Pasó a {nombreMes(siguiente.mes)}</Texto><Monto valor={v.aSiguiente} /></View>
          <Texto v="detalle">El mes está cerrado: queda en solo lectura.</Texto>
        </View>
      ) : (
        <>
          <View style={{ gap: 10 }}>
            <Texto v="subtitulo">¿Qué hacemos con lo que sobró?</Texto>
            <View style={{ padding: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.acento, backgroundColor: colors.acentoSuave }}>
              <MontoInput etiqueta="A ahorro" valor={aAhorro} onCambio={setAAhorro} />
            </View>
            <View style={{ padding: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.acento, backgroundColor: colors.acentoSuave }}>
              <MontoInput etiqueta={`Pasar a ${nombreMes(siguiente.mes)}`} valor={aSiguiente} onCambio={setASiguiente} />
            </View>
            {!valido && (
              <Texto testID="aviso-reparto" style={{ fontSize: 12, color: colors.aviso }}>
                El reparto debe sumar {formatCop(v.sobrante)} (va en {formatCop((aAhorro ?? 0) + (aSiguiente ?? 0))}).
              </Texto>
            )}
          </View>
          <Aviso texto={accion.error} />
          <Boton titulo={`Cerrar ${nombreMes(ref.mes)}`} deshabilitado={!valido || accion.ocupado}
            onPress={() => accion.ejecutar((p) => p.cierre.cerrar(ref, { aAhorro: aAhorro ?? 0, aSiguiente: aSiguiente ?? 0 })).then((ok) => ok && router.replace(`/mes/${claveMes(siguiente)}`))} />
        </>
      )}
    </Pantalla>
  );
}
