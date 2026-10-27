import { formatMesAnio, formatNumero, nombreMes, parseClaveMes, type FilaComparacion, type Pesos } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, colors, Encabezado, fonts, Pantalla, Texto } from '@/ui';

const COL_NOMBRE = 180;
const COL_VALOR = 130;

/**
 * Comparar.dc.html: las opciones lado a lado, resaltando solo las filas que cambian. En el telefono la tabla
 * se desplaza en horizontal con las columnas a su ancho (spec steward-planear).
 */
export default function Comparar() {
  const { mes } = useLocalSearchParams<{ mes: string }>();
  const ref = parseClaveMes(mes)!;
  const c = useConsulta(['comparar', mes], (p) => p.plan.comparar(ref));
  const vista = useConsulta(['mes', mes], (p) => p.plan.mes(ref));
  const accion = useAccion();
  const d = c.data;

  const filas: FilaComparacion[] = d ? [d.ingresos, ...d.filas, ...(d.sinCambios ? [d.sinCambios] : [])] : [];
  const celda = (v: Pesos | null) => (v === null ? '—' : formatNumero(v));

  return (
    <Pantalla>
      <Encabezado titulo="Comparar opciones" rotulo={`${formatMesAnio(ref)} · Borrador`} volver={`/mes/${mes}`} volverTexto={formatMesAnio(ref)} />
      {d && (
        <ScrollView horizontal testID="tabla-comparar" accessibilityLabel="Opciones lado a lado" contentContainerStyle={{ minWidth: COL_NOMBRE + COL_VALOR * d.vistas.length }}
          style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borde, backgroundColor: colors.superficie }}>
          <View>
            <View style={{ flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borde }}>
              <View style={{ width: COL_NOMBRE }} />
              {d.vistas.map((v) => (
                <View key={v.escenario.id} style={{ width: COL_VALOR, paddingHorizontal: 12, alignItems: 'flex-end' }}>
                  <Texto style={{ fontFamily: fonts.semibold }}>Opción {v.escenario.letra}</Texto>
                  <Texto v="detalle" style={{ textAlign: 'right' }}>{v.escenario.letra === 'A' && v.escenario.nota ? v.escenario.nota : [v.autor, v.escenario.nota].filter(Boolean).join(' · ')}</Texto>
                </View>
              ))}
            </View>
            {filas.map((f) => (
              <View key={f.clave} testID={f.cambia ? 'fila-cambia' : undefined} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divisor, backgroundColor: f.cambia ? colors.destacado : undefined }}>
                <View style={{ width: COL_NOMBRE, paddingHorizontal: 16, gap: 2 }}>
                  <Texto style={{ fontSize: 14 }}>{f.nombre}</Texto>
                  {f.nota ? <Texto v="detalle">{f.nota}</Texto> : null}
                </View>
                {f.valores.map((v, i) => (
                  <Texto key={i} style={{ width: COL_VALOR, paddingHorizontal: 12, textAlign: 'right', fontFamily: f.cambia && v !== null && v !== f.valores[0] ? fonts.monoSemibold : fonts.mono, fontSize: 14, color: f.cambia && v !== null ? colors.texto : colors.secundario }}>{celda(v)}</Texto>
                ))}
              </View>
            ))}
            <View style={{ flexDirection: 'row', paddingVertical: 16 }}>
              <Texto style={{ width: COL_NOMBRE, paddingHorizontal: 16, fontFamily: fonts.semibold, fontSize: 16 }}>Queda libre</Texto>
              {d.libre.map((v, i) => (
                <Texto key={i} style={{ width: COL_VALOR, paddingHorizontal: 12, textAlign: 'right', fontFamily: fonts.monoSemibold, fontSize: 18, color: v < 0 ? colors.negativo : colors.acento }}>{celda(v)}</Texto>
              ))}
            </View>
            <View style={{ flexDirection: 'row', paddingBottom: 16 }}>
              <View style={{ width: COL_NOMBRE }} />
              {d.vistas.map((v) => (
                <View key={v.escenario.id} style={{ width: COL_VALOR, paddingHorizontal: 12, alignItems: 'flex-end' }}>
                  <Boton tipo="secundario" titulo={`Usar ${v.escenario.letra}`} style={{ minHeight: 40, height: 40, borderRadius: 10 }}
                    onPress={() => vista.data?.plan && accion.ejecutar((p) => p.plan.usar(vista.data!.plan!.id, v.escenario.id)).then((ok) => ok && router.navigate('/planear'))} />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
      <Texto v="pequeno">Al elegir una opción, {nombreMes(ref.mes)} pasa a Activo el 1 de {nombreMes(ref.mes)}. Las demás quedan archivadas, no se borran.</Texto>
      <Aviso texto={accion.error} />
    </Pantalla>
  );
}
