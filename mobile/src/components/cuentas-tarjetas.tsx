import { formatFechaCorta, type Id, type Tarjeta, type TonoVence } from '@steward/domain';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, Campo, colors, CuerpoModal, fonts, Monto, MontoInput, Segmentado, Tarjeta as Caja, Texto } from '@/ui';

const MORADO = '#6B5BA8';
const TONO: Record<TonoVence, string> = { alerta: colors.negativo, aviso: colors.aviso, normal: colors.secundario };
const NUEVA = '__nueva__';

function Punto({ pago }: { pago: boolean }) {
  return <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: pago ? MORADO : 'transparent', borderWidth: pago ? 0 : 2, borderColor: MORADO }} />;
}

/**
 * TarjetasMovil.dc.html: "Por pagar este ciclo", las próximas fechas y "Mis tarjetas" (spec steward-tarjetas), con la hoja
 * para agregar, editar o quitar una tarjeta.
 */
export function CuentasTarjetas() {
  const vista = useConsulta(['tarjetas'], (p) => p.tarjetas.vista());
  const [hoja, setHoja] = useState<{ tarjeta: Tarjeta | null } | null>(null);
  const v = vista.data;
  if (!v) return null;
  const proximo = [...v.tarjetas].sort((a, b) => a.proximoPago.dias - b.proximoPago.dias)[0] ?? null;
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 12, padding: 18, borderRadius: 20, backgroundColor: colors.superficie }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Texto style={{ fontSize: 12, color: colors.secundario }}>Por pagar este ciclo</Texto>
          <Monto testID="por-pagar-ciclo" valor={v.porPagarCiclo} style={{ fontSize: 24, fontFamily: fonts.display }} />
        </View>
        {proximo && (
          <View style={{ flex: 1, gap: 4 }}>
            <Texto style={{ fontSize: 12, color: colors.secundario }}>Próximo pago</Texto>
            <Texto style={{ fontSize: 24, fontFamily: fonts.display, color: colors.textoSuave }}>{formatFechaCorta(proximo.proximoPago.fecha)}</Texto>
          </View>
        )}
      </View>
      {v.tarjetas.length === 0 ? (
        <Texto v="pequeno">Sin tarjetas. Agrega una con sus días de corte y de pago, y su línea entra al plan del mes.</Texto>
      ) : (
        <>
          <Caja style={{ paddingTop: 4, paddingBottom: 10 }}>
            <Texto accessibilityRole="header" style={{ paddingTop: 8, paddingBottom: 6, fontSize: 14, fontFamily: fonts.semibold, color: colors.textoSuave }}>Próximas fechas</Texto>
            {v.fechas.map((f) => (
              <View key={`${f.fecha}-${f.tarjetaId}-${f.tipo}`} testID="fecha-tarjeta" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divisor }}>
                <Texto style={{ width: 48, fontSize: 13, fontFamily: fonts.semibold }}>{formatFechaCorta(f.fecha)}</Texto>
                <Punto pago={f.tipo === 'PAGO'} />
                <View style={{ flex: 1 }}>
                  <Texto style={{ fontSize: 14 }}>{f.que}</Texto>
                  <Texto style={{ fontSize: 12, color: TONO[f.tono], fontFamily: f.tono === 'normal' ? fonts.regular : fonts.semibold }}>{f.cuando}</Texto>
                </View>
                {f.valor !== null && <Monto valor={f.valor} style={{ fontSize: 13 }} />}
              </View>
            ))}
          </Caja>
          {v.tarjetas.map((t) => (
            <Pressable key={t.tarjeta.id} testID={`tarjeta-${t.tarjeta.nombre}`} accessibilityRole="button" onPress={() => setHoja({ tarjeta: t.tarjeta })}>
              <Caja style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Texto style={{ fontSize: 16, fontFamily: fonts.semibold }}>{t.tarjeta.nombre}</Texto>
                    {!!t.tarjeta.uso && <Texto style={{ fontSize: 11, fontFamily: fonts.semibold, color: colors.textoSuave, backgroundColor: colors.hueco, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' }}>{t.tarjeta.uso}</Texto>}
                  </View>
                  <Monto valor={t.monto} style={{ fontSize: 15, fontFamily: fonts.semibold }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, gap: 2 }}><Texto style={{ fontSize: 12, color: colors.secundario }}>Corte</Texto><Texto style={{ fontSize: 14, fontFamily: fonts.semibold }}>Día {t.tarjeta.diaCorte}</Texto></View>
                  <View style={{ flex: 1, gap: 2 }}><Texto style={{ fontSize: 12, color: colors.secundario }}>Pago</Texto><Texto style={{ fontSize: 14, fontFamily: fonts.semibold }}>Día {t.tarjeta.diaPago}</Texto></View>
                  <View style={{ flex: 1, gap: 2 }}><Texto style={{ fontSize: 12, color: colors.secundario }}>Se paga</Texto><Texto style={{ fontSize: 14, fontFamily: fonts.semibold }}>{t.tarjeta.pago.tipo === 'FIJO' ? <Monto valor={t.tarjeta.pago.monto} style={{ fontSize: 14, fontFamily: fonts.semibold }} /> : 'Completa'}</Texto></View>
                </View>
                <Texto testID={`proximo-pago-${t.tarjeta.nombre}`} style={{ fontSize: 12, color: TONO[t.proximoPago.tono] }}>Próximo pago {formatFechaCorta(t.proximoPago.fecha)} · {t.proximoPago.dias === 0 ? 'hoy' : `en ${t.proximoPago.dias} ${t.proximoPago.dias === 1 ? 'día' : 'días'}`}</Texto>
                <Texto testID={`ayuda-${t.tarjeta.nombre}`} style={{ fontSize: 12, lineHeight: 18, color: t.aviso ? '#8F1D16' : colors.textoSuave, backgroundColor: t.aviso ? colors.negativoSuave : 'transparent', paddingVertical: t.aviso ? 8 : 0, paddingHorizontal: t.aviso ? 10 : 0, borderRadius: 10, overflow: 'hidden' }}>{t.ayuda}</Texto>
              </Caja>
            </Pressable>
          ))}
        </>
      )}
      <Boton tipo="texto" titulo="+ Agregar tarjeta" onPress={() => setHoja({ tarjeta: null })} />
      {hoja && <HojaTarjeta tarjeta={hoja.tarjeta} onCerrar={() => setHoja(null)} />}
    </>
  );
}

