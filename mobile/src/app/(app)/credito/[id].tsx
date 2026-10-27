import { claveMes, formatFechaCorta, formatTasa, mesDe, nombreMes, sumarMeses } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { Aviso, Boton, colors, Encabezado, fonts, Monto, MontoInput, Pantalla, Texto } from '@/ui';

/** Abono que muestra el simulador al abrir (el de la Opción C de los artboards). */
const ABONO_INICIAL = 1_500_000;

/** Credito.dc.html: saldo, avance, cuota, tasa y dia de pago, simulador con "Probarlo como opción" y ultimos pagos. */
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
  const v = vista.data;

  if (!v) return <Pantalla><Texto v="pequeno">{vista.isLoading ? 'Cargando…' : 'Ese crédito no existe.'}</Texto></Pantalla>;
  const c = v.credito;

  return (
    <Pantalla>
      <Encabezado titulo={c.nombre} rotulo={`Crédito · ${c.entidad}`} volver="/cuentas" volverTexto="Cuentas" />
      <View style={{ gap: 6, marginTop: -12 }}>
        <Monto testID="saldo-credito" valor={c.saldo} style={{ fontSize: 30, fontFamily: fonts.monoSemibold }} />
        <Texto v="pequeno">Saldo actualizado el {formatFechaCorta(c.saldoActualizadoEn)}</Texto>
      </View>
      <View style={{ gap: 8 }}>
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
          ['Tasa', <Texto key="t" style={{ fontFamily: fonts.monoSemibold, fontSize: 13 }}>{formatTasa(c.tasaEM)}</Texto>],
          ['Paga el', <Texto key="d" style={{ fontFamily: fonts.monoSemibold, fontSize: 13 }}>Día {c.diaPago}</Texto>],
        ].map(([etiqueta, valor]) => (
          <View key={etiqueta as string} style={{ flex: 1, gap: 4, padding: 12, borderRadius: 12, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
            <Texto style={{ fontSize: 11, color: colors.secundario }}>{etiqueta}</Texto>
            {valor}
          </View>
        ))}
      </View>

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
        <Boton tipo="secundario" titulo="Actualizar saldo" onPress={() => setHoja('saldo')} style={{ flex: 1 }} />
        <Boton titulo="Registrar abono" onPress={() => setHoja('abono')} style={{ flex: 1 }} />
      </View>

      <Modal visible={hoja !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setHoja(null)}>
        <View style={{ flex: 1, backgroundColor: colors.superficie, padding: 20, gap: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{hoja === 'saldo' ? 'Actualizar saldo' : 'Registrar abono'}</Texto>
            <Boton tipo="enlace" titulo="Cancelar" onPress={() => setHoja(null)} />
          </View>
          <MontoInput etiqueta={hoja === 'saldo' ? 'Saldo que dice el banco' : '¿Cuánto abonaste?'} grande valor={monto} onCambio={setMonto} />
          <Boton titulo="Guardar" deshabilitado={monto === null}
            onPress={() => accion.ejecutar((p) => (hoja === 'saldo' ? p.cuentas.actualizarSaldo(id, monto!) : p.cuentas.registrarAbono(id, monto!, { tipo: 'NINGUNO' }))).then((ok) => { if (ok) { setHoja(null); setMonto(null); } })} />
        </View>
      </Modal>
    </Pantalla>
  );
}
