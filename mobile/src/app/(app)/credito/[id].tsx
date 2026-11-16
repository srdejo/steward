import { claveMes, formatFechaCorta, formatTasa, mesDe, nombreMes, sumarMeses } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { mesCorto } from '@/components/cuentas-creditos';
import { MetodoCredito } from '@/components/metodo-credito';
import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { Aviso, Boton, colors, Encabezado, fonts, Monto, MontoInput, Pantalla, Texto, CuerpoModal } from '@/ui';

/** Lo que dice la hoja de "Eliminar crédito" de los pagos (design D2 de credito-escritorio-y-eliminar). */
function conservan(n: number): string {
  if (n === 0) return 'No tiene pagos registrados.';
  return n === 1 ? 'Se conserva el pago registrado, en el historial de las cuentas.' : `Se conservan los ${n} pagos registrados, en el historial de las cuentas.`;
}

/** Abono que muestra el simulador al abrir (el de la Opción C de los artboards). */
const ABONO_INICIAL = 1_500_000;

const METODO = { TASA: 'Baja solo con la tasa', PLAN: 'Sigue el plan de pagos', MANUAL: 'Lo actualizas a mano' } as const;
const DETALLE = {
  TASA: 'Al marcar la cuota pagada, se descuenta el capital.',
  PLAN: 'Al pagar una cuota, el saldo queda en lo que dice la tabla para esa cuota.',
  MANUAL: 'Escribe el saldo cuando llegue el extracto.',
} as const;

/**
 * Credito.dc.html: saldo, como baja (con "Cambiar"), avance de cuotas, cuota, dia de pago y cuando termina, las proximas
 * cuotas, el simulador con "Probarlo como opción", los ultimos pagos y "Eliminar crédito" (spec steward-cuentas,
 * tarjetas-y-creditos y credito-escritorio-y-eliminar).
 */
