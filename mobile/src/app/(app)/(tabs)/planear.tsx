import { claveMes, diasEntre, formatCop, mesDe, nombreMes, nombreMesCapital, type MesRef, type ModoNuevoMes, type ResumenMesPlan } from '@steward/domain';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { colors, fonts, Pantalla, Texto } from '@/ui';

const CHIP: Record<ResumenMesPlan['estado'], { texto: string; fondo: string; color: string }> = {
  ACTIVO: { texto: 'Activo', fondo: colors.acentoElegido, color: colors.acento },
  BORRADOR: { texto: 'Borrador', fondo: colors.avisoSuave, color: colors.aviso },
  CERRADO: { texto: 'Cerrado', fondo: colors.hueco, color: colors.textoSuave },
  SIN_PLAN: { texto: 'Sin plan', fondo: colors.hueco, color: colors.textoSuave },
};

const TARJETA = { backgroundColor: colors.superficie, borderRadius: 16, padding: 16 } as const;

function Chip({ estado }: { estado: ResumenMesPlan['estado'] }) {
  const c = CHIP[estado];
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.fondo }}>
      <Texto style={{ fontSize: 11, fontFamily: fonts.semibold, color: c.color }}>{c.texto}</Texto>
    </View>
  );
}

/**
 * Planear (canvas Libreta clara, MPlanear): el mes activo, los que vienen (el borrador con sus opciones y el primero sin
 * plan con lo que ya trae y cómo crearlo), el año en tarjeta verde y los meses cerrados.
 */
