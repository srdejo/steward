import { fechaEnMes, formatFechaCorta, mesDe, nombreMes, type Id } from '@steward/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SU_CUENTA, useOpcionesHoja } from '@/data/hoja';
import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, cerrarHoja, colors, fonts, Hoja, Monto, MontoInput, Segmentado, Texto } from '@/ui';

/**
 * Pagar.dc.html: valor prellenado con el plan, quien pago y desde donde. Desde "Su cuenta" el pago cuenta
 * ademas como aporte de quien pago. Si ya estaba pagado avisa "Ya lo pagó X el dd mmm" (spec steward-hoy).
 */
export default function Pagar() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const puertos = usePuertos();
  const { sesion } = useSesion();
  const hoja = useOpcionesHoja();
  const accion = useAccion();
  const ref = mesDe(puertos.hoy());
  const resumen = useConsulta(['resumen', ref], (p) => p.movimientos.resumenMes(ref));
  const categorias = useConsulta(['categorias'], (p) => p.hogar.categorias());
  const e = [...(resumen.data?.porPagar ?? []), ...(resumen.data?.yaPagado ?? [])].find((i) => i.item.id === itemId);

  const [monto, setMonto] = useState<number | null>(null);
  const [quien, setQuien] = useState<Id | null>(sesion?.usuario.id ?? null);
  const [desde, setDesde] = useState<string | null>(null);
  useEffect(() => {
    if (e && monto === null && !e.pagado) setMonto(e.plan);
  }, [e, monto]);

  if (!e) return <Hoja titulo="Marcar pago"><Texto v="pequeno">{resumen.isLoading ? 'Cargando…' : 'Ese gasto no está en el plan del mes.'}</Texto></Hoja>;

  const categoria = categorias.data?.find((c) => c.id === e.item.categoriaId);
  const vence = e.item.diaVence ? ` · vence ${formatFechaCorta(fechaEnMes(ref, e.item.diaVence))}` : '';
  const pago = e.pagado && e.item.tipo !== 'VARIABLE' ? e.pagos[0] : null;

  async function guardar() {
    const ok = await accion.ejecutar((p) => p.movimientos.marcarPago({ itemId, ref, monto: monto!, usuarioId: quien!, origen: hoja.origen(desde) }));
    if (ok) cerrarHoja();
  }

  return (
    <Hoja
      titulo={e.item.nombre}
      antetitulo={e.categoriaNombre}
      antetituloColor={categoria?.color}
      subtitulo={<Texto v="pequeno">Plan <Monto valor={e.plan} style={{ fontSize: 13 }} />{vence}</Texto>}
    >
      {pago ? (
        <>
          <Texto testID="ya-pagado" accessibilityRole="alert" style={{ borderRadius: 12, backgroundColor: colors.avisoSuave, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: colors.aviso }}>
            Ya lo pagó {hoja.miembros.nombreDe(pago.usuarioId)} el {formatFechaCorta(pago.fecha)}
          </Texto>
          <Boton titulo="Entendido" onPress={cerrarHoja} />
        </>
      ) : (
        <>
          <MontoInput etiqueta="Valor pagado" grande valor={monto} onCambio={setMonto} ayuda="Viene lleno con el plan. Si pagas otro valor, la diferencia se ve en el mes." />
          <Segmentado etiqueta="Pagado por" opciones={hoja.personas} valor={quien} onCambio={setQuien} />
          <Segmentado etiqueta="Desde · Opcional" chips opcional opciones={hoja.desde} valor={desde} onCambio={setDesde} />
          {desde === SU_CUENTA && (
            <View testID="aviso-su-cuenta" style={{ borderRadius: 12, backgroundColor: colors.nota, paddingHorizontal: 16, paddingVertical: 14 }}>
              <Texto style={{ fontSize: 13, lineHeight: 19, color: colors.textoSuave }}>
                Su cuenta no está en la app, así que este pago cuenta como <Texto style={{ fontSize: 13, fontFamily: fonts.bold }}>aporte de {hoja.miembros.nombreDe(quien)}</Texto> en {nombreMes(ref.mes)}. No tiene que registrar nada más.
              </Texto>
            </View>
          )}
          <Aviso texto={accion.error} />
          <Boton titulo="Marcar pagado" deshabilitado={!monto || !quien || accion.ocupado} onPress={guardar} />
        </>
      )}
    </Hoja>
  );
}
