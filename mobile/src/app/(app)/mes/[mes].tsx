import { claveMes, formatCop, formatMesAnio, nombreMes, nombreMesCapital, parseClaveMes, sumarMeses, type ConteoBorrado, type Id, type IngresoPlan, type ItemPlan, type ModoNuevoMes, type VistaOpcion } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GastoPlanHoja, HojaPlan, IngresoHoja } from '@/components/hojas-plan';
import { useMesDeHoy } from '@/data/mes-de-hoy';
import { useAccion, useConsulta } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, colors, Encabezado, fonts, Kpi, Monto, Pantalla, Texto } from '@/ui';

/**
 * Un mes en Plan. Sin plan: MesVacio.dc.html. Borrador: opciones, lo que dejaria libre, ingresos y gastos por categoria,
 * que se editan en hojas con "Guardar". Activo: el plan elegido, editable con las mismas hojas. Cerrado: solo lectura.
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
  const [hojaIngreso, setHojaIngreso] = useState<{ linea: IngresoPlan | null } | null>(null);
  const [hojaGasto, setHojaGasto] = useState<{ item: ItemPlan | null } | null>(null);
  const [aviso, setAviso] = useState(false);
  const [conteo, setConteo] = useState<ConteoBorrado | null>(null);
  const [seguro, setSeguro] = useState(false);
  const [quitandoOpcion, setQuitandoOpcion] = useState(false);
  const cierre = useConsulta(['cierre', mes], (p) => p.cierre.vista(ref).then((x) => x.cerrado).catch(() => false));
  const mesHoy = useMesDeHoy();
  const nombre = nombreMes(ref.mes);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), 2500);
    return () => clearTimeout(t);
  }, [aviso]);

  const guardado = () => {
    setHojaIngreso(null);
    setHojaGasto(null);
    setAviso(true);
  };
  const conRegistros = (c: ConteoBorrado) => c.pagos + c.gastos + c.ingresos > 0;
  const queSeBorra = (c: ConteoBorrado) => {
    const contar = (n: number, uno: string, varios: string) => (n ? [`${n} ${n === 1 ? uno : varios}`] : []);
    const partes = [...contar(c.pagos, 'pago', 'pagos'), ...contar(c.gastos, 'gasto', 'gastos'), ...contar(c.ingresos, 'ingreso recibido', 'ingresos recibidos')];
    const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0];
    const suCierre = c.cerrado ? ' y su cierre' : '';
    return lista ? `Se borran ${lista} de ${nombre}${suCierre}; los aportes se conservan.` : `Se borra el plan de ${nombre}${suCierre}. No tiene pagos ni gastos registrados.`;
  };
  const abrirBorrar = () => {
    setSeguro(false);
    void accion.ejecutar(async (p) => setConteo(await p.plan.conteoBorrado(ref)));
  };
  const borrarPlan = () => {
    void accion.ejecutar(async (p) => {
      await p.plan.borrarPlan(ref);
      setConteo(null);
      setElegida(null);
    });
  };
  const verEjecucion = () => {
    mesHoy.elegir(claveMes(ref));
    router.navigate('/hoy');
  };
  const hojaBorrar = conteo && (
    <HojaPlan titulo={`¿Borrar el plan de ${nombre}?`} onCerrar={() => setConteo(null)}>
      <Texto testID="que-se-borra" style={{ fontSize: 15, color: colors.secundario }}>{queSeBorra(conteo)}</Texto>
      <Aviso texto={accion.error} />
      {conRegistros(conteo) && !seguro ? (
        <Boton tipo="peligro" titulo="Continuar" onPress={() => setSeguro(true)} />
      ) : (
        <Boton tipo="peligro" titulo={conRegistros(conteo) ? 'Sí, borrar el plan y sus registros' : 'Borrar plan'} deshabilitado={accion.ocupado} onPress={borrarPlan} />
      )}
    </HojaPlan>
  );
  const botonBorrar = <Boton tipo="enlace" titulo={`Borrar plan de ${nombre}`} onPress={abrirBorrar} />;

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
        <Encabezado titulo={titulo} volver="/planear" volverTexto="Plan" />
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
        {cierre.data ? botonBorrar : null}
        {hojaBorrar}
      </Pantalla>
    );
  }

  const borrador = v.estado === 'BORRADOR';
  const editable = v.estado !== 'CERRADO';
  const negativo = (o?.libre ?? 0) < 0;
  return (
    <Pantalla>
      <Encabezado titulo={titulo} rotulo={borrador ? 'Borrador' : v.estado === 'ACTIVO' ? 'Activo' : 'Cerrado'} rotuloColor={borrador ? colors.aviso : undefined} volver="/planear" volverTexto="Plan">
        <Boton tipo="texto" titulo="Ver año" onPress={() => router.push(`/anual/${ref.anio}`)} />
      </Encabezado>

      {aviso && <Texto testID="guardado" accessibilityRole="alert" style={{ borderRadius: 12, backgroundColor: colors.acentoSuave, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.acento }}>Guardado</Texto>}

      {borrador && (
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
            <Texto v="rotulo">{!borrador ? `Opción ${o.escenario.letra} · el plan del mes` : negativo ? `Con la Opción ${o.escenario.letra} faltarían` : `Opción ${o.escenario.letra} dejaría libre`}</Texto>
            <Monto testID="dejaria-libre" valor={negativo ? -o.libre : o.libre} style={{ fontSize: 30, fontFamily: fonts.monoSemibold, color: negativo ? colors.negativo : colors.textoSuave }} />
            <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.divisor, paddingTop: 12 }}>
              <Kpi etiqueta="Ingresos" valor={o.totalIngresos} />
              <Kpi etiqueta="Gastos" valor={o.totalGastos} />
            </View>
            {borrador && v.opciones.length > 1 && o.escenario.id !== v.plan?.escenarioActivoId && <Boton tipo="enlace" titulo="Quitar opción" onPress={() => setQuitandoOpcion(true)} />}
          </View>

          <View style={{ gap: 4 }}>
            <Texto v="subtitulo" accessibilityRole="header">Ingresos</Texto>
            {o.ingresos.map((l) => {
              const linea = editable ? o.escenario.ingresos.find((x) => x.id === l.lineaId) : undefined;
              return (
                <Pressable key={l.clave} testID={linea ? 'linea-ingreso' : undefined} disabled={!linea} accessibilityRole={linea ? 'button' : undefined} onPress={() => linea && setHojaIngreso({ linea })}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
                  <View style={{ flexShrink: 1, gap: 2 }}><Texto style={l.tenue ? { color: colors.secundario, fontStyle: 'italic' } : undefined}>{l.nombre}</Texto><Texto v="detalle">{l.detalle}</Texto></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Monto valor={l.monto} />{linea ? <Texto style={{ color: colors.secundario }}>›</Texto> : null}</View>
                </Pressable>
              );
            })}
            {editable && <Boton tipo="texto" titulo="+ Ingreso" onPress={() => setHojaIngreso({ linea: null })} />}
          </View>

          <View style={{ gap: 4 }}>
            <Texto v="subtitulo" accessibilityRole="header">Gastos</Texto>
            {o.grupos.map((g) => (
              <View key={g.categoriaId}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: abierta === g.categoriaId }} onPress={() => setAbierta(abierta === g.categoriaId ? null : g.categoriaId)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: g.color }} />
                    <Texto>{g.nombre} <Texto v="detalle">· {g.items.length}</Texto></Texto>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Monto valor={g.total} />
                    <Texto style={{ width: 12, textAlign: 'center', color: colors.secundario }}>{abierta === g.categoriaId ? '⌄' : '›'}</Texto>
                  </View>
                </Pressable>
                {abierta === g.categoriaId && (
                  <View style={{ gap: 8, padding: 12, marginVertical: 8, borderRadius: 12, backgroundColor: colors.nota }}>
                    {g.items.map((it) => (
                      <Pressable key={it.id} disabled={!editable} accessibilityRole={editable ? 'button' : undefined} onPress={() => setHojaGasto({ item: it })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 32 }}>
                        <Texto numberOfLines={1} style={{ flexShrink: 1, fontSize: 14 }}>{it.nombre}{it.ajustadoAMano ? <Texto v="detalle"> · ajustado a mano</Texto> : null}</Texto>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Monto valor={it.monto} />{editable ? <Texto style={{ color: colors.secundario }}>›</Texto> : null}</View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
            {editable && <Boton tipo="texto" titulo="+ Gasto" onPress={() => setHojaGasto({ item: null })} />}
          </View>
        </>
      )}

      <Aviso texto={accion.error} />
      {borrador && o && mesHoy.seEjecuta(ref) ? <Boton tipo="texto" titulo="Ver en Ejecución" onPress={verEjecucion} /> : null}
      {borrador && o ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Boton tipo="secundario" titulo="Comparar" onPress={() => router.push(`/comparar/${mes}`)} style={{ flex: 1 }} />
          <Boton titulo={`Usar opción ${o.escenario.letra}`} onPress={() => accion.ejecutar((p) => p.plan.usar(v.plan!.id, o.escenario.id)).then((ok) => ok && router.navigate('/planear'))} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {v.estado === 'ACTIVO' && <Boton tipo="secundario" titulo="Ver ejecución" onPress={verEjecucion} style={{ flex: 1 }} />}
          <Boton titulo={v.estado === 'ACTIVO' ? 'Cierre de mes' : 'Ver cierre'} onPress={() => router.push(`/cierre/${mes}`)} style={{ flex: 1 }} />
        </View>
      )}
      {botonBorrar}
      {hojaBorrar}
      {o && v.plan && quitandoOpcion && (
        <HojaPlan titulo={`¿Quitar la Opción ${o.escenario.letra}?`} onCerrar={() => setQuitandoOpcion(false)}>
          <Texto style={{ fontSize: 15, color: colors.secundario }}>Se borran sus gastos. Las demás opciones no cambian.</Texto>
          <Aviso texto={accion.error} />
          <Boton tipo="peligro" titulo={`Quitar opción ${o.escenario.letra}`} deshabilitado={accion.ocupado}
            onPress={() => accion.ejecutar(async (p) => { await p.plan.quitarOpcion(v.plan!.id, o.escenario.id); setElegida(null); setQuitandoOpcion(false); })} />
        </HojaPlan>
      )}
      {o && v.plan && hojaIngreso && (
        <IngresoHoja planId={v.plan.id} escenarioId={o.escenario.id} letra={o.escenario.letra} linea={hojaIngreso.linea} onCerrar={() => setHojaIngreso(null)} onGuardado={guardado} />
      )}
      {o && v.plan && hojaGasto && (
        <GastoPlanHoja
          planId={v.plan.id} escenarioId={o.escenario.id} letra={o.escenario.letra} item={hojaGasto.item}
          categorias={[...(categorias.data ?? []).filter((c) => c.tipo !== 'DIEZMO'), ...(categorias.data ?? []).filter((c) => c.tipo === 'DIEZMO')]}
          lineas={o.escenario.ingresos} onCerrar={() => setHojaGasto(null)} onGuardado={guardado}
        />
      )}
    </Pantalla>
  );
}
