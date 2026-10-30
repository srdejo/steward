import { formatFechaCorta, formatPorcentaje, type BaseDiezmo, type Categoria, type IngresoFijo } from '@steward/domain';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Avatar, Aviso, Boton, Campo, colors, Encabezado, fonts, Interruptor, Monto, MontoInput, Pantalla, Segmentado, Texto } from '@/ui';

type Dialogo =
  | { tipo: 'invitar' }
  | { tipo: 'ingreso'; ingreso: IngresoFijo }
  | { tipo: 'aportes' }
  | { tipo: 'categoria'; categoria: Categoria | null }
  | { tipo: 'confirmar'; accion: 'salir' | 'restablecer' | 'desde-cero' };

const CONFIRMACIONES = {
  salir: { titulo: 'Salir del hogar', texto: 'Dejarás de ver y registrar en este presupuesto. Los demás miembros lo conservan.', boton: 'Salir del hogar' },
  restablecer: { titulo: 'Restablecer datos de prueba', texto: 'Se borra todo lo que registraste y vuelven los datos de ejemplo.', boton: 'Restablecer' },
  'desde-cero': { titulo: 'Probar desde cero', texto: 'Se borra el hogar de prueba y se cierra la sesión para recorrer el acceso y el onboarding.', boton: 'Empezar desde cero' },
} as const;

function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Texto v="rotulo" accessibilityRole="header">{titulo}</Texto>
        {accion}
      </View>
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borde, backgroundColor: colors.superficie, paddingHorizontal: 16, paddingVertical: 4 }}>{children}</View>
    </View>
  );
}

