import { mesDe, type Id } from '@steward/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SU_CUENTA, useOpcionesHoja } from '@/data/hoja';
import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, cerrarHoja, Campo, colors, Hoja, Monto, MontoInput, Segmentado, Texto } from '@/ui';

const NO_PLANEADO = '__no_planeado__';

/** Gasto.dc.html: monto, a que gasto del plan (los variables acumulan) o "No estaba planeado", nota, quien y desde. */
export default function Gasto() {
  const { item } = useLocalSearchParams<{ item?: string }>();
  const puertos = usePuertos();
  const { sesion } = useSesion();
  const hoja = useOpcionesHoja();
  const accion = useAccion();
  const ref = mesDe(puertos.hoy());
  const resumen = useConsulta(['resumen', ref], (p) => p.movimientos.resumenMes(ref));
  const variables = [...(resumen.data?.porPagar ?? []), ...(resumen.data?.yaPagado ?? [])].filter((i) => i.item.tipo === 'VARIABLE');

  const [elegido, setElegido] = useState<string | null>(null);
  const [monto, setMonto] = useState<number | null>(null);
  const [nota, setNota] = useState('');
  const [quien, setQuien] = useState<Id | null>(sesion?.usuario.id ?? null);
  const [desde, setDesde] = useState<string | null>(null);

  const itemElegido = elegido ?? item ?? variables[0]?.item.id ?? NO_PLANEADO;
  const previa = variables.find((v) => v.item.id === itemElegido);

  async function guardar() {
    const ok = await accion.ejecutar((p) =>
      p.movimientos.registrarGasto({ monto: monto!, itemId: itemElegido === NO_PLANEADO ? null : itemElegido, nota, usuarioId: quien!, origen: hoja.origen(desde), ref }),
    );
    if (ok) cerrarHoja();
  }

  return (
    <Hoja titulo="Registrar gasto">
      <MontoInput etiqueta="¿Cuánto?" grande valor={monto} onCambio={setMonto} />
      <View style={{ gap: 8 }}>
        <Segmentado
          etiqueta="¿De cuál gasto del plan?"
          chips
          opciones={[...variables.map((v) => ({ valor: v.item.id, etiqueta: v.item.nombre })), { valor: NO_PLANEADO, etiqueta: 'No estaba planeado' }]}
          valor={itemElegido}
          onCambio={(v) => v && setElegido(v)}
        />
        {previa && (
          <Texto testID="vista-previa-gasto" v="detalle">
            {previa.item.nombre}: llevas <Monto valor={previa.real + (monto ?? 0)} siempreVisible style={{ fontSize: 12 }} /> de <Monto valor={previa.plan} siempreVisible style={{ fontSize: 12 }} /> con este gasto.
          </Texto>
        )}
      </View>
      <Campo etiqueta="Nota · Opcional" valor={nota} onCambio={setNota} placeholder="Ej: Plaza del sábado" />
      <Segmentado etiqueta="Pagó" opciones={hoja.iniciales} valor={quien} onCambio={setQuien} />
      <Segmentado etiqueta="Desde · Opcional" chips opcional opciones={hoja.desde} valor={desde} onCambio={setDesde} />
      {desde === SU_CUENTA && (
        <Texto style={{ borderRadius: 12, backgroundColor: colors.nota, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, color: colors.textoSuave }}>
          Desde su cuenta, el gasto cuenta como aporte de {hoja.miembros.nombreDe(quien)}.
        </Texto>
      )}
      <Aviso texto={accion.error} />
      <Boton titulo="Guardar gasto" deshabilitado={!monto || !quien || accion.ocupado} onPress={guardar} />
    </Hoja>
  );
}
