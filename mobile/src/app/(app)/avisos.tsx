import {
  claveMes,
  ORDEN_GRUPO_AVISO,
  PREFERENCIAS_AVISO,
  TEXTO_CUANDO_AVISA,
  TITULO_GRUPO_AVISO,
  type Aviso,
  type GrupoAviso,
  type PreferenciasAviso,
  type TipoAvisoConfigurable,
} from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useNotificaciones } from '@/data/notificaciones';
import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso as Alerta, Boton, colors, fonts, Icono, Interruptor, Monto, Pantalla, Texto } from '@/ui';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** El color del bloque de fecha (canvas MAvisos). */
function colorBloque(a: Aviso): { fondo: string; texto: string; borde?: string } {
  if (a.corte) return { fondo: 'transparent', texto: '#4B3E85', borde: '#B9B0DA' };
  if (a.grupo === 'VENCIDO') return { fondo: colors.negativoSuave, texto: '#8C1D18' };
  if (a.tipo === 'INGRESO') return { fondo: colors.acentoElegido, texto: colors.positivo };
  if (a.tipo === 'PLAN' || a.tipo === 'CUADRAR') return { fondo: colors.acentoElegido, texto: colors.acento };
  if (a.tipo === 'TARJETA' || a.tipo === 'CUOTA') return { fondo: '#EDEAF5', texto: '#4B3E85' };
  return a.grupo === 'SEMANA' ? { fondo: colors.avisoSuave, texto: colors.aviso } : { fondo: colors.divisor, texto: colors.textoSuave };
}

/**
 * Avisos (spec steward-avisos, "Avisos · Próximos" y "Avisos · Configurar"; canvas MAvisos): lo que viene en 30 dias
 * agrupado, con marcar pagado ahi mismo, y la configuracion de quien la abre. `?pestana=configurar` abre Configurar.
 */
