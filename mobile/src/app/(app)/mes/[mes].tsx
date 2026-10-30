import { claveMes, formatCop, formatMesAnio, nombreMesCapital, parseClaveMes, sumarMeses, type Id, type ModoNuevoMes, type VistaOpcion } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useAccion, useConsulta } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, colors, Encabezado, fonts, Kpi, Monto, MontoInput, Pantalla, Segmentado, Texto } from '@/ui';

/**
 * Un mes en Planear. Sin plan: MesVacio.dc.html. Borrador: Planear.dc.html (opciones, lo que dejaria libre,
 * ingresos y gastos por categoria, con el diezmo como categoria). Activo o cerrado: el plan elegido en solo lectura.
 */
export default function Mes() {
  const { mes } = useLocalSearchParams<{ mes: string }>();
  const ref = parseClaveMes(mes)!;
  const { sesion } = useSesion();
  const vista = useConsulta(['mes', mes], (p) => p.plan.mes(ref));
  const trae = useConsulta(['trae', mes], (p) => p.plan.loQueTrae(ref));
  const anterior = useConsulta(['mes', claveMes(sumarMeses(ref, -1))], (p) => p.plan.mes(sumarMeses(ref, -1)));
  const categorias = useConsulta(['categorias'], (p) => p.hogar.categorias());
  const accion = useAccion();
  const [elegida, setElegida] = useState<Id | null>(null);
  const [abierta, setAbierta] = useState<Id | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [categoriaNueva, setCategoriaNueva] = useState<string | null>(null);

  const v = vista.data;
  if (!v) return <Pantalla><Texto v="pequeno">Cargando…</Texto></Pantalla>;
  const titulo = formatMesAnio(ref);
  const o: VistaOpcion | undefined = v.opciones.find((x) => x.escenario.id === elegida) ?? v.opciones[0];

  if (v.estado === 'SIN_PLAN') {
    const base = anterior.data?.opciones[0];
    const formas: { modo: ModoNuevoMes; titulo: string; detalle: string }[] = [
      { modo: 'COPIAR', titulo: `Copiar ${nombreMesCapital(sumarMeses(ref, -1).mes).toLowerCase()}`, detalle: base ? `Opción ${base.escenario.letra} · gastos ${formatCop(base.totalGastos)}` : 'El mes anterior no tiene plan: empieza vacío' },
      { modo: 'FIJOS', titulo: 'Solo fijos e ingresos', detalle: 'Salario, fijos, tarjetas y créditos. Variables en blanco.' },
      { modo: 'CERO', titulo: 'Empezar desde cero', detalle: 'Solo el salario y el diezmo calculado' },
    ];
    return (
      <Pantalla>
        <Encabezado titulo={titulo} volver="/planear" volverTexto="Planear" />
        <Texto style={{ fontSize: 15, lineHeight: 22, color: colors.secundario }}>Aún no tiene plan. Empieza desde algo que ya existe y ajusta lo que cambie.</Texto>
        {formas.map((f, i) => (
          <Pressable key={f.modo} accessibilityRole="button" onPress={() => accion.ejecutar((p) => p.plan.crearMes(ref, f.modo))}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 14, borderWidth: i === 0 ? 2 : 1, borderColor: i === 0 ? colors.acento : colors.bordeCampo, backgroundColor: i === 0 ? colors.acentoSuave : colors.superficie }}>
            <View style={{ flexShrink: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.texto }}>{f.titulo}</Text>
              <Texto v="pequeno">{f.detalle}</Texto>
            </View>
            <Texto style={{ fontSize: 18, color: i === 0 ? colors.acento : colors.secundario }}>›</Texto>
          </Pressable>
        ))}
        {trae.data && trae.data.length > 0 && (
          <View testID="ya-trae" style={{ gap: 10, padding: 16, borderRadius: 14, backgroundColor: colors.destacado }}>
            <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: '#6B4A00' }}>{nombreMesCapital(ref.mes)} ya trae</Texto>
            {trae.data.map((l) => (
              <View key={l.nombre} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Texto style={{ fontSize: 14 }}>{l.nombre}</Texto>
                {l.monto === null ? <Texto v="pequeno">{l.detalle}</Texto> : <Monto valor={Math.abs(l.monto)} signo={l.monto > 0} />}
              </View>
            ))}
            <Texto style={{ fontSize: 12, color: '#6B4A00' }}>Se suman a cualquier opción que elijas.</Texto>
          </View>
        )}
        <Aviso texto={accion.error} />
      </Pantalla>
    );
  }

  const editable = v.estado === 'BORRADOR';
  return (
    <Pantalla>
      <Encabezado titulo={titulo} rotulo={editable ? 'Borrador' : v.estado === 'ACTIVO' ? 'Activo' : 'Cerrado'} rotuloColor={editable ? colors.aviso : undefined} volver="/planear" volverTexto="Planear">
        <Boton tipo="texto" titulo="Ver año" onPress={() => router.push(`/anual/${ref.anio}`)} />
      </Encabezado>

      {editable && (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {v.opciones.map((x) => {
            const activa = x.escenario.id === o?.escenario.id;
            return (
              <Pressable key={x.escenario.id} accessibilityRole="tab" accessibilityState={{ selected: activa }} onPress={() => setElegida(x.escenario.id)}
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: activa ? colors.acento : colors.superficie, borderWidth: activa ? 0 : 1, borderColor: colors.borde }}>
                <Text style={{ fontFamily: activa ? fonts.semibold : fonts.regular, fontSize: 14, color: activa ? '#FFFFFF' : colors.texto }}>
                  Opción {x.escenario.letra}{x.escenario.creadoPor !== sesion?.usuario.id ? ` · ${x.inicialAutor}` : ''}
                </Text>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" onPress={() => o && v.plan && accion.ejecutar(async (p) => setElegida(await p.plan.duplicar(v.plan!.id, o.escenario.id)))}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.control }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textoSuave }}>+ Duplicar</Text>
          </Pressable>
        </View>
      )}

      {o && (
        <>
          <View style={{ gap: 12, padding: 18, borderRadius: 16, backgroundColor: colors.superficie, borderWidth: 1, borderStyle: editable ? 'dashed' : 'solid', borderColor: editable ? colors.control : colors.borde }}>
            <Texto v="rotulo">{editable ? `Opción ${o.escenario.letra} dejaría libre` : `Opción ${o.escenario.letra} · el plan del mes`}</Texto>
            <Monto testID="dejaria-libre" valor={o.libre} style={{ fontSize: 30, fontFamily: fonts.monoSemibold, color: o.libre < 0 ? colors.negativo : colors.textoSuave }} />
            <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.divisor, paddingTop: 12 }}>
              <Kpi etiqueta="Ingresos" valor={o.totalIngresos} />
              <Kpi etiqueta="Gastos" valor={o.totalGastos} />
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Texto v="subtitulo" accessibilityRole="header">Ingresos</Texto>
            {o.ingresos.map((l) => (
              <View key={l.clave} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
                <View style={{ gap: 2 }}><Texto style={l.tenue ? { color: colors.secundario, fontStyle: 'italic' } : undefined}>{l.nombre}</Texto><Texto v="detalle">{l.detalle}</Texto></View>
                <Monto valor={l.monto} />
              </View>
            ))}
          </View>

          <View style={{ gap: 4 }}>
            <Texto v="subtitulo" accessibilityRole="header">Gastos</Texto>
            {o.grupos.map((g) => (
              <View key={g.categoriaId}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: abierta === g.categoriaId }} onPress={() => setAbierta(abierta === g.categoriaId ? null : g.categoriaId)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: g.color }} />
                    <Texto>{g.nombre}</Texto>
                  </View>
                  <Monto valor={g.total} />
                </Pressable>
                {abierta === g.categoriaId && (
                  <View style={{ gap: 8, padding: 12, marginVertical: 8, borderRadius: 12, backgroundColor: colors.nota }}>
                    {g.items.map((it) => (
                      <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Texto numberOfLines={1} style={{ flexShrink: 1, fontSize: 14 }}>{it.nombre}</Texto>
                        {editable ? (
                          <View style={{ width: 150 }}>
                            <MontoInput etiqueta={`Monto de ${it.nombre}`} valor={it.monto} onCambio={(m) => m !== null && m !== it.monto && v.plan && accion.ejecutar((p) => p.plan.guardarItem(v.plan!.id, o.escenario.id, { ...it, monto: m }))} />
                          </View>
                        ) : (
                          <Monto valor={it.monto} />
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
            {editable && (
              <View style={{ gap: 8, padding: 12, marginTop: 8, borderRadius: 12, backgroundColor: colors.nota }}>
                <Segmentado chips etiqueta="Agregar un gasto en" opciones={(categorias.data ?? []).map((c) => ({ valor: c.id, etiqueta: c.nombre }))} valor={categoriaNueva ?? categorias.data?.[0]?.id ?? null} onCambio={setCategoriaNueva} />
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput accessibilityLabel="Nombre del gasto" placeholder="Nuevo gasto" value={nuevo} onChangeText={setNuevo} placeholderTextColor={colors.secundario}
                    style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.borde, backgroundColor: colors.superficie, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14 }} />
                  <Boton tipo="texto" titulo="+ Agregar" deshabilitado={!nuevo.trim()} onPress={() => {
                    const c = categorias.data?.find((x) => x.id === (categoriaNueva ?? categorias.data?.[0]?.id));
                    if (!c || !v.plan) return;
                    const tipo = c.tipo === 'VARIABLE' ? 'VARIABLE' : c.tipo === 'CREDITO' ? 'CREDITO' : c.tipo === 'DIEZMO' ? 'DIEZMO' : 'FIJO';
                    accion.ejecutar((p) => p.plan.guardarItem(v.plan!.id, o.escenario.id, { categoriaId: c.id, nombre: nuevo, monto: 0, diaVence: null, tipo, cuota: null, creditoId: null, ingresoFijoId: null, aporteId: null })).then(() => { setNuevo(''); setAbierta(c.id); });
                  }} />
                </View>
              </View>
            )}
          </View>
        </>
      )}

      <Aviso texto={accion.error} />
      {editable && o ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Boton tipo="secundario" titulo="Comparar" onPress={() => router.push(`/comparar/${mes}`)} style={{ flex: 1 }} />
          <Boton titulo={`Usar opción ${o.escenario.letra}`} onPress={() => accion.ejecutar((p) => p.plan.usar(v.plan!.id, o.escenario.id)).then((ok) => ok && router.navigate('/planear'))} style={{ flex: 1 }} />
        </View>
      ) : (
        <Boton titulo={v.estado === 'ACTIVO' ? 'Cierre de mes' : 'Ver cierre'} onPress={() => router.push(`/cierre/${mes}`)} />
      )}
    </Pantalla>
  );
}
