import {
  claveMes, formatCop, formatMesAnio, mesDe, nombreMes, nombreMesCapital, nombreMeses, rangoEvento,
  type BaseAnual, type Categoria, type DatosEvento, type EventoAnual, type Id, type MesDesdeAnual, type TipoEvento, type VistaCambio,
} from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { HojaPlan } from '@/components/hojas-plan';
import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { Aviso, Boton, Campo, colors, Encabezado, fonts, Monto, MontoInput, Pantalla, Segmentado, Texto } from '@/ui';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Planear el año desde un mes (spec steward-planear, "Plan anual"; AnualBaseMovil, AnualMesesMovil y AnualCambioMovil del
 * canvas). Paso 1: el mes base y "Replicar en los 12 meses". Paso 2: la lista de los 12 meses y lo que cambia. Con
 * opciones A, B, ... (AnualOpcionesMovil y AnualActualizarMovil, anual-opciones-y-meses): chips, "vs A" y la hoja de meses.
 */
export default function Anual() {
  const { anio, paso, opcion } = useLocalSearchParams<{ anio: string; paso?: string; opcion?: string }>();
  const r = useConsulta(['anual', anio], (p) => p.plan.anual(Number(anio)));
  if (paso === 'base' || (!r.isLoading && !r.data)) return <PasoBase anio={Number(anio)} conPlan={Boolean(r.data)} tieneMontos={Boolean(r.data?.gastos.some((f) => f.valores.some((v) => v > 0)))} />;
  if (!r.data) return <Pantalla><Encabezado titulo={`Plan ${anio}`} volver="/planear" volverTexto="Plan" /><Texto v="pequeno">Cargando…</Texto></Pantalla>;
  return <LoQueCambia anio={Number(anio)} letra={opcion ?? null} />;
}

