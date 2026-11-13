import { formatDiaSemana, formatMesAnio, claveMes, sumar, type ItemEjecucion, type LineaIngreso } from '@steward/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMesDeHoy } from '@/data/mes-de-hoy';
import { useMiembros } from '@/data/miembros';
import { useConsulta, usePuertos } from '@/data/puertos';
import { Avatar, Boton, colors, Encabezado, Fila, fonts, Kpi, Monto, Pantalla, Segmentado, Tarjeta, Texto } from '@/ui';

/** Pendientes que se ven antes de "Ver N más" (spec steward-hoy). */
const LISTA_CORTA = 3;

/**
 * Main.dc.html: el mes elegido, el en curso o el siguiente (spec steward-hoy). Las hojas se abren encima (formSheet). El
 * diezmo es un item del plan, sin tarjeta aparte, y lo registrado se abre para corregirlo o borrarlo.
 */
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
  const urgente = (i: ItemEjecucion) => i.vencido || i.vence.tono !== 'normal';

  return (
    <Pantalla>
      <Encabezado rotulo={`Ejecución · ${formatDiaSemana(hoy)}`} titulo={formatMesAnio(ref)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ajustes del hogar" onPress={() => router.push('/ajustes')} style={{ flexDirection: 'row', paddingVertical: 6 }}>
          {m.miembros.map((x, i) => (
            <Avatar key={x.usuario.id} inicial={x.usuario.inicial} variante={x.variante} style={i ? { marginLeft: -10, borderWidth: 2, borderColor: colors.fondo } : undefined} />
          ))}
        </Pressable>
      </Encabezado>

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

          <Tarjeta style={{ gap: 14 }}>
            <Texto v="rotulo">Te queda libre</Texto>
            <Monto testID="libre" valor={r.libre} style={{ fontSize: 32, fontFamily: fonts.monoSemibold, color: r.libre >= 0 ? colors.acento : colors.negativo }} />
            <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.divisor, paddingTop: 12 }}>
              <Kpi testID="falta-pagar" etiqueta="Falta pagar" valor={r.faltaPagar} enfasis color={r.faltaPagar > 0 ? colors.negativo : undefined} />
              <Kpi etiqueta="Pagado" valor={r.pagado} />
              <Kpi etiqueta="Vs. plan" valor={r.vsPlan} color={r.vsPlan <= 0 ? colors.positivo : colors.negativo} />
            </View>
          </Tarjeta>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Texto v="subtitulo" accessibilityRole="header">Ingresos</Texto>
              <Boton tipo="texto" titulo="+ Aporte" onPress={() => router.push('/aporte')} />
            </View>
            {r.ingresos.map((l, i) => {
              // Lo recibido y los aportes se abren para corregirlos o borrarlos.
              const abrir = l.movimientoId ? () => router.push(`/registro/${l.movimientoId}`) : l.tipo === 'APORTES' ? () => router.push(`/registros?aportes=${l.usuarioId}`) : undefined;
              return (
                <Fila key={l.clave} titulo={l.nombre} detalle={l.detalle} ultima={i === r.ingresos.length - 1} onPress={abrir}>
                  {porRecibir(l) && <Boton tipo="texto" titulo="Recibí" onPress={() => router.push(`/recibir/${l.clave}`)} />}
                  <Monto valor={l.monto} style={{ color: porRecibir(l) ? colors.secundario : colors.positivo }} />
                </Fila>
              );
            })}
          </View>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Texto v="subtitulo" accessibilityRole="header">Por pagar</Texto>
                {r.faltaPagar > 0 && <Monto testID="por-pagar-total" valor={r.faltaPagar} style={{ fontFamily: fonts.monoSemibold, color: colors.negativo }} />}
              </View>
              <Boton tipo="texto" titulo="+ Gasto" onPress={() => router.push('/gasto')} />
            </View>
            {r.porPagar.length === 0 && <Texto v="pequeno">Nada pendiente. Todo el plan del mes está pagado.</Texto>}
            {visibles.map((i, k) => (
              <Fila
                key={i.item.id}
                testID={`por-pagar-${i.item.nombre}`}
                titulo={i.item.nombre}
                detalle={i.detalle}
                tonoDetalle={urgente(i) ? colors.negativo : undefined}
                ultima={k === visibles.length - 1 && ocultos.length === 0}
                onPress={() => router.push(i.item.tipo === 'VARIABLE' ? `/gasto?item=${i.item.id}` : `/pagar/${i.item.id}`)}
              >
                <Monto valor={i.pendiente} />
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.control }} />
              </Fila>
            ))}
            {ocultos.length > 0 && (
              <Pressable
                testID="ver-mas"
                accessibilityRole="button"
                onPress={() => setVerTodo(true)}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.divisor }}
              >
                <Texto style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.acento }}>{`Ver ${ocultos.length} más · ${r.porPagar.length} pendientes en total`}</Texto>
                <Monto valor={sumar(ocultos.map((i) => i.pendiente))} style={{ fontSize: 13, color: colors.secundario }} />
              </Pressable>
            )}
          </View>

          {(r.yaPagado.length > 0 || r.noPlaneados.length > 0) && (
            <View style={{ gap: 6 }}>
              <Texto v="subtitulo" accessibilityRole="header">Ya pagado</Texto>
              {r.yaPagado.map((i) => (
                <Fila key={i.item.id} testID={`pagado-${i.item.nombre}`} titulo={i.item.nombre} detalle={i.detalle} onPress={() => router.push(i.pagos.length === 1 ? `/registro/${i.pagos[0]!.id}` : `/registros?item=${i.item.id}`)}>
                  <Monto valor={i.real} />
                  <Avatar inicial={m.inicialDe(i.pagadoPor)} variante={m.varianteDe(i.pagadoPor)} tamano={24} nombre={`Pagó ${m.nombreDe(i.pagadoPor)}`} />
                </Fila>
              ))}
              {r.noPlaneados.map((g) => (
                <Fila key={g.id} titulo={g.nota || 'Gasto'} detalle="No estaba planeado" onPress={g.tipo === 'GASTO' ? () => router.push(`/registro/${g.id}`) : undefined}>
                  <Monto valor={g.monto} />
                  <Avatar inicial={m.inicialDe(g.usuarioId)} variante={m.varianteDe(g.usuarioId)} tamano={24} nombre={`Pagó ${m.nombreDe(g.usuarioId)}`} />
                </Fila>
              ))}
            </View>
          )}
        </>
      )}
    </Pantalla>
  );
}
