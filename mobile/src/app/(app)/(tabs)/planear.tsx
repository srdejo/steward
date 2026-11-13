import { claveMes, formatCop, formatMesAnio, mesDe, type ResumenMesPlan } from '@steward/domain';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useConsulta, usePuertos } from '@/data/puertos';
import { colors, Fila, fonts, Monto, Pantalla, Texto } from '@/ui';

/** Un mes que dejaria menos de este libre se marca en rojo, como "Enero $598.000" en el artboard. */
const APRETADO = 1_000_000;

/** PlanInicio.dc.html: el año, los próximos meses y este mes y los anteriores (spec steward-planear). */
export default function Planear() {
  const inicio = useConsulta(['plan-inicio'], (p) => p.plan.inicio());
  const i = inicio.data;
  const anioSiguiente = mesDe(usePuertos().hoy()).anio + 1;

  const destino = (m: ResumenMesPlan, reciente: boolean) => {
    const clave = claveMes(m.ref);
    if (reciente && m.estado === 'CERRADO') return `/cierre/${clave}`;
    return `/mes/${clave}`;
  };

  return (
    <Pantalla>
      <Texto v="titulo" accessibilityRole="header">Plan</Texto>
      {i?.anual && (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/anual/${i.anual!.anio}`)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
          <View style={{ gap: 4 }}>
            <Texto v="rotulo" style={i.anual.estado === 'BORRADOR' ? { color: colors.aviso } : undefined}>{i.anual.estado === 'BORRADOR' ? 'Borrador' : 'Meses creados'}</Texto>
            <Texto style={{ fontSize: 18, fontFamily: fonts.semibold }}>Año {i.anual.anio}</Texto>
            <Texto v="pequeno">Libre proyectado <Monto valor={i.anual.kpis.libreAnio} style={{ fontSize: 13 }} /></Texto>
          </View>
          <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.acento }}>Abrir ›</Texto>
        </Pressable>
      )}
      {i && !i.anual && (
        // Sin plan del año siguiente: se planea desde un mes (spec steward-planear, "Planear inicio").
        <Pressable accessibilityRole="button" testID="planear-anio" onPress={() => router.push(`/anual/${anioSiguiente}`)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
          <View style={{ flexShrink: 1, gap: 4 }}>
            <Texto v="rotulo">{`Año ${anioSiguiente} · Sin plan`}</Texto>
            <Texto style={{ fontSize: 16, fontFamily: fonts.semibold }}>Parte de un mes y agrega lo que cambia</Texto>
          </View>
          <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.acento }}>{`Planear ${anioSiguiente} ›`}</Texto>
        </Pressable>
      )}
      {i && (
        <>
          <View style={{ gap: 4 }}>
            <Texto v="rotulo">Próximos meses</Texto>
            {i.proximos.map((m, k) => (
              <Fila key={claveMes(m.ref)} titulo={formatMesAnio(m.ref)} detalle={m.detalle} tonoDetalle={m.estado === 'BORRADOR' ? colors.aviso : undefined} ultima={k === i.proximos.length - 1} onPress={() => router.push(destino(m, false))}>
                {m.estado === 'SIN_PLAN' && !m.libre.length ? (
                  <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.acento }}>Planear ›</Texto>
                ) : (
                  <Texto style={{ fontFamily: fonts.mono, fontSize: 13, color: m.libre.some((v) => v < APRETADO) ? colors.negativo : colors.secundario }}>{m.libre.map((v) => formatCop(v)).join(' – ')}</Texto>
                )}
              </Fila>
            ))}
          </View>
          <View style={{ gap: 4 }}>
            <Texto v="rotulo">Este mes y anteriores</Texto>
            {i.recientes.map((m, k) => (
              <Fila key={claveMes(m.ref)} titulo={formatMesAnio(m.ref)} detalle={m.detalle} tonoDetalle={m.estado === 'ACTIVO' ? colors.positivo : undefined} ultima={k === i.recientes.length - 1} onPress={() => router.push(destino(m, true))}>
                <Texto style={{ fontSize: 13, fontFamily: m.estado === 'CERRADO' ? fonts.regular : fonts.semibold, color: m.estado === 'CERRADO' ? colors.secundario : colors.acento }}>
                  {m.estado === 'CERRADO' ? 'Ver cierre' : m.estado === 'ACTIVO' ? 'Editar plan ›' : 'Planear ›'}
                </Texto>
              </Fila>
            ))}
          </View>
        </>
      )}
    </Pantalla>
  );
}