/** "+ Tarjeta" o editar una tarjeta, como tarjeta-hoja.ts de la PWA. */
function HojaTarjeta({ tarjeta, onCerrar }: { tarjeta: Tarjeta | null; onCerrar: () => void }) {
  const accion = useAccion();
  const enlazables = useConsulta(['tarjetas', 'enlazables'], (p) => p.tarjetas.enlazables());
  const [nombre, setNombre] = useState(tarjeta?.nombre ?? '');
  const [uso, setUso] = useState(tarjeta?.uso ?? '');
  const [corte, setCorte] = useState(tarjeta ? String(tarjeta.diaCorte) : '');
  const [pago, setPago] = useState(tarjeta ? String(tarjeta.diaPago) : '');
  const [tipo, setTipo] = useState<'COMPLETA' | 'FIJO' | null>(tarjeta?.pago.tipo ?? 'COMPLETA');
  const [monto, setMonto] = useState<number | null>(tarjeta ? (tarjeta.pago.tipo === 'FIJO' ? tarjeta.pago.monto : tarjeta.pago.estimado) : null);
  const [enlace, setEnlace] = useState<Id | null>(NUEVA);
  const [confirmando, setConfirmando] = useState(false);
  const dia = (t: string) => Number(t.trim());
  const valido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
  const listo = !!nombre.trim() && valido(dia(corte)) && valido(dia(pago)) && (tipo !== 'FIJO' || (monto ?? 0) > 0);
  const opciones = [{ valor: NUEVA, etiqueta: 'Una línea nueva' }, ...(enlazables.data ?? []).map((i) => ({ valor: i.id, etiqueta: i.nombre }))];

  const guardar = () => {
    const datos = {
      nombre, uso, diaCorte: dia(corte), diaPago: dia(pago),
      pago: tipo === 'FIJO' ? { tipo: 'FIJO' as const, monto: monto ?? 0 } : { tipo: 'COMPLETA' as const, estimado: monto ?? 0 },
    };
    void accion.ejecutar((p) => (tarjeta ? p.tarjetas.editar(tarjeta.id, datos) : p.tarjetas.agregar({ ...datos, itemId: enlace === NUEVA ? null : enlace }))).then((ok) => ok && onCerrar());
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onCerrar}>
      <CuerpoModal>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{tarjeta ? tarjeta.nombre : 'Nueva tarjeta'}</Texto>
          <Boton tipo="enlace" titulo="Cancelar" onPress={onCerrar} />
        </View>
        {confirmando ? (
          <>
            <Texto v="pequeno">Se quita la tarjeta. Sus líneas del plan quedan como gastos de Créditos y los pagos registrados no cambian.</Texto>
            <Aviso texto={accion.error} />
            <Boton titulo="Sí, quitar tarjeta" deshabilitado={accion.ocupado} onPress={() => void accion.ejecutar((p) => p.tarjetas.quitar(tarjeta!.id)).then((ok) => ok && onCerrar())} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} placeholder="Ej: Nu" /></View>
              <View style={{ flex: 1 }}><Campo etiqueta="Uso · Opcional" valor={uso} onCambio={setUso} placeholder="Ej: Mercado" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Campo etiqueta="Día de corte" teclado="number-pad" valor={corte} onCambio={setCorte} placeholder="13" /></View>
              <View style={{ flex: 1 }}><Campo etiqueta="Día de pago" teclado="number-pad" valor={pago} onCambio={setPago} placeholder="28" /></View>
            </View>
            <Segmentado etiqueta="Se paga" opciones={[{ valor: 'COMPLETA', etiqueta: 'Completa' }, { valor: 'FIJO', etiqueta: 'Pago fijo' }]} valor={tipo} onCambio={setTipo} />
            <MontoInput etiqueta={tipo === 'FIJO' ? 'Pago fijo' : 'Valor del extracto (estimado)'} valor={monto} onCambio={setMonto}
              ayuda={tipo === 'FIJO' ? 'No se paga completa: el saldo que queda genera intereses.' : 'Cada mes se ajusta al último valor pagado.'} />
            {!tarjeta && opciones.length > 1 && <Segmentado chips etiqueta="Su línea del plan" opciones={opciones} valor={enlace} onCambio={setEnlace} />}
            <Aviso texto={accion.error} />
            <Boton titulo={tarjeta ? 'Guardar' : 'Agregar tarjeta'} deshabilitado={!listo || accion.ocupado} onPress={guardar} />
            {tarjeta && <Boton tipo="enlace" titulo="Quitar tarjeta" onPress={() => setConfirmando(true)} />}
          </>
        )}
      </CuerpoModal>
    </Modal>
  );
}