function PasoBase({ anio, conPlan, tieneMontos }: { anio: number; conPlan: boolean; tieneMontos: boolean }) {
  const puertos = usePuertos();
  const accion = useAccion();
  const inicio = useConsulta(['plan-inicio'], (p) => p.plan.inicio());
  const [elegida, setElegida] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const i = inicio.data;
  const conPlanes = i ? [...i.proximos.filter((m) => m.plan).reverse(), ...i.recientes.filter((m) => m.plan)] : [];
  const opciones: { clave: string; titulo: string; detalle: string; base: BaseAnual }[] = [
    ...conPlanes.map((m) => ({
      clave: claveMes(m.ref), titulo: `${formatMesAnio(m.ref)} · ${m.detalle.split(' · ')[0]}`,
      detalle: `${m.estado === 'BORRADOR' ? 'Dejaría' : 'Deja'} libre ${m.libre.map((v) => formatCop(v)).join(' – ')}`, base: { tipo: 'MES' as const, ref: m.ref },
    })),
    { clave: 'FIJOS', titulo: 'Solo fijos e ingresos', detalle: 'Variables en blanco', base: { tipo: 'FIJOS' } },
    { clave: 'CERO', titulo: 'Desde cero', detalle: 'Solo el salario y el diezmo', base: { tipo: 'CERO' } },
  ];
  const actual = claveMes(mesDe(puertos.hoy()));
  const clave = elegida ?? (opciones.find((o) => o.clave === actual) ?? opciones[0])?.clave;
  const base = opciones.find((o) => o.clave === clave)?.base ?? null;
  const vista = useConsulta(['vista-base', anio, clave], (p) => (base ? p.plan.vistaBase(anio, base) : Promise.resolve(null)));
  const volver = conPlan ? `/anual/${anio}` : '/planear';

  const replicar = () => {
    if (tieneMontos && !confirmando) return setConfirmando(true);
    void accion.ejecutar((p) => p.plan.replicarMes(anio, base!)).then((ok) => ok && router.replace(`/anual/${anio}`));
  };

  if (anio < mesDe(puertos.hoy()).anio) return <Pantalla><Encabezado titulo={`Plan ${anio}`} volver="/planear" volverTexto="Plan" /><Texto v="pequeno">{anio} ya pasó: no se puede planear.</Texto></Pantalla>;

  return (
    <Pantalla>
      <Encabezado rotulo={`Paso 1 de 2 · Año ${anio}`} titulo={`¿De qué mes parte ${anio}?`} volver={volver} volverTexto={conPlan ? 'Lo que cambia' : 'Plan'} />
      <Texto v="pequeno">Se copia en cada mes. Después agregas solo lo que cambia.</Texto>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Mes base">
        {opciones.map((o) => {
          const activa = o.clave === clave;
          return (
            <Pressable key={o.clave} accessibilityRole="radio" accessibilityState={{ checked: activa }} onPress={() => { setElegida(o.clave); setConfirmando(false); }}
              style={{ padding: 14, borderRadius: 14, borderWidth: activa ? 2 : 1, borderColor: activa ? colors.acento : colors.bordeCampo, backgroundColor: activa ? colors.acentoSuave : colors.superficie, gap: 3 }}>
              <Texto style={{ fontSize: 15, fontFamily: fonts.semibold }}>{o.titulo}</Texto>
              <Texto v="pequeno">{o.detalle}</Texto>
            </Pressable>
          );
        })}
      </View>
      <Texto v="detalle">Se copia en los 12 meses. Los que ya tienen plan no cambian.</Texto>
      {vista.data && (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Texto v="pequeno">Queda libre cada mes</Texto>
            <Monto testID="libre-mes-base" valor={vista.data.libreMes} style={{ fontFamily: fonts.semibold, color: vista.data.libreMes >= 0 ? colors.acento : colors.negativo }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Texto v="pequeno">En el año, antes de lo que cambia</Texto>
            <Monto valor={vista.data.libreAnio} style={{ fontSize: 13 }} />
          </View>
        </View>
      )}
      {confirmando && <Texto accessibilityRole="alert" style={{ fontSize: 14, color: colors.aviso }}>Se reemplazan los montos de los 12 meses; lo que cambia se conserva.</Texto>}
      <Aviso texto={accion.error} />
      <Boton titulo={confirmando ? 'Sí, reemplazar' : 'Replicar en los 12 meses'} deshabilitado={!i || !base || accion.ocupado} onPress={replicar} />
    </Pantalla>
  );
}

function LoQueCambia({ anio, letra }: { anio: number; letra: string | null }) {
  // La opcion elegida por id; sin ella, la de la letra de la URL, la en uso o la A.
  const [opcionId, setOpcionId] = useState<Id | null>(null);
  const base = useConsulta(['anual', String(anio), 'opciones'], (p) => p.plan.anual(anio));
  const pedida = opcionId ?? base.data?.opciones.find((o) => o.letra === letra)?.id ?? null;
  const r = useConsulta(['anual', String(anio), pedida], (p) => p.plan.anual(anio, pedida));
  const [hojaMeses, setHojaMeses] = useState(false);
  const categorias = useConsulta(['categorias'], (p) => p.hogar.categorias());
  const accion = useAccion();
  const [cambio, setCambio] = useState<{ evento: EventoAnual | null; mes: number } | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [borrando, setBorrando] = useState<{ cambios: number; proyecciones: boolean } | null>(null);
  const puertos = usePuertos();
  const d = r.data;
  if (!d) return null;

  const apretado = d.kpis.mesApretado.mes;
  const esA = d.opciones[0]?.id === d.opcion.id;
  const suma = (v: number[]) => v.reduce((a, x) => a + x, 0);
  const frenteA = esA ? 0 : suma(d.libre) - suma(d.libreA);
  const duplicar = () => accion.ejecutar(async (p) => setOpcionId(await p.plan.duplicarOpcionAnual(anio, d.opcion.id)));

  return (
    <Pantalla>
      <Encabezado titulo={d.opciones.length > 1 ? `Plan ${anio}` : `${anio}: lo que cambia`} rotulo={(d.estado === 'BORRADOR' ? 'Borrador · paso 2 de 2' : 'Meses creados') + (d.opciones.length > 1 ? ` · ${d.opciones.length} opciones` : '')} rotuloColor={d.estado === 'BORRADOR' ? colors.aviso : undefined} volver="/planear" volverTexto="Plan" />
      <Texto v="pequeno">{d.base ? `Cada mes es copia de ${formatMesAnio(d.base).toLowerCase()}. ` : ''}Toca un mes para agregar algo distinto.</Texto>
      {d.estado === 'BORRADOR' && <Boton tipo="texto" titulo="Cambiar mes base" onPress={() => router.push(`/anual/${anio}?paso=base`)} />}

      <View accessibilityRole="tablist" testID="opciones-anual" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {d.opciones.map((o) => {
          const sel = o.id === d.opcion.id;
          return (
            <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: sel }} onPress={() => setOpcionId(o.id)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: sel ? colors.acento : colors.superficie, borderWidth: sel ? 0 : 1, borderColor: colors.borde }}>
              <Texto style={{ fontSize: 14, fontFamily: sel ? fonts.semibold : fonts.regular, color: sel ? '#FFFFFF' : colors.texto }}>{`Opción ${o.letra}${o.inicialAutor && o.creadoPor !== d.opciones[0]?.creadoPor ? ' · ' + o.inicialAutor : ''}`}</Texto>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" onPress={() => void duplicar()} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.control }}>
          <Texto style={{ fontSize: 14 }}>+ Duplicar</Texto>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Texto v="detalle">Libre en el año</Texto>
          <Monto testID="kpi-libre" valor={d.kpis.libreAnio} style={{ fontSize: 17, fontFamily: fonts.semibold, color: colors.acento }} />
          {frenteA !== 0 && <Texto testID="frente-a" style={{ fontSize: 12, color: frenteA < 0 ? colors.negativo : colors.positivo }}>{`${formatCop(frenteA, { signo: true })} vs Opción A`}</Texto>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Texto v="detalle">Más apretado</Texto>
          <Texto style={{ fontFamily: fonts.semibold }}>{nombreMesCapital(apretado)} · <Monto valor={d.kpis.mesApretado.libre} style={{ color: colors.negativo }} /></Texto>
        </View>
      </View>

      <View testID="lista-meses">
        {d.meses.map((m, k) => {
          const enRojo = (apretado >= m.desde && apretado <= m.hasta) || m.libre < 0;
          return (
            <Pressable key={m.desde} accessibilityRole="button" testID={`mes-${m.desde}`} onPress={() => setCambio({ evento: null, mes: m.desde })}
              style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: k === d.meses.length - 1 ? 0 : 1, borderBottomColor: colors.divisor }}>
              <View style={{ flexShrink: 1, gap: 3 }}>
                <Texto style={{ fontSize: 15, fontFamily: fonts.medium }}>{nombreMeses(m)}</Texto>
                <Texto style={{ fontSize: 12, color: m.cambios.length ? colors.aviso : '#7A7D76' }}>{m.cambios.length ? m.cambios.join(' · ') : m.desde === m.hasta ? 'Igual al mes base' : `Igual al mes base · ${m.hasta - m.desde + 1} meses`}</Texto>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Monto valor={m.libre} style={{ fontSize: 14, fontFamily: m.cambios.length ? fonts.semibold : fonts.medium, color: enRojo ? colors.negativo : m.cambios.length ? colors.texto : colors.secundario }} />
                {!esA && m.libre !== d.libreA[m.desde - 1] && (
                  <Texto testID={`vs-a-${m.desde}`} style={{ fontSize: 11, fontFamily: fonts.medium, color: m.libre < d.libreA[m.desde - 1]! ? colors.negativo : colors.positivo }}>{`${formatCop(m.libre - d.libreA[m.desde - 1]!, { signo: true })} vs A`}</Texto>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 4 }} testID="lo-que-cambia">
        <Texto v="rotulo">{`Lo que cambia${d.opciones.length > 1 ? ` en la Opción ${d.opcion.letra}` : ''} · ${d.cambios.length}`}</Texto>
        {d.cambios.map((c) => (
          <Pressable key={c.evento.id} accessibilityRole="button" onPress={() => setCambio({ evento: c.evento, mes: c.evento.mes })}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
            <Texto testID="rango-cambio" style={{ width: 76, fontSize: 13, fontFamily: fonts.semibold, color: colors.secundario }}>{rangoEvento(c.evento)}</Texto>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto style={{ fontSize: 14, fontFamily: fonts.medium }}>{c.evento.nombre}</Texto>
              <Texto v="detalle">{detalleCambio(c)}</Texto>
            </View>
            <Texto style={{ fontFamily: fonts.medium, fontSize: 13, color: c.evento.tipo === 'INGRESO' ? colors.positivo : colors.texto }}>{c.evento.tipo === 'GASTO' ? formatCop(c.evento.monto) : formatCop(c.evento.monto, { signo: true })}</Texto>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton tipo="secundario" titulo="+ Algo distinto" onPress={() => setCambio({ evento: null, mes: 1 })} style={{ flex: 1 }} />
        <Boton titulo={`Meses con la ${d.opcion.letra}`} deshabilitado={accion.ocupado} onPress={() => setHojaMeses(true)} style={{ flex: 1 }} />
      </View>
      {borrando ? (
        <View testID="confirmar-borrar" style={{ gap: 10, padding: 14, borderRadius: 12, backgroundColor: colors.avisoSuave }}>
          <Texto accessibilityRole="alert" style={{ fontSize: 14, color: colors.aviso }}>{textoBorrado(anio, borrando)}</Texto>
          <Boton tipo="peligro" titulo={`Sí, borrar plan de ${anio}`} deshabilitado={accion.ocupado} onPress={() => void accion.ejecutar((p) => p.plan.borrarAnual(anio)).then((ok) => ok && router.replace('/planear'))} />
          <Boton tipo="texto" titulo="Cancelar" onPress={() => setBorrando(null)} />
        </View>
      ) : (
        <Boton tipo="texto" titulo={`Borrar plan de ${anio}`} onPress={() => void puertos.plan.conteoBorradoAnual(anio).then(setBorrando)} />
      )}
      {mensaje ? <Texto style={{ color: colors.positivo }}>{mensaje}</Texto> : null}
      <Aviso texto={accion.error} />
      {cambio && <CambioHoja anio={anio} opcionId={d.opcion.id} evento={cambio.evento} mesInicial={cambio.mes} categorias={categorias.data ?? []} onCerrar={() => setCambio(null)} />}
      {hojaMeses && (
        <MesesHoja anio={anio} opcionId={d.opcion.id} letra={d.opcion.letra} onCerrar={() => setHojaMeses(false)}
          onListo={(n) => { setHojaMeses(false); setMensaje(textoListo(n, d.opcion.letra)); }} />
      )}
    </Pantalla>
  );
}

/** "Listo: 2 meses creados y 10 actualizados con la Opción A." */
function textoListo(n: { creados: number; actualizados: number }, letra: string): string {
  const partes = [n.creados ? `${n.creados} ${n.creados === 1 ? 'mes creado' : 'meses creados'}` : '', n.actualizados ? `${n.actualizados} ${n.actualizados === 1 ? 'actualizado' : 'actualizados'}` : ''].filter(Boolean);
  return `Listo: ${partes.join(' y ')} con la Opción ${letra}.`;
}

/** Meses seguidos que se muestran juntos: misma accion, mismo estado de hoy y misma marca. */
function agrupar(meses: MesDesdeAnual[]): MesDesdeAnual[][] {
  const grupos: MesDesdeAnual[][] = [];
  for (const m of meses) {
    const ultimo = grupos.at(-1);
    const u = ultimo?.at(-1);
    if (u && u.accion === m.accion && u.ahora === m.ahora && u.motivo === m.motivo && u.marcado === m.marcado && u.mes === m.mes - 1) ultimo!.push(m);
    else grupos.push([m]);
  }
  return grupos;
}

/** "Meses con la Opción X" (AnualActualizarMovil.dc.html, design D3 de anual-opciones-y-meses). */
function MesesHoja({ anio, opcionId, letra, onCerrar, onListo }: { anio: number; opcionId: Id; letra: string; onCerrar: () => void; onListo: (n: { creados: number; actualizados: number }) => void }) {
  const accion = useAccion();
  const meses = useConsulta(['meses-anual', anio, opcionId], (p) => p.plan.mesesDesdeAnual(anio, opcionId));
  const [marcados, setMarcados] = useState<Set<number> | null>(null);
  const lista = meses.data ?? [];
  const elegidos = marcados ?? new Set(lista.filter((m) => m.accion === 'ACTUALIZABLE' && m.marcado).map((m) => m.mes));
  const crear = lista.filter((m) => m.accion === 'CREAR').length;
  const actualizar = [...elegidos].sort((a, b) => a - b);
  const plural = (n: number) => (n === 1 ? 'mes' : 'meses');
  const boton = crear && actualizar.length ? `Crear ${crear} y actualizar ${actualizar.length} ${plural(actualizar.length)}`
    : crear ? `Crear ${crear} ${plural(crear)}` : actualizar.length ? `Actualizar ${actualizar.length} ${plural(actualizar.length)}` : 'Nada que crear ni actualizar';
  const nombre = (g: MesDesdeAnual[]) => (g.length === 1 ? nombreMesCapital(g[0]!.mes) : `${nombreMesCapital(g[0]!.mes)} a ${nombreMes(g.at(-1)!.mes)}`);
  const marcado = (g: MesDesdeAnual[]) => g[0]!.accion === 'CREAR' || (g[0]!.accion === 'ACTUALIZABLE' && g.every((m) => elegidos.has(m.mes)));
  const alternar = (g: MesDesdeAnual[]) => {
    const nuevos = new Set(elegidos);
    const marcar = !marcado(g);
    for (const m of g) {
      if (marcar) nuevos.add(m.mes);
      else nuevos.delete(m.mes);
    }
    setMarcados(nuevos);
  };
  const textoAccion = (g: MesDesdeAnual[]) => (g[0]!.accion === 'BLOQUEADO' ? g[0]!.motivo : g[0]!.accion === 'CREAR' ? (g.length > 1 ? 'Se crean' : 'Se crea') : marcado(g) ? (g.length > 1 ? 'Se actualizan' : 'Se actualiza') : 'No se toca');

  return (
    <HojaPlan titulo={`Meses con la Opción ${letra}`} antetitulo={`Plan ${anio}`} onCerrar={onCerrar}>
      <Texto v="pequeno">Los meses sin plan se crean con su columna. Los que ya tienen plan solo cambian si los marcas.</Texto>
      <View testID="meses-anual" style={{ borderWidth: 1, borderColor: colors.borde, borderRadius: 14, overflow: 'hidden' }}>
        {agrupar(lista).map((g, k) => {
          const bloqueado = g[0]!.accion !== 'ACTUALIZABLE';
          return (
            <Pressable key={g[0]!.mes} testID={`meses-${g.map((m) => m.mes).join('-')}`} accessibilityRole="checkbox" accessibilityState={{ checked: marcado(g), disabled: bloqueado }}
              accessibilityLabel={`Actualizar ${nombre(g)}`} disabled={bloqueado} onPress={() => alternar(g)}
              style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: k ? 1 : 0, borderTopColor: colors.divisor, backgroundColor: g[0]!.accion === 'BLOQUEADO' ? colors.fondo : colors.superficie }}>
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: marcado(g) ? colors.acento : colors.control, backgroundColor: marcado(g) ? colors.acento : 'transparent', opacity: bloqueado && g[0]!.accion === 'BLOQUEADO' ? 0.4 : 1 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Texto style={{ fontSize: 15, fontFamily: fonts.semibold }}>{nombre(g)}</Texto>
                <Texto v="detalle">{g[0]!.ahora + (g.length > 1 ? ` · ${g.length} meses` : '')}</Texto>
              </View>
              <Texto style={{ fontSize: 12, fontFamily: fonts.semibold, color: marcado(g) && g[0]!.accion !== 'BLOQUEADO' ? colors.acento : colors.secundario }}>{textoAccion(g)}</Texto>
            </Pressable>
          );
        })}
      </View>
      <Texto style={{ fontSize: 12, lineHeight: 18, color: '#6B4A00', backgroundColor: '#FBF1DC', padding: 10, borderRadius: 10, overflow: 'hidden' }}>{`Actualizar reemplaza el plan de ese mes, con sus opciones, por la columna de la Opción ${letra}. Los meses con pagos, gastos o un cierre no se tocan.`}</Texto>
      <Aviso texto={accion.error} />
      <Boton titulo={boton} deshabilitado={accion.ocupado || !(crear + actualizar.length)}
        onPress={() => void accion.ejecutar((p) => p.plan.crearOActualizarMeses(anio, opcionId, actualizar)).then((ok) => ok && onListo({ creados: crear, actualizados: actualizar.length }))} />
    </HojaPlan>
  );
}

/** "Se borran los montos, 6 cambios y los aportes proyectados de 2027. Los meses ya creados no cambian." */
function textoBorrado(anio: number, b: { cambios: number; proyecciones: boolean }): string {
  const partes = ['los montos'];
  if (b.cambios) partes.push(`${b.cambios} ${b.cambios === 1 ? 'cambio' : 'cambios'}`);
  if (b.proyecciones) partes.push('los aportes proyectados');
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0];
  return `Se borran ${lista} de ${anio}. Los meses ya creados no cambian.`;
}

function detalleCambio(c: VistaCambio): string {
  const partes = [c.evento.tipo === 'GASTO' ? `Gasto · ${c.donde}` : c.donde];
  if (c.diezmo) partes.push(`diezmo ${formatCop(c.diezmo)}`);
  if (c.evento.hasta > c.evento.mes) partes.push(`${c.evento.hasta - c.evento.mes + 1} meses`);
  return partes.join(' · ');
}

/** "Solo en marzo", "Marzo a junio · 4 meses" o "De marzo en adelante · 10 meses" (anual-evento-rango). */
function textoRango(desde: number, hasta: number): string {
  if (hasta <= desde) return `Solo en ${nombreMes(desde)}`;
  if (hasta === 12) return `De ${nombreMes(desde)} en adelante · ${13 - desde} meses`;
  return `${nombreMesCapital(desde)} a ${nombreMes(hasta)} · ${hasta - desde + 1} meses`;
}

/** "Algo distinto en {mes}" (AnualCambioMovil.dc.html), en hoja como las demas de Planear. */
function CambioHoja({ anio, opcionId, evento, mesInicial, categorias, onCerrar }: { anio: number; opcionId: Id; evento: EventoAnual | null; mesInicial: number; categorias: Categoria[]; onCerrar: () => void }) {
  const accion = useAccion();
  const m = useMiembros();
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? 'GASTO');
  const [nombre, setNombre] = useState(evento?.nombre ?? '');
  const [mes, setMes] = useState(evento?.mes ?? mesInicial);
  const [monto, setMonto] = useState<number | null>(evento?.monto ?? null);
  const [categoria, setCategoria] = useState<string>(evento?.categoriaId ?? '');
  const [persona, setPersona] = useState<Id | null>(evento?.usuarioId ?? null);
  // "Desde {mes} hasta [mes]" (design D4 de anual-evento-rango).
  const [hasta, setHasta] = useState(evento?.hasta ?? evento?.mes ?? mesInicial);
  const cambiarMes = (m: number) => {
    setMes(m);
    if (hasta < m) setHasta(m);
  };
  const [quitando, setQuitando] = useState(false);
  const listo = Boolean(nombre.trim()) && (monto ?? 0) > 0;
  const datos: DatosEvento = {
    nombre, mes, monto: monto ?? 0, tipo, usuarioId: tipo === 'INGRESO' ? persona : null,
    categoriaId: tipo === 'GASTO' ? categoria || null : null, hasta: Math.max(hasta, mes),
  };
  const vista = useConsulta(['previa-evento', anio, opcionId, evento?.id ?? null, listo ? JSON.stringify(datos) : null], (p) => (listo ? p.plan.previsualizarEvento(anio, evento?.id ?? null, datos, opcionId) : Promise.resolve(null)));
  const queda = listo ? vista.data?.[mes - 1] ?? null : null;

  const terminar = (ok: boolean) => ok && onCerrar();
  const opcionesCategoria = [
    { valor: '', etiqueta: 'Eventos del año' },
    ...categorias.filter((c) => c.tipo !== 'DIEZMO' && c.nombre !== 'Eventos del año').map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];

  return (
    <HojaPlan titulo={`Algo distinto en ${nombreMes(mes)}`} antetitulo={`Plan ${anio}`} onCerrar={onCerrar}>
      {quitando ? (
        <>
          <Texto v="pequeno">{`¿Quitar ${evento!.nombre} del plan ${anio}?`}</Texto>
          <Aviso texto={accion.error} />
          <Boton tipo="peligro" titulo="Sí, quitar" deshabilitado={accion.ocupado} onPress={() => void accion.ejecutar((p) => p.plan.quitarEvento(anio, evento!.id)).then(terminar)} />
        </>
      ) : (
        <>
          <Segmentado opciones={[{ valor: 'INGRESO', etiqueta: 'Ingreso' }, { valor: 'GASTO', etiqueta: 'Gasto' }]} valor={tipo} onCambio={(v) => v && setTipo(v)} />
          <Campo etiqueta="¿Qué es?" valor={nombre} onCambio={setNombre} placeholder={tipo === 'GASTO' ? 'Ej: SOAT' : 'Ej: Prima'} />
          <MontoInput etiqueta={hasta > mes ? '¿Cuánto cada mes?' : '¿Cuánto?'} valor={monto} onCambio={setMonto} />
          <Segmentado chips etiqueta="Desde" opciones={MESES.map((x) => ({ valor: String(x), etiqueta: nombreMesCapital(x).slice(0, 3) }))} valor={String(mes)} onCambio={(v) => v && cambiarMes(Number(v))} />
          <Segmentado chips etiqueta="Hasta" opciones={MESES.filter((x) => x >= mes).map((x) => ({ valor: String(x), etiqueta: nombreMesCapital(x).slice(0, 3) }))} valor={String(Math.max(hasta, mes))} onCambio={(v) => v && setHasta(Number(v))} />
          <Texto v="pequeno" testID="rango">{textoRango(mes, Math.max(hasta, mes))}</Texto>
          {tipo === 'GASTO' ? (
            <Segmentado chips etiqueta="Categoría" opciones={opcionesCategoria} valor={categoria} onCambio={(v) => setCategoria(v ?? '')} />
          ) : (
            <Segmentado chips opcional etiqueta="De quién · hereda su diezmo" opciones={m.miembros.map((x) => ({ valor: x.usuario.id, etiqueta: x.usuario.nombre }))} valor={persona} onCambio={setPersona} />
          )}
          {queda !== null && (
            <View testID="queda" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Texto v="pequeno">{`${nombreMesCapital(mes)} queda en`}</Texto>
              <Monto valor={queda} style={{ color: queda < 0 ? colors.negativo : colors.texto }} />
            </View>
          )}
          <Aviso texto={accion.error} />
          <Boton titulo="Guardar" deshabilitado={!listo || accion.ocupado}
            onPress={() => void accion.ejecutar((p) => (evento ? p.plan.editarEvento(anio, evento.id, datos) : p.plan.agregarEvento(anio, datos, opcionId))).then(terminar)} />
          {evento && <Boton tipo="texto" titulo="Quitar" onPress={() => setQuitando(true)} />}
        </>
      )}
    </HojaPlan>
  );
}
