import { TITULO_GRUPO, avancePagado, pendientesAvisos, claveMes, diaDelBloque, formatDiaLargo, formatMesAnio, fraseVsPlan, nombreMes, sumar, type ItemEjecucion, type LineaIngreso } from '@steward/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { useMesDeHoy } from '@/data/mes-de-hoy';
import { useMiembros } from '@/data/miembros';
import { useConsulta, usePuertos } from '@/data/puertos';
import { Avatar, Boton, colors, Fila, fonts, Icono, Monto, Pantalla, Segmentado, Tarjeta, Texto } from '@/ui';

/** Pendientes que se ven antes de "Ver N más" (spec steward-hoy). */
const LISTA_CORTA = 3;

/**
 * Main.dc.html: el mes elegido, el en curso o el siguiente (spec steward-hoy). Las hojas se abren encima (formSheet). El
 * diezmo es un item del plan, sin tarjeta aparte, y lo registrado se abre para corregirlo o borrarlo.
 */
/** La campana (spec steward-avisos, "Campana en Hoy"): abre Avisos y muestra lo vencido y lo de 7 días. */
function Campana() {
  const avisos = useConsulta(['avisos'], (p) => p.avisos.proximos());
  const n = pendientesAvisos(avisos.data ?? []);
  return (
    <Pressable testID="campana" accessibilityRole="button" accessibilityLabel={n ? `Avisos · ${n} pendientes` : 'Avisos'} onPress={() => router.push('/avisos')}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icono nombre="campana" tamano={22} />
      {n > 0 && (
        <View testID="insignia-avisos" style={{ position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, borderColor: colors.fondo, backgroundColor: colors.negativo, alignItems: 'center', justifyContent: 'center' }}>
          <Texto style={{ fontSize: 11, lineHeight: 13, fontFamily: fonts.bold, color: '#FFFFFF' }}>{n}</Texto>
        </View>
      )}
    </Pressable>
  );
}

