import { type FiltroTitular as Filtro, type Id } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { CuentasCreditos } from '@/components/cuentas-creditos';
import { CuentasTarjetas } from '@/components/cuentas-tarjetas';
import { FiltroTitular } from '@/components/filtro-titular';
import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, Campo, colors, Fila, fonts, Monto, MontoInput, Pantalla, Segmentado, Texto, CuerpoModal } from '@/ui';

const CONJUNTA = '__conjunta__';
type Pestana = 'cuentas' | 'tarjetas' | 'creditos';
const PESTANAS: { valor: Pestana; etiqueta: string }[] = [
  { valor: 'cuentas', etiqueta: 'Cuentas' },
  { valor: 'tarjetas', etiqueta: 'Tarjetas' },
  { valor: 'creditos', etiqueta: 'Créditos' },
];

/**
 * Cuentas.dc.html, TarjetasMovil.dc.html y CreditosMovil.dc.html: pestañas Cuentas, Tarjetas y Créditos (spec steward-cuentas,
 * tarjetas-y-creditos). Cuentas tiene el saldo del hogar estimado y las cuentas con titular y cuadre. `?pestana=` abre otra.
 */
export default function Cuentas() {
  const params = useLocalSearchParams<{ pestana?: string }>();
  const inicial: Pestana = params.pestana === 'tarjetas' || params.pestana === 'creditos' ? params.pestana : 'cuentas';
  const [pestana, setPestana] = useState<Pestana>(inicial);
  useEffect(() => setPestana(inicial), [inicial]);
  const tarjetas = useConsulta(['tarjetas'], (p) => p.tarjetas.vista());
  const pronto = tarjetas.data?.pagoPronto;

  return (
    <Pantalla>
      <Texto v="tituloGrande" accessibilityRole="header">Cuentas</Texto>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.hueco }}>
        {PESTANAS.map((t) => {
          const activa = pestana === t.valor;
          return (
            <Pressable key={t.valor} accessibilityRole="tab" accessibilityState={{ selected: activa }} onPress={() => setPestana(t.valor)}
              style={{ flex: 1, minHeight: 40, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: activa ? colors.superficie : 'transparent' }}>
              <Texto style={{ fontSize: 13, fontFamily: activa ? fonts.semibold : fonts.medium, color: activa ? colors.texto : colors.textoSuave }}>{t.etiqueta}</Texto>
              {t.valor === 'tarjetas' && pronto && (
                <Texto testID="pago-pronto" style={{ fontSize: 11, fontFamily: fonts.semibold, color: '#8C1D18', backgroundColor: '#FBE9E7', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' }}>
                  {pronto.dias === 0 ? 'Pago hoy' : `Pago en ${pronto.dias} ${pronto.dias === 1 ? 'día' : 'días'}`}
                </Texto>
              )}
            </Pressable>
          );
        })}
      </View>
      {pestana === 'tarjetas' ? <CuentasTarjetas /> : pestana === 'creditos' ? <CuentasCreditos /> : <PestanaCuentas />}
    </Pantalla>
  );
}