export default function Credito() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const puertos = usePuertos();
  const siguiente = sumarMeses(mesDe(puertos.hoy()), 1);
  const vista = useConsulta(['credito', id], (p) => p.cuentas.credito(id));
  const [abono, setAbono] = useState<number | null>(ABONO_INICIAL);
  const simulacion = useConsulta(['simular', id, abono], (p) => p.cuentas.simular(id, abono ?? 0));
  const accion = useAccion();
  const [hoja, setHoja] = useState<'saldo' | 'abono' | null>(null);
  const [monto, setMonto] = useState<number | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const v = vista.data;

  if (!v) return <Pantalla><Texto v="pequeno">{vista.isLoading ? 'Cargando…' : 'Ese crédito no existe.'}</Texto></Pantalla>;
  const c = v.credito;

  return (
    <Pantalla>
      <Encabezado titulo={c.nombre} rotulo={`Crédito · ${c.entidad}`} volver="/cuentas?pestana=creditos" volverTexto="Créditos" />
      <View style={{ gap: 6, marginTop: -12 }}>
        <Monto testID="saldo-credito" valor={c.saldo} style={{ fontSize: 30, fontFamily: fonts.monoSemibold }} />
        <Texto v="pequeno">Saldo actualizado el {formatFechaCorta(c.saldoActualizadoEn)}</Texto>
      </View>
      <View testID="metodo" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 12, backgroundColor: colors.acentoSuave }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto style={{ fontSize: 14, fontFamily: fonts.semibold }}>{METODO[c.metodo]}{c.metodo === 'MANUAL' ? '' : ` · ${formatTasa(c.tasaEM)}`}</Texto>
          <Texto v="detalle">{DETALLE[c.metodo]}</Texto>
        </View>
        <Boton tipo="texto" titulo="Cambiar" onPress={() => setCambiando(true)} />
      </View>
      {v.actualizar && <Texto style={{ fontSize: 13, color: colors.aviso, backgroundColor: colors.avisoSuave, padding: 10, borderRadius: 8, overflow: 'hidden' }}>Ya pasó el día de pago: actualiza el saldo con el extracto.</Texto>}
      <View style={{ gap: 8 }}>
        {v.progreso && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Texto style={{ fontSize: 14, fontFamily: fonts.semibold }}>Cuota {v.progreso.actual} de {v.progreso.total}</Texto>
            <Texto v="detalle">{v.progreso.actual - 1} pagadas · faltan {v.progreso.total - v.progreso.actual + 1}</Texto>
          </View>
        )}
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: v.porcentajePagado }} style={{ height: 8, borderRadius: 4, backgroundColor: colors.borde }}>
          <View style={{ width: `${v.porcentajePagado}%`, height: 8, borderRadius: 4, backgroundColor: colors.acento }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Texto v="detalle">Pagado {v.porcentajePagado}% de <Monto valor={c.totalOriginal} style={{ fontSize: 12, color: colors.secundario }} /></Texto>
          {v.cuotasRestantes !== null && <Texto v="detalle">Faltan {v.cuotasRestantes} cuotas</Texto>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          ['Cuota', <Monto key="c" valor={c.cuota} style={{ fontSize: 13, fontFamily: fonts.monoSemibold }} />],
          ['Paga el', <Texto key="d" style={{ fontFamily: fonts.monoSemibold, fontSize: 13 }}>Día {c.diaPago}</Texto>],
          ['Termina', <Texto key="t" testID="termina" style={{ fontFamily: fonts.monoSemibold, fontSize: 13 }}>{v.termina ? `${c.metodo === 'TASA' ? '≈ ' : ''}${mesCorto(v.termina)}` : '—'}</Texto>],
        ].map(([etiqueta, valor]) => (
          <View key={etiqueta as string} style={{ flex: 1, gap: 4, padding: 12, borderRadius: 12, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
            <Texto style={{ fontSize: 11, color: colors.secundario }}>{etiqueta}</Texto>
            {valor}
          </View>
        ))}
      </View>

      {v.proximas.length > 0 && (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Texto v="subtitulo">Próximas cuotas</Texto>
            {v.cuotasRestantes !== null && <Texto v="detalle">Faltan {v.cuotasRestantes} cuotas</Texto>}
          </View>
          {v.proximas.map((q) => (
            <View key={q.k} testID="cuota-proxima" style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
              <Texto style={{ fontSize: 13, width: 80 }}>{q.k}{v.progreso ? ` / ${v.progreso.total}` : ''} {nombreMes(q.ref.mes).slice(0, 3)}</Texto>
              <Monto valor={q.interes} style={{ fontSize: 12 }} />
              <Monto valor={q.capital} style={{ fontSize: 12 }} />
              <Monto valor={q.saldo} style={{ fontSize: 12, fontFamily: fonts.monoSemibold }} />
            </View>
          ))}
          {v.interesesAnioSiguiente > 0 && (
            <Texto testID="intereses-anio" style={{ fontSize: 13, color: '#8A2A15', backgroundColor: '#FBEDE8', padding: 10, borderRadius: 8, overflow: 'hidden' }}>
              En {mesDe(puertos.hoy()).anio + 1} pagarías <Monto valor={v.interesesAnioSiguiente} siempreVisible style={{ fontSize: 13, color: '#8A2A15' }} /> en intereses.
            </Texto>
          )}
        </View>
      )}

      <View style={{ gap: 10, padding: 16, borderRadius: 14, backgroundColor: colors.acentoSuave }}>
        <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.acentoOscuro }}>¿Y si abonas extra?</Texto>
        <MontoInput etiqueta="Abono" valor={abono} onCambio={setAbono} />
        {simulacion.data ? (
          <Texto testID="simulacion" style={{ fontSize: 13, lineHeight: 19, color: colors.acentoOscuro }}>
            ≈ {simulacion.data.cuotasMenos} cuotas menos y ≈ <Monto valor={simulacion.data.interesesMenos} siempreVisible style={{ fontSize: 13 }} /> menos en intereses.
          </Texto>
        ) : abono ? (
          <Texto style={{ fontSize: 13, color: colors.acentoOscuro }}>Ese abono cubre el saldo o no cambia el plazo.</Texto>
        ) : null}
        <Boton tipo="texto" titulo={`Probarlo como opción de ${nombreMes(siguiente.mes)} ›`} deshabilitado={!abono}
          onPress={() => accion.ejecutar((p) => p.cuentas.probarComoOpcion(id, siguiente, abono!)).then((ok) => ok && router.push(`/mes/${claveMes(siguiente)}`))} />
      </View>

      <View style={{ gap: 4 }}>
        <Texto v="subtitulo">Últimos pagos</Texto>
        {c.pagos.slice(0, 5).map((pago, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
            <Texto style={{ fontSize: 14 }}>{pago.tipo === 'CUOTA' ? 'Cuota' : 'Abono'} · {formatFechaCorta(pago.fecha)}</Texto>
            <Monto valor={pago.monto} />
          </View>
        ))}
      </View>
      <Aviso texto={accion.error} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton tipo="secundario" titulo="Corregir con extracto" onPress={() => setHoja('saldo')} style={{ flex: 1 }} />
        <Boton titulo="Registrar abono" onPress={() => setHoja('abono')} style={{ flex: 1 }} />
      </View>
      <Boton tipo="texto" titulo="Eliminar crédito" onPress={() => setEliminando(true)} />

      <Modal visible={eliminando} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setEliminando(false)}>
        <CuerpoModal>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22, flex: 1 }}>¿Eliminar {c.nombre}?</Texto>
            <Boton tipo="enlace" titulo="Cancelar" onPress={() => setEliminando(false)} />
          </View>
          <Texto style={{ fontSize: 15, lineHeight: 22 }}>Sale de Créditos y su cuota sale del plan de {nombreMes(mesDe(puertos.hoy()).mes)} en adelante.</Texto>
          <View testID="que-se-conserva" style={{ gap: 6, padding: 14, borderRadius: 12, backgroundColor: colors.nota }}>
            <Texto style={{ fontSize: 13 }}>{conservan(v.pagos.length)}</Texto>
            <Texto style={{ fontSize: 13 }}>Si la cuota de este mes ya tiene un pago, se queda en el plan.</Texto>
          </View>
          <Aviso texto={accion.error} />
          <Boton tipo="peligro" titulo="Sí, eliminar crédito"
            onPress={() => accion.ejecutar((p) => p.cuentas.eliminarCredito(id)).then((ok) => { if (ok) { setEliminando(false); router.replace('/cuentas?pestana=creditos'); } })} />
        </CuerpoModal>
      </Modal>

      <Modal visible={hoja !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setHoja(null)}>
        <CuerpoModal>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{hoja === 'saldo' ? 'Corregir con extracto' : 'Registrar abono'}</Texto>
            <Boton tipo="enlace" titulo="Cancelar" onPress={() => setHoja(null)} />
          </View>
          <MontoInput etiqueta={hoja === 'saldo' ? 'Saldo que dice el extracto' : '¿Cuánto abonaste?'} grande valor={monto} onCambio={setMonto} />
          <Boton titulo="Guardar" deshabilitado={monto === null}
            onPress={() => accion.ejecutar((p) => (hoja === 'saldo' ? p.cuentas.actualizarSaldo(id, monto!) : p.cuentas.registrarAbono(id, monto!, { tipo: 'NINGUNO' }))).then((ok) => { if (ok) { setHoja(null); setMonto(null); } })} />
        </CuerpoModal>
      </Modal>
      {cambiando && <MetodoCredito credito={c} onCerrar={() => setCambiando(false)} />}
    </Pantalla>
  );
}