export default function Hoy() {
  const puertos = usePuertos();
  const hoy = puertos.hoy();
  const mesHoy = useMesDeHoy();
  const ref = mesHoy.ref;
  const mes = useConsulta(['mes', claveMes(ref)], (p) => p.plan.mes(ref));
  // Varias opciones sin elegir: se ejecuta la principal (design D3 de plan-mes-siguiente).
  const porElegir = mes.data?.plan && !mes.data.plan.escenarioActivoId && mes.data.opciones.length > 1 ? mes.data.opciones[0]!.escenario.letra : null;
  const resumen = useConsulta(['resumen', ref], (p) => p.movimientos.resumenMes(ref));
  const m = useMiembros();
  const r = resumen.data;

  // Por pagar empieza con 3 y se despliega con "Ver N más"; al cambiar de mes vuelve a corto (design D2).
  const [verTodo, setVerTodo] = useState(false);
  useEffect(() => setVerTodo(false), [mesHoy.clave]);
  const porPagar = r?.porPagar ?? [];
  const visibles = verTodo ? porPagar : porPagar.slice(0, LISTA_CORTA);
  const ocultos = verTodo ? [] : porPagar.slice(LISTA_CORTA);

  const porRecibir = (l: LineaIngreso) => !l.recibido && Boolean(l.lineaId || l.ingresoFijoId);
  const [pagadosAbiertos, setPagadosAbiertos] = useState(true);
  const mesCorto = nombreMes(ref.mes).slice(0, 3);
  const bloque = (i: ItemEjecucion) =>
    i.grupo === 'VENCIDO' ? { backgroundColor: colors.negativoSuave, color: colors.negativo } : i.grupo === 'SEMANA' ? { backgroundColor: colors.avisoSuave, color: colors.aviso } : { backgroundColor: colors.nota, color: colors.secundario };

  return (
    <Pantalla>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <View style={{ gap: 2 }}>
          <Texto v="pequeno" testID="fecha-hoy">{formatDiaLargo(hoy)}</Texto>
          <Texto v="tituloGrande" accessibilityRole="header">Hoy</Texto>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Campana />
        <Pressable accessibilityRole="button" accessibilityLabel="Ajustes del hogar" onPress={() => router.push('/ajustes')} style={{ flexDirection: 'row', paddingVertical: 6 }}>
          {m.miembros.map((x, i) => (
            <Avatar key={x.usuario.id} inicial={x.usuario.inicial} variante={x.variante} style={i ? { marginLeft: -10, borderWidth: 2, borderColor: colors.fondo } : undefined} />
          ))}
        </Pressable>
        </View>
      </View>

      <Segmentado opciones={mesHoy.opciones} valor={mesHoy.clave} onCambio={(c) => c && mesHoy.elegir(c)} />
      {porElegir && <Boton tipo="texto" titulo={`Opción ${porElegir} · elige otra en Plan`} onPress={() => router.push(`/mes/${claveMes(ref)}`)} />}

      {!r ? (
        <Texto v="pequeno">Cargando el mes…</Texto>
      ) : (
        <>
          {r.sinPlan && (
            <Tarjeta>
              <Texto v="rotulo">Este mes no tiene plan</Texto>
              <Texto v="pequeno">Empieza desde el mes anterior, solo con lo fijo o desde cero.</Texto>
              <Boton titulo={`Planear ${formatMesAnio(ref)}`} onPress={() => router.push(`/mes/${claveMes(ref)}`)} />
            </Tarjeta>
          )}

          <View testID="resumen-mes" style={{ backgroundColor: colors.acento, borderRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Texto style={{ fontSize: 13, color: '#CFE0D6' }}>Te queda libre en {nombreMes(ref.mes)}</Texto>
              <Monto testID="libre" valor={r.libre} style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: r.libre < 0 ? '#FFC2BB' : colors.superficie }} />
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: '#3E6B58', overflow: 'hidden' }}>
                <View style={{ width: `${avancePagado(r)}%`, height: 8, borderRadius: 4, backgroundColor: colors.superficie }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ gap: 1 }}>
                  <Texto style={{ fontSize: 13, color: '#CFE0D6' }}>Pagado</Texto>
                  <Monto valor={r.pagado} style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.superficie }} />
                </View>
                <View testID="falta-pagar" style={{ gap: 1, alignItems: 'flex-end' }}>
                  <Texto style={{ fontSize: 13, color: '#CFE0D6' }}>Falta pagar</Texto>
                  <Monto valor={r.faltaPagar} style={{ fontFamily: fonts.semibold, fontSize: 13, color: r.faltaPagar > 0 ? '#FFC2BB' : colors.superficie }} />
                </View>
              </View>
            </View>
            <Texto testID="vs-plan" style={{ alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 999, backgroundColor: '#2C6250', paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontFamily: fonts.semibold, color: '#E7F1EB' }}>{fraseVsPlan(r.vsPlan)}</Texto>
          </View>

          <Tarjeta style={{ paddingHorizontal: 0, paddingVertical: 6, gap: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
              <Texto v="subtitulo" accessibilityRole="header">Por pagar</Texto>
              {r.porPagar.length > 0 && <Texto v="pequeno" testID="pendientes">{`${r.porPagar.length} ${r.porPagar.length === 1 ? 'pendiente' : 'pendientes'}`}</Texto>}
            </View>
            {r.porPagar.length === 0 && <Texto v="pequeno" style={{ paddingHorizontal: 16, paddingBottom: 16 }}>Todo pagado este mes.</Texto>}
            {visibles.map((i, k) => (
              <View key={i.item.id}>
                {(k === 0 || visibles[k - 1]!.grupo !== i.grupo) && (
                  <Texto testID={`grupo-${i.grupo}`} style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2, fontSize: 12, fontFamily: fonts.semibold, color: i.grupo === 'VENCIDO' ? colors.negativo : colors.secundario }}>{TITULO_GRUPO[i.grupo]}</Texto>
                )}
                <Pressable
                  testID={`por-pagar-${i.item.nombre}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Marcar ${i.item.nombre} como pagado`}
                  onPress={() => router.push(`/agregar?tipo=${i.item.tipo === 'VARIABLE' ? 'gasto' : 'pago'}&item=${i.item.id}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: bloque(i).backgroundColor }}>
                    <Texto style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 16, color: bloque(i).color }}>{diaDelBloque(i)}</Texto>
                    {diaDelBloque(i) !== '—' && <Texto style={{ fontSize: 10, lineHeight: 11, color: bloque(i).color }}>{mesCorto}</Texto>}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Texto style={{ fontFamily: fonts.medium }}>{i.item.nombre}</Texto>
                    <Texto v="detalle" style={i.vencido ? { color: colors.negativo, fontFamily: fonts.semibold } : undefined}>{i.detalle}</Texto>
                  </View>
                  <Monto valor={i.pendiente} style={{ fontFamily: fonts.semibold, fontSize: 15 }} />
                  {i.item.enlacePago && (
                    // Datos de pago (gastos-datos-pago): abre el portal sin marcar el pago.
                    <Pressable testID={`pagar-enlace-${i.item.nombre}`} accessibilityRole="link" accessibilityLabel={`Pagar ${i.item.nombre} en línea`} hitSlop={8} onPress={() => void Linking.openURL(i.item.enlacePago!)}>
                      <Texto style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.acento }}>Pagar ↗</Texto>
                    </Pressable>
                  )}
                  <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#D6D3CB', alignItems: 'center', justifyContent: 'center' }}>
                    <Icono nombre="check" color="#8A8D85" tamano={18} />
                  </View>
                </Pressable>
              </View>
            ))}
            {ocultos.length > 0 && (
              <Pressable
                testID="ver-mas"
                accessibilityRole="button"
                onPress={() => setVerTodo(true)}
                style={{ minHeight: 44, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.divisor }}
              >
                <Texto style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.acento }}>{`Ver ${ocultos.length} más · ${r.porPagar.length} pendientes en total`}</Texto>
                <Monto valor={sumar(ocultos.map((i) => i.pendiente))} style={{ fontSize: 13, color: colors.secundario }} />
              </Pressable>
            )}
          </Tarjeta>

          <Tarjeta style={{ paddingVertical: 6, gap: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <Texto v="subtitulo" accessibilityRole="header">Entró este mes</Texto>
              <Boton tipo="texto" titulo="+ Aporte" onPress={() => router.push('/agregar?tipo=aporte')} />
            </View>
            {r.ingresos.map((l, i) => {
              // Lo recibido y los aportes se abren para corregirlos o borrarlos.
              const abrir = l.movimientoId ? () => router.push(`/registro/${l.movimientoId}`) : l.tipo === 'APORTES' ? () => router.push(`/registros?aportes=${l.usuarioId}`) : undefined;
              return (
                <Fila key={l.clave} titulo={l.nombre} detalle={l.detalle} ultima={i === r.ingresos.length - 1} onPress={abrir}>
                  {porRecibir(l) && <Boton tipo="texto" titulo="Recibí" onPress={() => router.push(`/recibir/${l.clave}`)} />}
                  <Monto valor={l.monto} style={{ fontFamily: fonts.semibold, color: porRecibir(l) ? colors.secundario : colors.positivo }} />
                </Fila>
              );
            })}
          </Tarjeta>

          {(r.yaPagado.length > 0 || r.noPlaneados.length > 0) && (
            <Tarjeta style={{ paddingVertical: 4, gap: 0 }}>
              <Pressable testID="ya-pagado-titulo" accessibilityRole="button" accessibilityState={{ expanded: pagadosAbiertos }} onPress={() => setPagadosAbiertos(!pagadosAbiertos)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Texto v="subtitulo" accessibilityRole="header">{`Ya pagado · ${r.yaPagado.length + r.noPlaneados.length}`}</Texto>
                <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.acento }}>{pagadosAbiertos ? 'Ocultar' : 'Ver'}</Texto>
              </Pressable>
              {pagadosAbiertos && r.yaPagado.map((i) => (
                <Fila key={i.item.id} testID={`pagado-${i.item.nombre}`} titulo={i.item.nombre} detalle={i.detalle} onPress={() => router.push(i.pagos.length === 1 ? `/registro/${i.pagos[0]!.id}` : `/registros?item=${i.item.id}`)}>
                  <Monto valor={i.real} style={{ color: colors.textoSuave }} />
                  <Avatar inicial={m.inicialDe(i.pagadoPor)} variante={m.varianteDe(i.pagadoPor)} tamano={30} nombre={`Pagó ${m.nombreDe(i.pagadoPor)}`} />
                </Fila>
              ))}
              {pagadosAbiertos && r.noPlaneados.map((g) => (
                <Fila key={g.id} titulo={g.nota || 'Gasto'} detalle="No estaba planeado" onPress={g.tipo === 'GASTO' ? () => router.push(`/registro/${g.id}`) : undefined}>
                  <Monto valor={g.monto} style={{ color: colors.textoSuave }} />
                  <Avatar inicial={m.inicialDe(g.usuarioId)} variante={m.varianteDe(g.usuarioId)} tamano={30} nombre={`Pagó ${m.nombreDe(g.usuarioId)}`} />
                </Fila>
              ))}
            </Tarjeta>
          )}
        </>
      )}
    </Pantalla>
  );
}
