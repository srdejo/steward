import { formatCop, formatFechaCorta, type FiltroTitular as Filtro, type Id, type MovimientoCuenta } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { CuentasCreditos } from '@/components/cuentas-creditos';
import { CuentasTarjetas } from '@/components/cuentas-tarjetas';
import { FiltroTitular } from '@/components/filtro-titular';
import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta } from '@/data/puertos';
import { Avatar, Aviso, Boton, Campo, colors, fonts, Monto, MontoInput, Pantalla, Segmentado, Texto, CuerpoModal } from '@/ui';

const CONJUNTA = '__conjunta__';
/** Color de cada cuenta en la lista (canvas Libreta clara), en el orden en que se crearon. */
const COLORES_CUENTA = ['#C2603A', '#6B5BA8', '#3F6E9E', '#8A8D85', '#2F7A4F', '#2C7A70'];
/** Movimientos que se ven en "Movimientos recientes". */
const RECIENTES = 4;
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
    <Pantalla style={{ paddingHorizontal: 16, paddingTop: 20, gap: 14 }}>
      <Texto v="tituloGrande" accessibilityRole="header" style={{ paddingHorizontal: 4 }}>Cuentas</Texto>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.hueco }}>
        {PESTANAS.map((t) => {
          const activa = pestana === t.valor;
          return (
            <Pressable key={t.valor} accessibilityRole="tab" accessibilityState={{ selected: activa }} onPress={() => setPestana(t.valor)}
              style={{ flex: 1, minHeight: 40, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: activa ? colors.superficie : 'transparent' }}>
              <Texto style={{ fontSize: 14, fontFamily: activa ? fonts.semibold : fonts.medium, color: colors.texto }}>{t.etiqueta}</Texto>
              {t.valor === 'tarjetas' && pronto && (
                <Texto testID="pago-pronto" style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.negativo, backgroundColor: colors.negativoSuave, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' }}>
                  {pronto.dias === 0 ? 'hoy' : `${pronto.dias} ${pronto.dias === 1 ? 'día' : 'días'}`}
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
  const ids = (todas.data?.cuentas ?? []).map((c) => c.cuenta.id);
  const color = (id: Id) => COLORES_CUENTA[Math.max(0, ids.indexOf(id)) % COLORES_CUENTA.length]!;
  const nombreCuenta = (id: Id) => todas.data?.cuentas.find((c) => c.cuenta.id === id)?.cuenta.nombre ?? '';
  // Los movimientos del hogar, del mas reciente al mas antiguo; una transferencia se ve una vez, con su cuenta de origen.
  const movs = useConsulta(['movimientos-recientes', ids.join(',')], async (p) => {
    const listas = await Promise.all(ids.map(async (id) => (await p.cuentas.movimientos(id)).map((x) => ({ ...x, cuentaId: id, transferencia: false }))));
    const unicos = new Map<Id, MovimientoCuenta & { cuentaId: Id; transferencia: boolean }>();
    for (const x of listas.flat()) {
      const previo = unicos.get(x.movimiento.id);
      if (!previo) unicos.set(x.movimiento.id, x);
      else unicos.set(x.movimiento.id, { ...(previo.efecto < 0 ? previo : x), transferencia: true });
    }
    return [...unicos.values()].sort((a, b) => b.movimiento.seq - a.movimiento.seq).slice(0, RECIENTES);
  });

  return (
    <>
      {d && (
        <>
          <View style={{ backgroundColor: colors.superficie, borderRadius: 20, padding: 18, gap: 14 }}>
            <View style={{ gap: 4 }}>
              <Texto style={{ fontSize: 13, color: colors.secundario }}>Saldo del hogar · estimado</Texto>
              <Text testID="saldo-hogar" style={{ fontFamily: fonts.display, fontSize: 34, letterSpacing: -0.68, color: colors.texto }}>{`≈ ${formatCop(todas.data?.total ?? d.total)}`}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Boton titulo="Cuadrar" onPress={() => router.push('/cuadrar')} style={{ flex: 1, minHeight: 46 }} />
              <Boton tipo="secundario" titulo="Mover dinero" onPress={() => setHoja('mover')} style={{ flex: 1, minHeight: 46 }} />
            </View>
          </View>

          <View style={{ backgroundColor: colors.superficie, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 }}>
            <View style={{ paddingTop: 12, paddingBottom: 4 }}><FiltroTitular valor={filtro} onCambio={setFiltro} /></View>
            {d.cuentas.length === 0 && <Texto v="pequeno" style={{ paddingVertical: 10 }}>No hay cuentas{filtro === 'TODAS' ? '' : ' con ese titular'}.</Texto>}
            {d.cuentas.map((c) => (
              <Pressable key={c.cuenta.id} accessibilityRole="button" testID={`cuenta-${c.cuenta.nombre}`} onPress={() => router.push(`/cuenta/${c.cuenta.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color(c.cuenta.id) }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto style={{ fontSize: 15, fontFamily: fonts.medium }}>{c.cuenta.nombre}</Texto>
                  <Texto style={{ fontSize: 12, color: c.aviso ? colors.aviso : colors.secundario }}>{`${c.titular} · ${c.estadoCuadre}`}</Texto>
                </View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: c.estimado ? colors.secundario : colors.texto }}>{c.estimado ? '≈ ' : ''}<Monto valor={c.saldo} style={{ fontFamily: fonts.semibold, fontSize: 15, color: c.estimado ? colors.secundario : colors.texto }} /></Text>
              </Pressable>
            ))}
            <Boton tipo="texto" titulo="+ Cuenta" onPress={() => setHoja('agregar')} style={{ minHeight: 44 }} />
          </View>

          <View testID="movimientos-recientes" style={{ backgroundColor: colors.superficie, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 }}>
            <Texto accessibilityRole="header" style={{ paddingTop: 12, paddingBottom: 4, fontSize: 14, fontFamily: fonts.semibold, color: colors.textoSuave }}>Movimientos recientes</Texto>
            {(movs.data ?? []).length === 0 && <Texto v="pequeno" style={{ paddingVertical: 10 }}>Sin movimientos desde el último cuadre.</Texto>}
            {(movs.data ?? []).map((x) => (
              <Pressable key={x.movimiento.id + x.cuentaId} accessibilityRole="button" testID="movimiento"
                onPress={() => router.push(x.corregible ? `/registro/${x.movimiento.id}` : `/cuenta/${x.cuentaId}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divisor }}>
                <Avatar inicial={m.inicialDe(x.movimiento.usuarioId)} variante={m.varianteDe(x.movimiento.usuarioId)} tamano={30} nombre={m.nombreDe(x.movimiento.usuarioId)} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Texto numberOfLines={1} style={{ fontSize: 14 }}>{x.descripcion}</Texto>
                  <Texto numberOfLines={1} style={{ fontSize: 12, color: colors.secundario }}>{`${formatFechaCorta(x.movimiento.fecha)} · ${x.movimiento.nota && x.movimiento.nota !== x.descripcion ? x.movimiento.nota : nombreCuenta(x.cuentaId)}`}</Texto>
                </View>
                <Texto style={{ fontSize: 14, fontFamily: fonts.semibold, color: x.transferencia ? colors.secundario : x.efecto > 0 ? colors.positivo : colors.texto }}>
                  {x.transferencia ? formatCop(Math.abs(x.efecto)) : formatCop(x.efecto, { signo: true })}
                </Texto>
              </Pressable>
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