export default function Planear() {
  const puertos = usePuertos();
  const hoy = puertos.hoy();
  const actual = mesDe(hoy);
  const inicio = useConsulta(['plan-inicio'], (p) => p.plan.inicio());
  const accion = useAccion();
  const i = inicio.data;

  const todos = i ? [...i.recientes].reverse().concat(i.proximos) : [];
  const abiertos = todos.filter((m) => m.estado !== 'CERRADO');
  const cerrados = todos.filter((m) => m.estado === 'CERRADO').reverse();
  const primeroSinPlan = abiertos.find((m) => m.estado === 'SIN_PLAN' && !m.libre.length) ?? null;
  const trae = useConsulta(['trae', primeroSinPlan ? claveMes(primeroSinPlan.ref) : null], (p) => (primeroSinPlan ? p.plan.loQueTrae(primeroSinPlan.ref) : Promise.resolve([])));
  const anioSiguiente = actual.anio + 1;

  const nombre = (ref: MesRef) => (ref.anio === actual.anio ? nombreMesCapital(ref.mes) : `${nombreMesCapital(ref.mes)} ${ref.anio}`);
  const empieza = (ref: MesRef) => {
    const dias = diasEntre(hoy, `${ref.anio}-${String(ref.mes).padStart(2, '0')}-01`);
    return dias <= 0 ? 'Empieza hoy' : dias === 1 ? 'Empieza mañana' : `Empieza en ${dias} días`;
  };
  const copiaDe = (ref: MesRef) => {
    const anterior = todos.find((m) => m.ref.anio * 12 + m.ref.mes === ref.anio * 12 + ref.mes - 1);
    if (!anterior?.plan) return '';
    const letra = anterior.estado === 'ACTIVO' ? anterior.detalle.replace('Activo · Opción ', '') : 'A';
    return `${nombreMes(anterior.ref.mes)} · opción ${letra}`;
  };
  const traeTexto = (() => {
    const partes = (trae.data ?? []).map((l) => (l.monto === null ? `${l.nombre.toLowerCase()} ${l.detalle}`.trim() : `${l.nombre.toLowerCase()} de ${formatCop(Math.abs(l.monto))}`));
    if (!partes.length) return '';
    return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
  })();
  const crear = async (ref: MesRef, modo: ModoNuevoMes) => {
    if (await accion.ejecutar((p) => p.plan.crearMes(ref, modo))) router.push(`/mes/${claveMes(ref)}`);
  };

  return (
    <Pantalla style={{ paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>
      <Texto v="tituloGrande" accessibilityRole="header" style={{ paddingHorizontal: 4 }}>Planear</Texto>
      {accion.error ? <Texto style={{ color: colors.negativo }}>{accion.error}</Texto> : null}

      {abiertos.map((m) => {
        const clave = claveMes(m.ref);
        if (m.estado === 'ACTIVO') {
          return (
            <Pressable key={clave} testID={`mes-${clave}`} accessibilityRole="button" onPress={() => router.push('/hoy')}
              style={[TARJETA, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }]}>
              <View style={{ flexShrink: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Texto style={{ fontSize: 16, fontFamily: fonts.semibold }}>{nombre(m.ref)}</Texto><Chip estado={m.estado} /></View>
                <Texto v="pequeno">{`${m.detalle.replace('Activo · ', '')} · te queda libre ${m.libre.map((v) => formatCop(v)).join(' – ')}`}</Texto>
              </View>
              <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.acento }}>Ver hoy ›</Texto>
            </Pressable>
          );
        }
        if (m.estado === 'BORRADOR') {
          const varias = m.opciones.length > 1;
          return (
            <Pressable key={clave} testID={`mes-${clave}`} accessibilityRole="button" onPress={() => router.push(varias ? `/comparar/${clave}` : `/mes/${clave}`)} style={[TARJETA, { gap: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Texto style={{ fontSize: 16, fontFamily: fonts.semibold }}>{nombre(m.ref)}</Texto><Chip estado={m.estado} /></View>
                <Texto v="pequeno">{empieza(m.ref)}</Texto>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {m.opciones.map((o) => (
                  <View key={o.letra} style={{ flex: 1, minWidth: 0, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.fondo, gap: 2 }}>
                    <Texto numberOfLines={1} style={{ fontSize: 11, color: colors.secundario }}>{o.nota ? `${o.letra} · ${o.nota}` : o.letra}</Texto>
                    <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: o.libre < 0 ? colors.negativo : colors.texto }}>{formatCop(o.libre)}</Texto>
                  </View>
                ))}
              </View>
              <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.acento }}>{varias ? 'Comparar y elegir ›' : 'Ver plan ›'}</Texto>
            </Pressable>
          );
        }
        if (primeroSinPlan && clave === claveMes(primeroSinPlan.ref)) {
          const copia = copiaDe(m.ref);
          return (
            <View key={clave} testID={`mes-${clave}`} style={[TARJETA, { gap: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Texto style={{ fontSize: 16, fontFamily: fonts.semibold }}>{nombre(m.ref)}</Texto><Chip estado={m.estado} /></View>
              {traeTexto ? <Texto style={{ fontSize: 13, lineHeight: 20, color: colors.textoSuave }}>{`Ya trae ${traeTexto}.`}</Texto> : null}
              <View style={{ gap: 6 }}>
                {copia ? (
                  <Pressable accessibilityRole="button" disabled={accion.ocupado} onPress={() => crear(m.ref, 'COPIAR')}
                    style={{ height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.acento, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: '#FFFFFF' }}>{`Copiar ${copia}`}</Texto>
                    <Texto style={{ fontSize: 14, color: '#FFFFFF' }}>›</Texto>
                  </Pressable>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {([['FIJOS', 'Solo fijos e ingresos'], ['CERO', 'Desde cero']] as const).map(([modo, texto]) => (
                    <Pressable key={modo} accessibilityRole="button" disabled={accion.ocupado} onPress={() => crear(m.ref, modo)}
                      style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.acentoSuave, alignItems: 'center', justifyContent: 'center' }}>
                      <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.acento }}>{texto}</Texto>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          );
        }
        return (
          <Pressable key={clave} testID={`mes-${clave}`} accessibilityRole="button" onPress={() => router.push(`/mes/${clave}`)}
            style={[TARJETA, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Texto style={{ fontSize: 16, fontFamily: fonts.semibold }}>{nombre(m.ref)}</Texto><Chip estado={m.estado} /></View>
            <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.acento }}>Planear ›</Texto>
          </Pressable>
        );
      })}

      {i && (
        <Pressable accessibilityRole="button" testID="tarjeta-anio" onPress={() => router.push(`/anual/${i.anual?.anio ?? anioSiguiente}`)}
          style={{ backgroundColor: colors.acento, borderRadius: 16, padding: 16, gap: 6 }}>
          <Texto style={{ fontSize: 13, color: '#CFE0D6' }}>{i.anual ? `Año ${i.anual.anio} · ${i.anual.estado === 'BORRADOR' ? 'borrador' : 'meses creados'}` : `Año ${anioSiguiente} · sin plan`}</Texto>
          <Texto style={{ fontSize: 20, lineHeight: 24, fontFamily: fonts.display, color: '#FFFFFF' }}>{i.anual ? `El plan de ${i.anual.anio}` : `Planea el año partiendo de ${nombreMes(actual.mes)}`}</Texto>
          <Texto style={{ fontSize: 13, color: '#CFE0D6' }}>{i.anual ? `Libre proyectado ${formatCop(i.anual.kpis.libreAnio)}` : 'Replicas un mes en los 12 y agregas solo lo que cambia.'}</Texto>
          <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: '#FFFFFF', paddingTop: 4 }}>{i.anual ? 'Abrir ›' : 'Empezar ›'}</Texto>
        </Pressable>
      )}

      {cerrados.length > 0 && (
        <View style={{ backgroundColor: colors.superficie, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 }}>
          <Texto accessibilityRole="header" style={{ paddingTop: 12, paddingBottom: 4, fontSize: 14, fontFamily: fonts.semibold, color: colors.textoSuave }}>Meses cerrados</Texto>
          {cerrados.map((m) => {
            const v = m.libre[0] ?? 0;
            return (
              <Pressable key={claveMes(m.ref)} testID={`mes-${claveMes(m.ref)}`} accessibilityRole="button" onPress={() => router.push(`/cierre/${claveMes(m.ref)}`)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divisor }}>
                <Texto style={{ fontSize: 15 }}>{nombre(m.ref)}</Texto>
                <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: v < 0 ? colors.negativo : colors.positivo }}>{`${v < 0 ? 'Faltó' : 'Sobró'} ${formatCop(Math.abs(v))} ›`}</Texto>
              </Pressable>
            );
          })}
        </View>
      )}
    </Pantalla>
  );
}
