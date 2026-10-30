import { formatDiaSemana, formatMesAnio, mesDe, claveMes, type ItemEjecucion, type LineaIngreso } from '@steward/domain';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { Avatar, Aviso, Boton, colors, Encabezado, Fila, fonts, Kpi, Monto, Pantalla, Tarjeta, Texto } from '@/ui';

/**
 * Main.dc.html: el mes en curso (spec steward-hoy). Las hojas de registro se abren encima (formSheet). El diezmo es un
 * item del plan, sin tarjeta aparte (diezmo-como-gasto); conectar esta app y "Recibí" con monto llegan en la Etapa 11.
 */
export default function Hoy() {
  const puertos = usePuertos();
  const hoy = puertos.hoy();
  const ref = mesDe(hoy);
  const resumen = useConsulta(['resumen', ref], (p) => p.movimientos.resumenMes(ref));
  const m = useMiembros();
  const accion = useAccion();
  const r = resumen.data;

  const porRecibir = (l: LineaIngreso) => !l.recibido && Boolean(l.lineaId || l.ingresoFijoId);
  const urgente = (i: ItemEjecucion) => /^Vence (en|hoy)|^Venció/.test(i.detalle);

  return (
    <Pantalla>
      <Encabezado rotulo={`Hoy · ${formatDiaSemana(hoy)}`} titulo={formatMesAnio(ref)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ajustes del hogar" onPress={() => router.push('/ajustes')} style={{ flexDirection: 'row', paddingVertical: 6 }}>
          {m.miembros.map((x, i) => (
            <Avatar key={x.usuario.id} inicial={x.usuario.inicial} variante={x.variante} style={i ? { marginLeft: -10, borderWidth: 2, borderColor: colors.fondo } : undefined} />
          ))}
        </Pressable>
      </Encabezado>

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
              <Kpi etiqueta="Plan" valor={r.plan} />
              <Kpi etiqueta="Pagado" valor={r.pagado} />
              <Kpi etiqueta="Vs. plan" valor={r.vsPlan} color={r.vsPlan <= 0 ? colors.positivo : colors.negativo} />
            </View>
          </Tarjeta>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Texto v="subtitulo" accessibilityRole="header">Ingresos</Texto>
              <Boton tipo="texto" titulo="+ Aporte" onPress={() => router.push('/aporte')} />
            </View>
            {r.ingresos.map((l, i) => (
              <Fila key={l.clave} titulo={l.nombre} detalle={l.detalle} ultima={i === r.ingresos.length - 1}>
                {porRecibir(l) && (
                  <Boton tipo="texto" titulo="Recibí" onPress={() => accion.ejecutar((p) => p.ingresos.marcarRecibido(l.lineaId ? { ref, lineaId: l.lineaId } : { ref, ingresoFijoId: l.ingresoFijoId! }))} />
                )}
                <Monto valor={l.monto} style={{ color: porRecibir(l) ? colors.secundario : colors.positivo }} />
              </Fila>
            ))}
          </View>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Texto v="subtitulo" accessibilityRole="header">Por pagar</Texto>
              <Boton tipo="texto" titulo="+ Gasto" onPress={() => router.push('/gasto')} />
            </View>
            {r.porPagar.length === 0 && <Texto v="pequeno">Nada pendiente. Todo el plan del mes está pagado.</Texto>}
            {r.porPagar.map((i, k) => (
              <Fila
                key={i.item.id}
                testID={`por-pagar-${i.item.nombre}`}
                titulo={i.item.nombre}
                detalle={i.detalle}
                tonoDetalle={urgente(i) ? colors.negativo : undefined}
                ultima={k === r.porPagar.length - 1}
                onPress={() => router.push(i.item.tipo === 'VARIABLE' ? `/gasto?item=${i.item.id}` : `/pagar/${i.item.id}`)}
              >
                <Monto valor={i.pendiente} />
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.control }} />
              </Fila>
            ))}
          </View>

          {(r.yaPagado.length > 0 || r.noPlaneados.length > 0) && (
            <View style={{ gap: 6 }}>
              <Texto v="subtitulo" accessibilityRole="header">Ya pagado</Texto>
              {r.yaPagado.map((i) => (
                <Fila key={i.item.id} testID={`pagado-${i.item.nombre}`} titulo={i.item.nombre} detalle={i.detalle}>
                  <Monto valor={i.real} />
                  <Avatar inicial={m.inicialDe(i.pagadoPor)} variante={m.varianteDe(i.pagadoPor)} tamano={24} nombre={`Pagó ${m.nombreDe(i.pagadoPor)}`} />
                </Fila>
              ))}
              {r.noPlaneados.map((g) => (
                <Fila key={g.id} titulo={g.nota || 'Gasto'} detalle="No estaba planeado">
                  <Monto valor={g.monto} />
                  <Avatar inicial={m.inicialDe(g.usuarioId)} variante={m.varianteDe(g.usuarioId)} tamano={24} nombre={`Pagó ${m.nombreDe(g.usuarioId)}`} />
                </Fila>
              ))}
            </View>
          )}
          <Aviso texto={accion.error} />
        </>
      )}
    </Pantalla>
  );
}
