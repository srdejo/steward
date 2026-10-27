import { formatMiles, nombreMesCapital, type FilaAnualVista, type TipoEvento } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, Campo, colors, Encabezado, fonts, Monto, MontoInput, Pantalla, Segmentado, Texto } from '@/ui';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const COL = 70;

/**
 * Anual.dc.html (web): 12 meses por categoria, eventos del año, aportes proyectados tenues y KPI. En el telefono
 * la cuadricula se desplaza en horizontal. "Crear meses desde este plan" crea cada mes con su columna como Opcion A.
 */
export default function Anual() {
  const { anio } = useLocalSearchParams<{ anio: string }>();
  const r = useConsulta(['anual', anio], (p) => p.plan.anual(Number(anio)));
  const accion = useAccion();
  const [formulario, setFormulario] = useState(false);
  const [nombre, setNombre] = useState('');
  const [mes, setMes] = useState<string | null>('1');
  const [monto, setMonto] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoEvento | null>('GASTO');
  const [mensaje, setMensaje] = useState('');
  const d = r.data;

  if (!d) return <Pantalla><Encabezado titulo={`Plan anual ${anio}`} volver="/planear" volverTexto="Planear" /><Texto v="pequeno">{r.isLoading ? 'Cargando…' : `No hay plan anual para ${anio}.`}</Texto></Pantalla>;

  const fila = (f: FilaAnualVista) => (
    <View key={f.clave} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor, backgroundColor: f.clave === 'eventos' ? colors.destacado : undefined }}>
      <View style={{ width: 160, paddingHorizontal: 12, gap: 2 }}>
        <Texto style={{ fontSize: 13, fontStyle: f.tenue ? 'italic' : 'normal', color: f.tenue ? '#7A7D76' : colors.texto }}>{f.nombre}</Texto>
        {f.detalle ? <Texto style={{ fontSize: 11, color: colors.secundario }}>{f.detalle}</Texto> : null}
      </View>
      {f.valores.map((v, i) => (
        <Texto key={i} style={{ width: COL, textAlign: 'right', paddingRight: 8, fontFamily: fonts.mono, fontSize: 12, color: f.tenue ? '#7A7D76' : f.calculado ? colors.secundario : colors.texto }}>{v ? formatMiles(v) : ''}</Texto>
      ))}
    </View>
  );

  return (
    <Pantalla>
      <Encabezado titulo={`Plan anual ${d.anio}`} rotulo={d.estado === 'BORRADOR' ? 'Borrador' : 'Meses creados'} rotuloColor={d.estado === 'BORRADOR' ? colors.aviso : undefined} volver="/planear" volverTexto="Planear" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Boton tipo="secundario" titulo="+ Evento del año" onPress={() => setFormulario(!formulario)} style={{ minHeight: 40, height: 40 }} />
        {d.estado === 'BORRADOR' && (
          <Boton titulo="Crear meses desde este plan" style={{ minHeight: 40, height: 40 }}
            onPress={() => accion.ejecutar((p) => p.plan.crearMesesDesdeAnual(d.anio)).then((ok) => ok && setMensaje(`Los 12 meses de ${d.anio} quedaron en borrador, cada uno con su Opción A.`))} />
        )}
      </View>

      {formulario && (
        <View style={{ gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
          <Campo etiqueta="Evento" valor={nombre} onCambio={setNombre} placeholder="Ej: SOAT" />
          <Segmentado chips etiqueta="Mes" opciones={MESES.map((m) => ({ valor: String(m), etiqueta: nombreMesCapital(m).slice(0, 3) }))} valor={mes} onCambio={setMes} />
          <MontoInput etiqueta="Monto" valor={monto} onCambio={setMonto} />
          <Segmentado etiqueta="Tipo" opciones={[{ valor: 'GASTO', etiqueta: 'Gasto' }, { valor: 'INGRESO', etiqueta: 'Ingreso' }]} valor={tipo} onCambio={setTipo} />
          <Boton titulo="Agregar evento" deshabilitado={!nombre.trim() || !monto}
            onPress={() => accion.ejecutar((p) => p.plan.agregarEvento(d.anio, { nombre, mes: Number(mes), monto: monto!, tipo: tipo ?? 'GASTO', usuarioId: null })).then((ok) => { if (ok) { setFormulario(false); setNombre(''); setMonto(null); } })} />
        </View>
      )}

      <View style={{ gap: 8 }}>
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde, gap: 4 }}>
          <Texto v="detalle">Libre proyectado en el año</Texto>
          <Monto testID="kpi-libre" valor={d.kpis.libreAnio} style={{ fontSize: 22, fontFamily: fonts.monoSemibold, color: colors.acento }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde, gap: 4 }}>
            <Texto v="detalle">Mes más apretado</Texto>
            <Texto style={{ fontFamily: fonts.semibold }}>{nombreMesCapital(d.kpis.mesApretado.mes)} · <Monto valor={d.kpis.mesApretado.libre} style={{ color: colors.negativo }} /></Texto>
          </View>
          <View style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde, gap: 4 }}>
            <Texto v="detalle">Diezmo del año</Texto>
            <Monto valor={d.kpis.diezmoAnio} style={{ fontFamily: fonts.monoSemibold }} />
          </View>
        </View>
      </View>

      <ScrollView horizontal testID="tabla-anual" style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borde, backgroundColor: colors.superficie }}>
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borde }}>
            <Texto style={{ width: 160, paddingHorizontal: 12, fontSize: 12, fontFamily: fonts.semibold, color: colors.secundario }}>Miles de pesos</Texto>
            {MESES.map((m) => <Texto key={m} style={{ width: COL, textAlign: 'right', paddingRight: 8, fontSize: 12, fontFamily: fonts.semibold, color: colors.secundario }}>{nombreMesCapital(m).slice(0, 3)}</Texto>)}
          </View>
          <Texto style={{ paddingHorizontal: 12, paddingTop: 6, fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 0.9, color: colors.positivo }}>INGRESOS</Texto>
          {d.ingresos.map(fila)}
          <Texto style={{ paddingHorizontal: 12, paddingTop: 12, fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 0.9, color: colors.negativo }}>GASTOS</Texto>
          {[...d.gastos, d.diezmo, ...(d.eventos ? [d.eventos] : [])].map(fila)}
          <View style={{ flexDirection: 'row', paddingVertical: 12 }}>
            <Texto style={{ width: 160, paddingHorizontal: 12, fontFamily: fonts.semibold }}>Queda libre</Texto>
            {d.libre.map((v, i) => (
              <Texto key={i} style={{ width: COL, textAlign: 'right', paddingRight: 8, fontFamily: fonts.monoSemibold, fontSize: 13, color: i + 1 === d.kpis.mesApretado.mes ? colors.negativo : colors.acento }}>{formatMiles(v)}</Texto>
            ))}
          </View>
        </View>
      </ScrollView>
      <Texto v="pequeno">Cada mes nace de su columna como "Opción A". Los cambios en un mes no modifican el plan anual.</Texto>
      {mensaje ? <Texto style={{ color: colors.positivo }}>{mensaje}</Texto> : null}
      <Aviso texto={accion.error} />
    </Pantalla>
  );
}
