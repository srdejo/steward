import {
  claveMes, formatCop, formatMesAnio, mesDe, nombreMes, nombreMesCapital, nombreMeses,
  type BaseAnual, type Categoria, type DatosEvento, type EventoAnual, type Id, type TipoEvento, type VistaCambio,
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
 * canvas). Paso 1: el mes base y "Replicar en los 12 meses". Paso 2: la lista de los 12 meses y lo que cambia.
 */
export default function Anual() {
  const { anio, paso } = useLocalSearchParams<{ anio: string; paso?: string }>();
  const r = useConsulta(['anual', anio], (p) => p.plan.anual(Number(anio)));
  if (paso === 'base' || (!r.isLoading && !r.data)) return <PasoBase anio={Number(anio)} conPlan={Boolean(r.data)} tieneMontos={Boolean(r.data?.gastos.some((f) => f.valores.some((v) => v > 0)))} />;
  if (!r.data) return <Pantalla><Encabezado titulo={`Plan ${anio}`} volver="/planear" volverTexto="Plan" /><Texto v="pequeno">Cargando…</Texto></Pantalla>;
  return <LoQueCambia anio={Number(anio)} />;
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
            <Monto testID="libre-mes-base" valor={vista.data.libreMes} style={{ fontFamily: fonts.monoSemibold, color: vista.data.libreMes >= 0 ? colors.acento : colors.negativo }} />
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

function LoQueCambia({ anio }: { anio: number }) {
  const r = useConsulta(['anual', String(anio)], (p) => p.plan.anual(anio));
  const categorias = useConsulta(['categorias'], (p) => p.hogar.categorias());
  const accion = useAccion();
  const [cambio, setCambio] = useState<{ evento: EventoAnual | null; mes: number } | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [borrando, setBorrando] = useState<{ cambios: number; proyecciones: boolean } | null>(null);
  const puertos = usePuertos();
  const d = r.data;
  if (!d) return null;

  const crearMeses = () => accion.ejecutar((p) => p.plan.crearMesesDesdeAnual(anio)).then((ok) => ok && setMensaje(`Los 12 meses de ${anio} quedaron en borrador, cada uno con su Opción A.`));
  const apretado = d.kpis.mesApretado.mes;

  return (
    <Pantalla>
      <Encabezado titulo={`${anio}: lo que cambia`} rotulo={d.estado === 'BORRADOR' ? 'Borrador · paso 2 de 2' : 'Meses creados'} rotuloColor={d.estado === 'BORRADOR' ? colors.aviso : undefined} volver="/planear" volverTexto="Plan" />
      <Texto v="pequeno">{d.base ? `Cada mes es copia de ${formatMesAnio(d.base).toLowerCase()}. ` : ''}Toca un mes para agregar algo distinto.</Texto>
      {d.estado === 'BORRADOR' && <Boton tipo="texto" titulo="Cambiar mes base" onPress={() => router.push(`/anual/${anio}?paso=base`)} />}

      <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Texto v="detalle">Libre en el año</Texto>
          <Monto testID="kpi-libre" valor={d.kpis.libreAnio} style={{ fontSize: 17, fontFamily: fonts.monoSemibold, color: colors.acento }} />
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
              <Monto valor={m.libre} style={{ fontSize: 14, fontFamily: m.cambios.length ? fonts.monoSemibold : fonts.mono, color: enRojo ? colors.negativo : m.cambios.length ? colors.texto : colors.secundario }} />
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 4 }} testID="lo-que-cambia">
        <Texto v="rotulo">{`Lo que cambia · ${d.cambios.length}`}</Texto>
        {d.cambios.map((c) => (
          <Pressable key={c.evento.id} accessibilityRole="button" onPress={() => setCambio({ evento: c.evento, mes: c.evento.mes })}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divisor }}>
            <Texto style={{ width: 36, fontSize: 13, fontFamily: fonts.semibold, color: colors.secundario }}>{nombreMesCapital(c.evento.mes).slice(0, 3)}</Texto>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto style={{ fontSize: 14, fontFamily: fonts.medium }}>{c.evento.nombre}</Texto>
              <Texto v="detalle">{detalleCambio(c)}</Texto>
            </View>
            <Texto style={{ fontFamily: fonts.mono, fontSize: 13, color: c.evento.tipo === 'INGRESO' ? colors.positivo : colors.texto }}>{c.evento.tipo === 'GASTO' ? formatCop(c.evento.monto) : formatCop(c.evento.monto, { signo: true })}</Texto>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton tipo="secundario" titulo="+ Algo distinto" onPress={() => setCambio({ evento: null, mes: 1 })} style={{ flex: 1 }} />
        {d.estado === 'BORRADOR' && <Boton titulo="Crear 12 meses" deshabilitado={accion.ocupado} onPress={() => void crearMeses()} style={{ flex: 1 }} />}
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
      {cambio && <CambioHoja anio={anio} evento={cambio.evento} mesInicial={cambio.mes} categorias={categorias.data ?? []} onCerrar={() => setCambio(null)} />}
    </Pantalla>
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
  if (c.evento.enAdelante) partes.push(`de ${nombreMes(c.evento.mes)} en adelante`);
  return partes.join(' · ');
}

/** "Algo distinto en {mes}" (AnualCambioMovil.dc.html), en hoja como las demas de Planear. */
function CambioHoja({ anio, evento, mesInicial, categorias, onCerrar }: { anio: number; evento: EventoAnual | null; mesInicial: number; categorias: Categoria[]; onCerrar: () => void }) {
  const accion = useAccion();
  const m = useMiembros();
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? 'GASTO');
  const [nombre, setNombre] = useState(evento?.nombre ?? '');
  const [mes, setMes] = useState(evento?.mes ?? mesInicial);
  const [monto, setMonto] = useState<number | null>(evento?.monto ?? null);
  const [categoria, setCategoria] = useState<string>(evento?.categoriaId ?? '');
  const [persona, setPersona] = useState<Id | null>(evento?.usuarioId ?? null);
  const [cuando, setCuando] = useState<'SOLO' | 'ADELANTE'>(evento?.enAdelante ? 'ADELANTE' : 'SOLO');
  const [quitando, setQuitando] = useState(false);
  const listo = Boolean(nombre.trim()) && (monto ?? 0) > 0;
  const datos: DatosEvento = {
    nombre, mes, monto: monto ?? 0, tipo, usuarioId: tipo === 'INGRESO' ? persona : null,
    categoriaId: tipo === 'GASTO' ? categoria || null : null, enAdelante: cuando === 'ADELANTE',
  };
  const vista = useConsulta(['previa-evento', anio, evento?.id ?? null, listo ? JSON.stringify(datos) : null], (p) => (listo ? p.plan.previsualizarEvento(anio, evento?.id ?? null, datos) : Promise.resolve(null)));
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
          <MontoInput etiqueta="¿Cuánto?" valor={monto} onCambio={setMonto} />
          <Segmentado chips etiqueta="Mes" opciones={MESES.map((x) => ({ valor: String(x), etiqueta: nombreMesCapital(x).slice(0, 3) }))} valor={String(mes)} onCambio={(v) => v && setMes(Number(v))} />
          {tipo === 'GASTO' ? (
            <Segmentado chips etiqueta="Categoría" opciones={opcionesCategoria} valor={categoria} onCambio={(v) => setCategoria(v ?? '')} />
          ) : (
            <Segmentado chips opcional etiqueta="De quién · hereda su diezmo" opciones={m.miembros.map((x) => ({ valor: x.usuario.id, etiqueta: x.usuario.nombre }))} valor={persona} onCambio={setPersona} />
          )}
          <Segmentado etiqueta="¿Cuándo?" opciones={[{ valor: 'SOLO', etiqueta: `Solo en ${nombreMes(mes)}` }, { valor: 'ADELANTE', etiqueta: 'En adelante' }]} valor={cuando} onCambio={(v) => v && setCuando(v)} />
          {queda !== null && (
            <View testID="queda" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Texto v="pequeno">{`${nombreMesCapital(mes)} queda en`}</Texto>
              <Monto valor={queda} style={{ color: queda < 0 ? colors.negativo : colors.texto }} />
            </View>
          )}
          <Aviso texto={accion.error} />
          <Boton titulo="Guardar" deshabilitado={!listo || accion.ocupado}
            onPress={() => void accion.ejecutar((p) => (evento ? p.plan.editarEvento(anio, evento.id, datos) : p.plan.agregarEvento(anio, datos))).then(terminar)} />
          {evento && <Boton tipo="texto" titulo="Quitar" onPress={() => setQuitando(true)} />}
        </>
      )}
    </HojaPlan>
  );
}
