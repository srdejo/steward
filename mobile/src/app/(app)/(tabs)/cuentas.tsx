import { formatCop, formatTasa, sumar, type FiltroTitular as Filtro, type Id } from '@steward/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { FiltroTitular } from '@/components/filtro-titular';
import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, Campo, colors, Fila, fonts, Monto, MontoInput, Pantalla, Segmentado, Texto } from '@/ui';

const CONJUNTA = '__conjunta__';

/** Cuentas.dc.html: saldo del hogar estimado, cuentas con titular y cuadre, y los créditos (spec steward-cuentas). */
export default function Cuentas() {
  const m = useMiembros();
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const datos = useConsulta(['cuentas', filtro], (p) => p.cuentas.cuentas(filtro));
  const todas = useConsulta(['cuentas', 'TODAS'], (p) => p.cuentas.cuentas());
  const creditos = useConsulta(['creditos'], (p) => p.cuentas.creditos());
  const accion = useAccion();
  const [hoja, setHoja] = useState<'agregar' | 'mover' | 'credito' | null>(null);
  const [nombre, setNombre] = useState('');
  const [titular, setTitular] = useState<string | null>(CONJUNTA);
  const [monto, setMonto] = useState<number | null>(null);
  const [desde, setDesde] = useState<Id | null>(null);
  const [hacia, setHacia] = useState<Id | null>(null);
  const [entidad, setEntidad] = useState('');
  const [totalOriginal, setTotalOriginal] = useState<number | null>(null);
  const [cuota, setCuota] = useState<number | null>(null);
  const [tasaTexto, setTasaTexto] = useState('');
  const [diaTexto, setDiaTexto] = useState('');
  const tasaEM = Number(tasaTexto.trim().replace(',', '.') || '0');
  const dia = Number(diaTexto.trim());
  // El total original es opcional: si falta, es el saldo.
  const creditoCompleto = !!nombre.trim() && monto !== null && !!cuota && Number.isInteger(dia) && dia >= 1 && Number.isFinite(tasaEM);

  const cerrar = () => {
    setHoja(null);
    setNombre('');
    setMonto(null);
    setDesde(null);
    setHacia(null);
    setEntidad('');
    setTotalOriginal(null);
    setCuota(null);
    setTasaTexto('');
    setDiaTexto('');
    accion.limpiar();
  };
  const opcionesCuenta = (todas.data?.cuentas ?? []).map((c) => ({ valor: c.cuenta.id, etiqueta: c.cuenta.nombre }));
  const d = datos.data;

  return (
    <Pantalla>
      {d && (
        <>
          <View style={{ gap: 6 }}>
            <Texto v="rotulo">Saldo del hogar · estimado</Texto>
            <Text testID="saldo-hogar" style={{ fontFamily: fonts.monoSemibold, fontSize: 30, color: colors.texto }}>≈ <Monto valor={d.total} style={{ fontSize: 30, fontFamily: fonts.monoSemibold }} /></Text>
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
                <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: c.estimado ? colors.secundario : colors.texto }}>{c.estimado ? '≈ ' : ''}<Monto valor={c.saldo} style={{ color: c.estimado ? colors.secundario : colors.texto }} /></Text>
              </Fila>
            ))}
          </View>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Texto v="subtitulo" accessibilityRole="header">Créditos</Texto>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Texto v="detalle">Debes {formatCop(sumar((creditos.data ?? []).map((c) => c.credito.saldo)))}</Texto>
                <Boton tipo="texto" titulo="+ Crédito" onPress={() => setHoja('credito')} />
              </View>
            </View>
            {(creditos.data ?? []).map((c) => (
              <Fila key={c.credito.id} titulo={c.credito.nombre} ultima detalle={`Cuota ${formatCop(c.credito.cuota)} · ${formatTasa(c.credito.tasaEM)}${c.cuotasRestantes !== null ? ` · faltan ${c.cuotasRestantes}` : ''}`} onPress={() => router.push(`/credito/${c.credito.id}`)}>
                <Monto valor={c.credito.saldo} />
                <Texto>›</Texto>
              </Fila>
            ))}
          </View>
          <Texto v="detalle">Las tarjetas de crédito y compras a cuotas viven en el plan como gastos del mes. Aquí solo van las deudas con saldo y tasa.</Texto>
        </>
      )}

      <Modal visible={hoja !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={cerrar}>
        <View style={{ flex: 1, backgroundColor: colors.superficie, padding: 20, gap: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{hoja === 'agregar' ? 'Nueva cuenta' : hoja === 'credito' ? 'Nuevo crédito' : 'Mover dinero'}</Texto>
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
          ) : hoja === 'credito' ? (
            <>
              <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} placeholder="Ej: Libre inversión" />
              <Campo etiqueta="Entidad" valor={entidad} onCambio={setEntidad} placeholder="Ej: Bancolombia" />
              <MontoInput etiqueta="Saldo" valor={monto} onCambio={setMonto} />
              <MontoInput etiqueta="Total original" valor={totalOriginal} onCambio={setTotalOriginal} />
              <MontoInput etiqueta="Cuota" valor={cuota} onCambio={setCuota} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Campo etiqueta="Tasa (% EM)" teclado="decimal-pad" valor={tasaTexto} onCambio={setTasaTexto} placeholder="1,6" /></View>
                <View style={{ flex: 1 }}><Campo etiqueta="Día de pago" teclado="number-pad" valor={diaTexto} onCambio={setDiaTexto} placeholder="15" /></View>
              </View>
              <Aviso texto={accion.error} />
              <Boton titulo="Agregar crédito" deshabilitado={!creditoCompleto || accion.ocupado}
                onPress={() => accion.ejecutar((p) => p.cuentas.agregarCredito({ nombre, entidad, saldo: monto!, totalOriginal: totalOriginal ?? monto!, cuota: cuota!, tasaEM, diaPago: dia })).then((ok) => ok && cerrar())} />
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
        </View>
      </Modal>
    </Pantalla>
  );
}