/** Ajustes.dc.html: hogar y miembros, mis ingresos y diezmo, categorías, seguridad y privacidad (spec steward-ajustes). */
export default function Ajustes() {
  const puertos = usePuertos();
  const sesion = useSesion();
  const m = useMiembros();
  const fijos = useConsulta(['fijos'], (p) => p.ingresos.fijos());
  const regla = useConsulta(['regla'], (p) => p.ingresos.regla());
  const categorias = useConsulta(['categorias'], (p) => p.hogar.categorias());
  const accion = useAccion();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [texto, setTexto] = useState('');
  const [bruto, setBruto] = useState<number | null>(null);
  const [neto, setNeto] = useState<number | null>(null);
  const [dia, setDia] = useState(1);
  const [reglaActiva, setReglaActiva] = useState(true);
  const [porcentaje, setPorcentaje] = useState(10);
  const [base, setBase] = useState<BaseDiezmo | null>('BRUTO');
  const [aplicaAportes, setAplicaAportes] = useState(true);
  const [mensaje, setMensaje] = useState('');

  const r = regla.data;
  const textoDiezmo = r?.activa ? `diezmo ${formatPorcentaje(r.porcentaje)} del ${r.base === 'BRUTO' ? 'bruto' : 'neto'}` : 'sin diezmo';
  const textoAportes = r?.activa && r.aplicaAportes ? `diezmo ${formatPorcentaje(r.porcentaje)}` : 'sin diezmo';

  function abrir(d: Dialogo) {
    accion.limpiar();
    setMensaje('');
    setTexto(d.tipo === 'ingreso' ? d.ingreso.nombre : d.tipo === 'categoria' && d.categoria ? d.categoria.nombre : '');
    if (d.tipo === 'ingreso') {
      setBruto(d.ingreso.bruto);
      setNeto(d.ingreso.neto);
      setDia(d.ingreso.diaPago);
    }
    if (d.tipo === 'aportes') {
      setReglaActiva(r?.activa ?? false);
      setPorcentaje(r?.porcentaje ?? 10);
      setBase(r?.base ?? 'BRUTO');
      setAplicaAportes(r?.aplicaAportes ?? false);
    }
    setDialogo(d);
  }

  async function confirmar() {
    const d = dialogo!;
    if (d.tipo === 'confirmar') {
      if (d.accion === 'restablecer') {
        if (await accion.ejecutar((p) => p.demo!.restablecer())) {
          setDialogo(null);
          setMensaje('Volvieron los datos de ejemplo.');
        }
        return;
      }
      const ok = await accion.ejecutar((p) => (d.accion === 'desde-cero' ? p.demo!.probarDesdeCero() : p.hogar.salir()));
      if (ok) {
        setDialogo(null);
        sesion.establecer(null);
        router.replace('/acceso');
      }
      return;
    }
    const ok = await accion.ejecutar((p) => {
      switch (d.tipo) {
        case 'invitar':
          return p.hogar.invitar(texto);
        case 'ingreso':
          return p.ingresos.guardarFijo({ id: d.ingreso.id, nombre: texto, bruto: bruto ?? neto!, neto: neto!, diaPago: dia, cuentaId: d.ingreso.cuentaId });
        case 'aportes':
          return p.ingresos.guardarRegla({ activa: reglaActiva, porcentaje: porcentaje || 10, base: base ?? 'BRUTO', aplicaAportes: reglaActiva && aplicaAportes });
        case 'categoria':
          return p.hogar.guardarCategoria({ id: d.categoria?.id, nombre: texto });
      }
    });
    if (ok) {
      if (d.tipo === 'invitar') setMensaje(`Invitación enviada a ${texto.trim()}.`);
      setDialogo(null);
    }
  }

  const tituloDialogo = !dialogo ? '' : dialogo.tipo === 'invitar' ? 'Invitar al hogar' : dialogo.tipo === 'ingreso' ? `Editar ${dialogo.ingreso.nombre}` : dialogo.tipo === 'aportes' ? 'Mi diezmo' : dialogo.tipo === 'categoria' ? (dialogo.categoria ? 'Editar categoría' : 'Nueva categoría') : CONFIRMACIONES[dialogo.accion].titulo;
  const botonDialogo = !dialogo ? '' : dialogo.tipo === 'invitar' ? 'Invitar' : dialogo.tipo === 'categoria' && !dialogo.categoria ? 'Crear categoría' : dialogo.tipo === 'confirmar' ? CONFIRMACIONES[dialogo.accion].boton : 'Guardar';

  return (
    <Pantalla>
      <Encabezado titulo="Ajustes" volver="/hoy" volverTexto="Hoy" />
      <Seccion titulo={`Hogar · ${m.hogar?.hogar.nombre ?? ''}`}>
        {m.miembros.map((x) => (
          <View key={x.usuario.id} testID="miembro" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
            <Avatar inicial={x.usuario.inicial} variante={x.variante} />
            <Texto style={{ flex: 1 }}>{x.usuario.nombre}{x.esActual ? <Texto style={{ color: colors.secundario }}> (tú)</Texto> : null}</Texto>
            {!x.esActual && x.unidoEn ? <Texto v="detalle">Se unió el {formatFechaCorta(x.unidoEn)}</Texto> : null}
          </View>
        ))}
        <Boton tipo="texto" titulo="+ Invitar a alguien más" onPress={() => abrir({ tipo: 'invitar' })} />
      </Seccion>

      <View style={{ gap: 8 }}>
        <Seccion titulo="Mis ingresos y diezmo">
          {(fijos.data ?? []).map((f) => (
            <Pressable key={f.id} accessibilityRole="button" onPress={() => abrir({ tipo: 'ingreso', ingreso: f })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
              <View style={{ gap: 2 }}><Texto>{f.nombre}</Texto><Texto v="detalle" style={{ color: colors.diezmo }}>Fijo · {textoDiezmo}</Texto></View>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13 }}><Monto valor={f.neto} style={{ fontSize: 13 }} /> ›</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => abrir({ tipo: 'aportes' })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
            <View style={{ gap: 2 }}><Texto>Aportes variables</Texto><Texto v="detalle" style={{ color: colors.diezmo }}>Contratos, negocio · {textoAportes}</Texto></View>
            <Texto v="pequeno">Editar ›</Texto>
          </Pressable>
        </Seccion>
        <Texto v="detalle">Cada persona configura su propio diezmo. La regla sugiere el monto de los ítems de diezmo de cada mes nuevo; cambiarla no cambia los meses ya creados.</Texto>
      </View>

      <Seccion titulo="Categorías" accion={<Boton tipo="texto" titulo="+ Nueva" onPress={() => abrir({ tipo: 'categoria', categoria: null })} />}>
        {(categorias.data ?? []).map((c, i) => (
          <View key={c.id} testID="categoria" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, borderBottomWidth: i === (categorias.data?.length ?? 0) - 1 ? 0 : 1, borderBottomColor: colors.divisor }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.color }} />
            <Texto style={{ flex: 1 }}>{c.nombre}</Texto>
            <Boton tipo="enlace" titulo="Editar" onPress={() => abrir({ tipo: 'categoria', categoria: c })} />
          </View>
        ))}
      </Seccion>

      <Seccion titulo="Seguridad y privacidad">
        <Interruptor titulo="Face ID al abrir" detalle="Tras 5 min sin usar" activo={sesion.preferencias.faceIdAlAbrir} onCambio={(v) => sesion.guardarPreferencias({ faceIdAlAbrir: v })} />
        <Interruptor titulo="Ocultar montos" detalle="Muestra $•••• hasta tocar" activo={sesion.preferencias.ocultarMontos} onCambio={(v) => sesion.guardarPreferencias({ ocultarMontos: v })} />
      </Seccion>

      {puertos.demo && (
        <Seccion titulo="Datos de prueba">
          <Boton tipo="texto" titulo="Restablecer datos de prueba" onPress={() => abrir({ tipo: 'confirmar', accion: 'restablecer' })} />
          <Boton tipo="texto" titulo="Probar desde cero" onPress={() => abrir({ tipo: 'confirmar', accion: 'desde-cero' })} />
        </Seccion>
      )}

      {mensaje ? <Texto style={{ color: colors.positivo }}>{mensaje}</Texto> : null}
      <View style={{ gap: 4 }}>
        <Boton tipo="secundario" titulo="Cerrar sesión" onPress={async () => { await sesion.cerrar(); router.replace('/acceso'); }} style={{ minHeight: 48 }} />
        <Pressable accessibilityRole="button" onPress={() => abrir({ tipo: 'confirmar', accion: 'salir' })} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.negativo }}>Salir del hogar</Text>
        </Pressable>
      </View>

      <Modal visible={dialogo !== null} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setDialogo(null)}>
        <View style={{ flex: 1, backgroundColor: colors.superficie, padding: 20, gap: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22, flexShrink: 1 }}>{tituloDialogo}</Texto>
            <Boton tipo="enlace" titulo="Cancelar" onPress={() => setDialogo(null)} />
          </View>
          {dialogo?.tipo === 'invitar' && <Campo etiqueta="Correo" teclado="email-address" valor={texto} onCambio={setTexto} placeholder="correo@ejemplo.com" />}
          {dialogo?.tipo === 'categoria' && <Campo etiqueta="Nombre" valor={texto} onCambio={setTexto} placeholder="Ej: Educación" />}
          {dialogo?.tipo === 'ingreso' && (
            <>
              <Campo etiqueta="Nombre" valor={texto} onCambio={setTexto} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><MontoInput etiqueta="Bruto" valor={bruto} onCambio={setBruto} /></View>
                <View style={{ flex: 1 }}><MontoInput etiqueta="Entra (neto)" valor={neto} onCambio={setNeto} /></View>
              </View>
              <Campo etiqueta="Día de pago" teclado="number-pad" valor={String(dia)} onCambio={(t) => setDia(Math.min(31, Number(t.replace(/\D/g, '')) || 1))} />
            </>
          )}
          {dialogo?.tipo === 'aportes' && (
            <>
              <Interruptor titulo="Diezmar de mis ingresos" detalle="Se calcula solo al recibir cada ingreso" activo={reglaActiva} onCambio={setReglaActiva} />
              {reglaActiva && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Texto style={{ fontSize: 14, fontFamily: fonts.medium }}>Porcentaje</Texto>
                    <TextInput accessibilityLabel="Porcentaje" keyboardType="number-pad" value={`${porcentaje}%`} onChangeText={(t) => setPorcentaje(Math.min(100, Number(t.replace(/\D/g, '')) || 0))}
                      style={{ width: 80, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.bordeCampo, backgroundColor: colors.fondo, textAlign: 'center', fontFamily: fonts.mono, fontSize: 16 }} />
                  </View>
                  <Segmentado etiqueta="Calcular sobre" opciones={[{ valor: 'BRUTO', etiqueta: 'Bruto' }, { valor: 'NETO', etiqueta: 'Neto' }]} valor={base} onCambio={setBase} />
                  <Interruptor titulo="También de mis aportes variables" detalle="Contratos, negocio" activo={aplicaAportes} onCambio={setAplicaAportes} />
                </>
              )}
            </>
          )}
          {dialogo?.tipo === 'confirmar' && <Texto style={{ fontSize: 15, color: colors.secundario }}>{CONFIRMACIONES[dialogo.accion].texto}</Texto>}
          <Aviso texto={accion.error} />
          <Boton tipo={dialogo?.tipo === 'confirmar' && dialogo.accion === 'salir' ? 'peligro' : 'primario'} titulo={botonDialogo} onPress={confirmar}
            deshabilitado={(dialogo?.tipo === 'invitar' || dialogo?.tipo === 'categoria' || dialogo?.tipo === 'ingreso') && !texto.trim()} />
        </View>
      </Modal>
    </Pantalla>
  );
}