/** La pestaña Cuentas: saldo del hogar, cuadrar, mover dinero y las cuentas con su titular y cuadre. */
function PestanaCuentas() {
  const m = useMiembros();
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const datos = useConsulta(['cuentas', filtro], (p) => p.cuentas.cuentas(filtro));
  const todas = useConsulta(['cuentas', 'TODAS'], (p) => p.cuentas.cuentas());
  const accion = useAccion();
  const [hoja, setHoja] = useState<'agregar' | 'mover' | null>(null);
  const [nombre, setNombre] = useState('');
  const [titular, setTitular] = useState<string | null>(CONJUNTA);
  const [monto, setMonto] = useState<number | null>(null);
  const [desde, setDesde] = useState<Id | null>(null);
  const [hacia, setHacia] = useState<Id | null>(null);

  const cerrar = () => {
    setHoja(null);
    setNombre('');
    setMonto(null);
    setDesde(null);
    setHacia(null);
    accion.limpiar();
  };
  const opcionesCuenta = (todas.data?.cuentas ?? []).map((c) => ({ valor: c.cuenta.id, etiqueta: c.cuenta.nombre }));
  const d = datos.data;

  return (
    <>
      {d && (
        <>
          <View style={{ gap: 6 }}>
            <Texto v="rotulo">Saldo del hogar · estimado</Texto>
            <Text testID="saldo-hogar" style={{ fontFamily: fonts.semibold, fontSize: 30, color: colors.texto }}>≈ <Monto valor={d.total} style={{ fontSize: 30, fontFamily: fonts.semibold }} /></Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton titulo="Cuadrar cuentas" onPress={() => router.push('/cuadrar')} style={{ flex: 1, minHeight: 46 }} />
            <Boton tipo="secundario" titulo="Mover dinero" onPress={() => setHoja('mover')} style={{ flex: 1, minHeight: 46 }} />
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Texto v="subtitulo" accessibilityRole="header">Cuentas</Texto>
              <Boton tipo="texto" titulo="+ Agregar" onPress={() => setHoja('agregar')} />
            </View>
            <FiltroTitular valor={filtro} onCambio={setFiltro} />
            {d.cuentas.length === 0 && <Texto v="pequeno">No hay cuentas{filtro === 'TODAS' ? '' : ' con ese titular'}.</Texto>}
            {d.cuentas.map((c, i) => (
              <Fila key={c.cuenta.id} onPress={() => router.push(`/cuenta/${c.cuenta.id}`)} testID={`cuenta-${c.cuenta.nombre}`} titulo={c.cuenta.nombre} detalle={`${c.titular} · ${c.estadoCuadre}`} tonoDetalle={c.aviso ? colors.aviso : undefined} ultima={i === d.cuentas.length - 1}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.estimado ? colors.secundario : colors.texto }}>{c.estimado ? '≈ ' : ''}<Monto valor={c.saldo} style={{ color: c.estimado ? colors.secundario : colors.texto }} /></Text>
              </Fila>
            ))}
          </View>
        </>
      )}

      <Modal visible={hoja !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={cerrar}>
        <CuerpoModal>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{hoja === 'agregar' ? 'Nueva cuenta' : 'Mover dinero'}</Texto>
            <Boton tipo="enlace" titulo="Cancelar" onPress={cerrar} />
          </View>
          {hoja === 'agregar' ? (
            <>
              <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} placeholder="Ej: Bancolombia" />
              <Segmentado chips etiqueta="Titular" opciones={[...m.miembros.map((x) => ({ valor: x.usuario.id, etiqueta: x.usuario.nombre })), { valor: CONJUNTA, etiqueta: 'Conjunta' }]} valor={titular} onCambio={setTitular} />
              <MontoInput etiqueta="Saldo aproximado" valor={monto} onCambio={setMonto} />
              <Aviso texto={accion.error} />
              <Boton titulo="Agregar cuenta" deshabilitado={!nombre.trim() || monto === null || accion.ocupado}
                onPress={() => accion.ejecutar((p) => p.cuentas.agregar({ nombre, titularId: titular === CONJUNTA ? null : titular, saldo: monto! })).then((ok) => ok && cerrar())} />
            </>
          ) : (
            <>
              <Segmentado chips etiqueta="Desde" opciones={opcionesCuenta} valor={desde} onCambio={setDesde} />
              <Segmentado chips etiqueta="Hacia" opciones={opcionesCuenta} valor={hacia} onCambio={setHacia} />
              <MontoInput etiqueta="¿Cuánto?" grande valor={monto} onCambio={setMonto} />
              <Aviso texto={accion.error} />
              <Boton titulo="Mover" deshabilitado={!desde || !hacia || !monto || accion.ocupado}
                onPress={() => accion.ejecutar((p) => p.cuentas.mover({ desde: desde!, hacia: hacia!, monto: monto! })).then((ok) => ok && cerrar())} />
            </>
          )}
        </CuerpoModal>
      </Modal>
    </>
  );
}