export default function Avisos() {
  const params = useLocalSearchParams<{ pestana?: string }>();
  const [pestana, setPestana] = useState<'proximos' | 'configurar'>(params.pestana === 'configurar' ? 'configurar' : 'proximos');
  const avisos = useConsulta(['avisos'], (p) => p.avisos.proximos());
  const preferencias = useConsulta(['avisos', 'preferencias'], (p) => p.avisos.preferencias());
  const accion = useAccion();
  const notificaciones = useNotificaciones();
  const { sesion } = useSesion();
  const m = useMiembros();
  const [mensaje, setMensaje] = useState('');
  const prefs: PreferenciasAviso = preferencias.data ?? PREFERENCIAS_AVISO;
  const otro = m.miembros.find((x) => x.usuario.id !== sesion?.usuario.id)?.usuario.nombre;

  const grupos = (() => {
    const porGrupo = new Map<GrupoAviso, Aviso[]>();
    for (const a of avisos.data ?? []) porGrupo.set(a.grupo, [...(porGrupo.get(a.grupo) ?? []), a]);
    return [...porGrupo.entries()].sort(([a], [b]) => ORDEN_GRUPO_AVISO[a] - ORDEN_GRUPO_AVISO[b]);
  })();

  const tipos: { tipo: TipoAvisoConfigurable; titulo: string; detalle: string }[] = [
    { tipo: 'PAGO', titulo: 'Pagos y recibos', detalle: 'Gastos fijos con día de pago' },
    { tipo: 'TARJETA', titulo: 'Tarjetas', detalle: 'Fecha de pago y de corte' },
    { tipo: 'CUOTA', titulo: 'Cuotas de créditos', detalle: 'Cada cuota con su número' },
    { tipo: 'INGRESO', titulo: 'Ingresos esperados', detalle: 'Pregunta si llegó, para calcular el diezmo' },
    { tipo: 'PLAN', titulo: 'Plan del mes', detalle: 'Elegir opción y cerrar el mes' },
    { tipo: 'CUADRAR', titulo: 'Cuadrar cuentas', detalle: 'Si una lleva más de 30 días sin cuadrar' },
    ...(otro ? [{ tipo: 'ACTIVIDAD' as const, titulo: `Lo que marque ${otro}`, detalle: 'Pagos y aportes que registre' }] : []),
  ];

  const guardar = (cambios: Partial<PreferenciasAviso>) => void accion.ejecutar((p) => p.avisos.guardarPreferencias({ ...prefs, ...cambios }));
  const cambiarTipo = (t: TipoAvisoConfigurable, activo: boolean) => {
    const apagados = prefs.tiposApagados.filter((x) => x !== t);
    guardar({ tiposApagados: activo ? apagados : [...apagados, t] });
  };
  const ir = (a: Aviso) => {
    const d = a.destino!;
    if (d.tipo === 'CIERRE') router.push(`/cierre/${claveMes(d.ref)}`);
    else if (d.tipo === 'COMPARAR') router.push(`/comparar/${claveMes(d.ref)}`);
    else if (d.tipo === 'CUENTA') router.push(`/cuenta/${d.cuentaId}`);
    else router.push('/hoy');
  };

  return (
    <Pantalla style={{ paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.push('/hoy'))} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
          <Texto style={{ fontSize: 14, fontFamily: fonts.medium, color: colors.acento }}>‹ Hoy</Texto>
        </Pressable>
        <Texto v="tituloGrande" accessibilityRole="header">Avisos</Texto>
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.hueco }}>
        {([['proximos', 'Próximos'], ['configurar', 'Configurar']] as const).map(([valor, etiqueta]) => {
          const activa = pestana === valor;
          return (
            <Pressable key={valor} accessibilityRole="tab" accessibilityState={{ selected: activa }} onPress={() => setPestana(valor)}
              style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: activa ? colors.superficie : 'transparent' }}>
              <Texto style={{ fontSize: 14, fontFamily: activa ? fonts.semibold : fonts.medium }}>{etiqueta}</Texto>
            </Pressable>
          );
        })}
      </View>

      {pestana === 'proximos' ? (
        <View style={{ gap: 16 }}>
          {grupos.map(([grupo, lista]) => (
            <View key={grupo} testID={`grupo-avisos-${grupo}`} style={{ gap: 6 }}>
              <Texto accessibilityRole="header" style={{ paddingHorizontal: 4, fontSize: 13, fontFamily: fonts.semibold, color: grupo === 'VENCIDO' ? colors.negativo : colors.textoSuave }}>{TITULO_GRUPO_AVISO[grupo]}</Texto>
              <View style={{ backgroundColor: colors.superficie, borderRadius: 16 }}>
                {lista.map((a, i) => {
                  const b = colorBloque(a);
                  return (
                    <View key={a.clave} testID={`aviso-${a.nombre}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 60, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divisor }}>
                      <View style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: b.fondo, borderWidth: b.borde ? 2 : 0, borderColor: b.borde }}>
                        <Texto style={{ fontSize: 14, lineHeight: 15, fontFamily: fonts.bold, color: b.texto }}>{String(Number(a.fecha.slice(8)))}</Texto>
                        <Texto style={{ fontSize: 10, lineHeight: 11, color: b.texto }}>{MESES_CORTOS[Number(a.fecha.slice(5, 7)) - 1]}</Texto>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Texto style={{ fontSize: 14, fontFamily: fonts.medium }}>{a.nombre}</Texto>
                        <Texto style={{ fontSize: 12, color: a.grupo === 'VENCIDO' ? colors.negativo : colors.secundario, fontFamily: a.grupo === 'VENCIDO' ? fonts.semibold : fonts.regular }}>{a.detalle}</Texto>
                      </View>
                      {a.monto !== null && <Monto valor={a.monto} style={{ fontSize: 14, fontFamily: fonts.semibold }} />}
                      {a.pago ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Marcar pagado ${a.nombre}`} onPress={() => router.push(`/pagar/${a.pago!.itemId}?mes=${claveMes(a.pago!.ref)}`)}
                          style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#C9C6BD', alignItems: 'center', justifyContent: 'center' }}>
                          <Icono nombre="check" tamano={18} color={colors.acento} />
                        </Pressable>
                      ) : a.destino ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Ir a ${a.nombre}`} onPress={() => ir(a)}
                          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.acentoSuave, alignItems: 'center', justifyContent: 'center' }}>
                          <Texto style={{ fontSize: 20, fontFamily: fonts.semibold, color: colors.acento }}>›</Texto>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          {avisos.data && avisos.data.length === 0 && <Texto v="pequeno">Nada por avisar en los próximos 30 días.</Texto>}
          <Texto style={{ fontSize: 12, color: colors.secundario, textAlign: 'center' }}>Lo que marques aquí también queda pagado en Hoy.</Texto>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ backgroundColor: colors.superficie, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 6 }}>
            <Texto style={{ fontSize: 15, fontFamily: fonts.semibold }}>Cuándo avisa</Texto>
            <Texto testID="cuando-avisa" style={{ fontSize: 13, lineHeight: 19, color: colors.textoSuave }}>{TEXTO_CUANDO_AVISA}</Texto>
          </View>
          <View style={{ backgroundColor: colors.superficie, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 }}>
            {tipos.map((t) => (
              <Interruptor key={t.tipo} titulo={t.titulo} detalle={t.detalle} activo={!prefs.tiposApagados.includes(t.tipo)} onCambio={(v) => cambiarTipo(t.tipo, v)} />
            ))}
          </View>
          <View style={{ backgroundColor: colors.superficie, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }} testID="notificaciones">
              <View style={{ flex: 1 }}>
                <Texto style={{ fontSize: 15, fontFamily: fonts.medium }}>Notificaciones en este celular</Texto>
                <Texto style={{ fontSize: 12, color: notificaciones.estado === 'ACTIVADAS' ? colors.positivo : colors.secundario }}>
                  {notificaciones.estado === 'ACTIVADAS' ? 'Activadas' : notificaciones.estado === 'BLOQUEADAS' ? 'Bloqueadas: actívalas en Ajustes del iPhone' : 'Apagadas'}
                </Texto>
              </View>
              {notificaciones.estado === 'ACTIVADAS' ? (
                <Boton tipo="secundario" titulo="Probar" deshabilitado={accion.ocupado} onPress={() => void accion.ejecutar((p) => p.avisos.probar()).then((ok) => ok && setMensaje('Enviamos un aviso de prueba.'))} style={{ minHeight: 40, paddingHorizontal: 14 }} />
              ) : notificaciones.estado === 'APAGADAS' ? (
                <Boton titulo="Activar" deshabilitado={accion.ocupado} onPress={() => void notificaciones.activar().then((ok) => ok && setMensaje('Notificaciones activadas.'))} style={{ minHeight: 40, paddingHorizontal: 14 }} />
              ) : null}
            </View>
            <Interruptor titulo="Resumen por correo" detalle="Lunes 7:30 · pagos de la semana" activo={prefs.correo} onCambio={(v) => guardar({ correo: v })} />
            <Interruptor titulo="No molestar" detalle="Nada entre 9:00 p. m. y 7:00 a. m." activo={prefs.noMolestar} onCambio={(v) => guardar({ noMolestar: v })} />
          </View>
          {mensaje ? <Texto style={{ fontSize: 13, color: colors.positivo, paddingHorizontal: 4 }}>{mensaje}</Texto> : null}
          <Alerta texto={accion.error || notificaciones.error} />
        </View>
      )}
    </Pantalla>
  );
}
