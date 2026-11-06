import { formatFechaCorta, type Origen } from '@steward/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SU_CUENTA, useOpcionesHoja } from '@/data/hoja';
import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, Campo, cerrarHoja, colors, Hoja, MontoInput, Segmentado, Texto } from '@/ui';

function mismoOrigen(a: Origen, b: Origen): boolean {
  return a.tipo === b.tipo && (a.tipo !== 'CUENTA' || (b.tipo === 'CUENTA' && a.cuentaId === b.cuentaId));
}

/** Un pago, gasto, ingreso recibido o aporte, para corregirlo o borrarlo (spec steward-hoy). */
export default function Registro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hoja = useOpcionesHoja();
  const accion = useAccion();
  const vista = useConsulta(['registro', id], (p) => p.movimientos.registro(id));
  const v = vista.data;
  const m = v?.movimiento;

  const [monto, setMonto] = useState<number | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [prellenado, setPrellenado] = useState(false);

  useEffect(() => {
    if (!m || prellenado) return;
    setPrellenado(true);
    setMonto(m.monto);
    setNota(m.nota);
    setDesde(m.origen.tipo === 'CUENTA' ? m.origen.cuentaId : m.origen.tipo === 'EXTERNA' ? SU_CUENTA : null);
  }, [m, prellenado]);

  if (!v || !m) return <Hoja titulo="Registro"><Texto v="pequeno">{vista.isLoading ? 'Cargando…' : 'Ese registro ya no está.'}</Texto></Hoja>;

  async function guardar() {
    const origen = hoja.origen(desde);
    // Solo lo que cambio.
    const ok = await accion.ejecutar((p) =>
      p.movimientos.corregirRegistro({
        movimientoId: m!.id,
        monto: !v!.esCuota && monto !== m!.monto ? monto! : undefined,
        origen: mismoOrigen(origen, m!.origen) ? undefined : origen,
        nota: m!.tipo === 'GASTO' && nota !== m!.nota ? nota : undefined,
      }),
    );
    if (ok) cerrarHoja();
  }

  async function borrar() {
    const ok = await accion.ejecutar((p) => p.movimientos.borrarRegistro(m!.id));
    if (ok) cerrarHoja();
  }

  return (
    <Hoja titulo={v.titulo} subtitulo={<Texto v="pequeno">{formatFechaCorta(m.fecha)} · {hoja.miembros.nombreDe(m.usuarioId)}</Texto>}>
      {borrando ? (
        <>
          <Texto style={{ fontSize: 15 }}>¿Borrar este registro?</Texto>
          <View testID="efecto-borrar" style={{ gap: 6, borderRadius: 12, backgroundColor: colors.nota, paddingHorizontal: 16, paddingVertical: 14 }}>
            {v.avisos.map((a) => <Texto key={a} style={{ fontSize: 13, color: colors.textoSuave }}>{a}</Texto>)}
          </View>
          <Aviso texto={accion.error} />
          <Boton tipo="peligro" titulo="Sí, borrar" deshabilitado={accion.ocupado} onPress={borrar} />
        </>
      ) : (
        <>
          {v.esCuota ? (
            <Texto testID="aviso-cuota" style={{ borderRadius: 12, backgroundColor: colors.nota, paddingHorizontal: 16, paddingVertical: 14, fontSize: 13, color: colors.textoSuave }}>
              Para cambiar el monto de una cuota, borra el pago y márcalo otra vez.
            </Texto>
          ) : (
            <MontoInput etiqueta="Monto" grande valor={monto} onCambio={setMonto} />
          )}
          <Segmentado etiqueta="Cuenta · Opcional" chips opcional opciones={hoja.desde} valor={desde} onCambio={setDesde} />
          {m.tipo === 'GASTO' && <Campo etiqueta="Nota · Opcional" valor={nota} onCambio={setNota} />}
          <Aviso texto={accion.error} />
          <Boton titulo="Guardar" deshabilitado={!monto || accion.ocupado} onPress={guardar} />
          <Boton tipo="enlace" titulo="Borrar este registro" onPress={() => setBorrando(true)} />
        </>
      )}
    </Hoja>
  );
}
