import type { Categoria, Id, IngresoPlan, ItemPlan, TipoItem } from '@steward/domain';
import { useState, type ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { useMiembros } from '@/data/miembros';
import { useAccion, useConsulta } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, Campo, colors, fonts, Interruptor, MontoInput, Segmentado, Texto } from '@/ui';

/** Hoja encima de la pantalla: cerrar sin guardar no cambia nada (spec steward-planear). */
export function HojaPlan({ titulo, antetitulo, onCerrar, children }: { titulo: string; antetitulo?: string; onCerrar: () => void; children: ReactNode }) {
  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onCerrar}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.superficie }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flexShrink: 1, gap: 4 }}>
            {antetitulo ? <Texto v="rotulo">{antetitulo}</Texto> : null}
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{titulo}</Texto>
          </View>
          <Boton tipo="enlace" titulo="Cancelar" onPress={onCerrar} />
        </View>
        {children}
      </ScrollView>
    </Modal>
  );
}

interface Comun {
  planId: Id;
  escenarioId: Id;
  letra: string;
  onCerrar: () => void;
  onGuardado: () => void;
}

/** Una linea de ingreso de la opcion. El bruto se pide cuando importa para el diezmo; sin tocarlo, sigue al monto. */
export function IngresoHoja({ planId, escenarioId, letra, linea, onCerrar, onGuardado }: Comun & { linea: IngresoPlan | null }) {
  const m = useMiembros();
  const { sesion } = useSesion();
  const regla = useConsulta(['regla'], (p) => p.ingresos.regla());
  const accion = useAccion();
  const [nombre, setNombre] = useState(linea?.nombre ?? '');
  const [monto, setMonto] = useState<number | null>(linea?.monto ?? null);
  const [bruto, setBruto] = useState<number | null>(linea && linea.bruto !== linea.monto ? linea.bruto : null);
  const [persona, setPersona] = useState<Id | null>(linea ? linea.usuarioId : sesion?.usuario.id ?? null);
  const [aplicarDiezmo, setAplicarDiezmo] = useState(false);
  const [quitando, setQuitando] = useState(false);

  // Solo se conoce la regla propia: una linea de un ingreso fijo o con un bruto distinto tambien lo muestra.
  const propia = persona === sesion?.usuario.id && regla.data?.activa === true && regla.data.base === 'BRUTO';
  const conBruto = linea?.tipo === 'FIJO' || (linea !== null && linea.bruto !== linea.monto) || propia;

  const terminar = async (trabajo: Parameters<typeof accion.ejecutar>[0]) => {
    if (await accion.ejecutar(trabajo)) onGuardado();
  };

  return (
    <HojaPlan titulo={linea ? 'Editar ingreso' : 'Nuevo ingreso'} antetitulo={`Opción ${letra}`} onCerrar={onCerrar}>
      {quitando ? (
        <>
          <Texto style={{ fontSize: 15, color: colors.secundario }}>¿Quitar {linea!.nombre} de la Opción {letra}?</Texto>
          <Aviso texto={accion.error} />
          <Boton tipo="peligro" titulo="Sí, quitar" deshabilitado={accion.ocupado} onPress={() => terminar((p) => p.plan.quitarIngreso(planId, escenarioId, linea!.id))} />
        </>
      ) : (
        <>
          <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} placeholder="Ej: Venta bicicleta" />
          <MontoInput etiqueta="Monto" valor={monto} onCambio={setMonto} />
          {conBruto && <MontoInput etiqueta="Bruto" valor={bruto} onCambio={setBruto} ayuda="Sobre este valor se calcula el diezmo cuando la regla usa el bruto." />}
          <Segmentado etiqueta="Persona · Opcional" chips opcional opciones={m.miembros.map((x) => ({ valor: x.usuario.id, etiqueta: x.usuario.nombre }))} valor={persona} onCambio={setPersona} />
          {!linea && <Interruptor titulo="Aplicar diezmo" detalle="Agrega su diezmo al plan" activo={aplicarDiezmo} onCambio={setAplicarDiezmo} />}
          <Aviso texto={accion.error} />
          <Boton
            titulo="Guardar"
            deshabilitado={!nombre.trim() || monto === null || accion.ocupado}
            onPress={() =>
              terminar((p) =>
                p.plan.guardarIngreso(
                  planId,
                  escenarioId,
                  { id: linea?.id, nombre, monto: monto!, bruto: conBruto ? bruto ?? monto! : monto!, usuarioId: persona, tipo: linea?.tipo ?? 'OTRO', ingresoFijoId: linea?.ingresoFijoId ?? null },
                  !linea && aplicarDiezmo,
                ),
              )
            }
          />
          {linea && <Boton tipo="enlace" titulo="Quitar" onPress={() => setQuitando(true)} />}
        </>
      )}
    </HojaPlan>
  );
}

/** El tipo sale de la categoria (design D6 de plan-mes-siguiente). */
function tipoDe(c: Categoria | undefined, aCuotas: boolean, cambia: boolean): TipoItem {
  switch (c?.tipo) {
    case 'VARIABLE':
      return 'VARIABLE';
    case 'CREDITO':
      return 'CREDITO';
    case 'DIEZMO':
      return 'DIEZMO';
    case 'TARJETA':
      return aCuotas ? 'CUOTA' : 'FIJO';
    case 'OTRO':
      return cambia ? 'VARIABLE' : 'FIJO';
    default:
      return 'FIJO';
  }
}

const entero = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null);

/** Un gasto de la opcion. Un diezmo muestra de que ingreso viene y, si se cambio a mano, "Volver a calcular". */
export function GastoPlanHoja({ planId, escenarioId, letra, item, categorias, lineas, onCerrar, onGuardado }: Comun & { item: ItemPlan | null; categorias: Categoria[]; lineas: IngresoPlan[] }) {
  const accion = useAccion();
  const [nombre, setNombre] = useState(item?.nombre ?? '');
  const [monto, setMonto] = useState<number | null>(item?.monto ?? null);
  const [categoria, setCategoria] = useState<Id | null>(item?.categoriaId ?? categorias[0]?.id ?? null);
  const [aCuotas, setACuotas] = useState(item?.tipo === 'CUOTA');
  const [cambia, setCambia] = useState(item?.tipo === 'VARIABLE');
  // Abrir y guardar no cambia el tipo de un item: solo tocar la categoria o sus preguntas.
  const [tocado, setTocado] = useState(false);
  const [dia, setDia] = useState(item?.diaVence ? String(item.diaVence) : '');
  const [cuotaActual, setCuotaActual] = useState(item?.cuota ? String(item.cuota.actual) : '');
  const [cuotaTotal, setCuotaTotal] = useState(item?.cuota ? String(item.cuota.total) : '');
  const [quitando, setQuitando] = useState(false);

  const elegida = categorias.find((c) => c.id === categoria);
  const tipo: TipoItem = item && !tocado ? item.tipo : tipoDe(elegida, aCuotas, cambia);
  const origen = item?.tipo !== 'DIEZMO' ? null : lineas.find((l) => l.id === item.ingresoPlanId)?.nombre ? `Viene de ${lineas.find((l) => l.id === item.ingresoPlanId)!.nombre}` : item.aporteId ? 'Viene de un aporte' : null;
  const diaBien = !dia.trim() || ((entero(dia) ?? 0) >= 1 && (entero(dia) ?? 32) <= 31);
  const cuotaBien = tipo !== 'CUOTA' || (entero(cuotaActual) !== null && entero(cuotaTotal) !== null);
  const listo = Boolean(nombre.trim()) && monto !== null && Boolean(categoria) && diaBien && cuotaBien;

  const terminar = async (trabajo: Parameters<typeof accion.ejecutar>[0]) => {
    if (await accion.ejecutar(trabajo)) onGuardado();
  };

  function guardar() {
    const cuota = tipo === 'CUOTA' ? { actual: entero(cuotaActual)!, total: entero(cuotaTotal)! } : item?.tipo === tipo ? item.cuota : null;
    return terminar((p) =>
      p.plan.guardarItem(planId, escenarioId, {
        id: item?.id, categoriaId: categoria!, nombre, monto: monto!, diaVence: entero(dia), tipo, cuota, creditoId: item?.creditoId ?? null,
        ingresoFijoId: item?.ingresoFijoId ?? null, aporteId: item?.aporteId ?? null, ingresoPlanId: item?.ingresoPlanId ?? null, ajustadoAMano: item?.ajustadoAMano ?? false,
      }),
    );
  }

  return (
    <HojaPlan titulo={item ? 'Editar gasto' : 'Nuevo gasto'} antetitulo={`Opción ${letra}`} onCerrar={onCerrar}>
      {quitando ? (
        <>
          <Texto style={{ fontSize: 15, color: colors.secundario }}>¿Quitar {item!.nombre} de la Opción {letra}?</Texto>
          <Aviso texto={accion.error} />
          <Boton tipo="peligro" titulo="Sí, quitar" deshabilitado={accion.ocupado} onPress={() => terminar((p) => p.plan.quitarItem(planId, escenarioId, item!.id))} />
        </>
      ) : (
        <>
          {origen && <Texto testID="origen-diezmo" style={{ borderRadius: 12, backgroundColor: colors.nota, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, color: colors.textoSuave }}>{origen}</Texto>}
          <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} placeholder="Ej: Regalo" />
          <MontoInput etiqueta="Monto" valor={monto} onCambio={setMonto} />
          {item?.ajustadoAMano && (
            <View style={{ gap: 4, borderRadius: 12, backgroundColor: colors.avisoSuave, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Texto style={{ fontSize: 13, color: colors.aviso }}>Ajustado a mano: no sigue a su ingreso.</Texto>
              <Boton tipo="texto" titulo="Volver a calcular" deshabilitado={accion.ocupado} onPress={() => terminar((p) => p.plan.recalcularDiezmo(planId, escenarioId, item.id))} />
            </View>
          )}
          <Segmentado
            etiqueta="Categoría"
            chips
            opciones={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            valor={categoria}
            onCambio={(c) => {
              if (c && c !== categoria) {
                setCategoria(c);
                setTocado(true);
              }
            }}
          />
          {elegida?.tipo === 'TARJETA' && <Interruptor titulo="¿A cuotas?" detalle="Una compra con cuota actual y total" activo={tipo === 'CUOTA'} onCambio={(v) => { setACuotas(v); setTocado(true); }} />}
          {elegida?.tipo === 'OTRO' && <Interruptor titulo="Cambia cada mes" detalle="Se lleva lo gastado contra el presupuesto" activo={tipo === 'VARIABLE'} onCambio={(v) => { setCambia(v); setTocado(true); }} />}
          <Campo etiqueta="Día de vencimiento · Opcional" teclado="number-pad" valor={dia} onCambio={setDia} placeholder="Ej: 15" />
          {tipo === 'CUOTA' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Campo etiqueta="Cuota actual" teclado="number-pad" valor={cuotaActual} onCambio={setCuotaActual} /></View>
              <View style={{ flex: 1 }}><Campo etiqueta="De cuántas" teclado="number-pad" valor={cuotaTotal} onCambio={setCuotaTotal} /></View>
            </View>
          )}
          <Aviso texto={accion.error} />
          <Boton titulo="Guardar" deshabilitado={!listo || accion.ocupado} onPress={guardar} />
          {item && <Boton tipo="enlace" titulo="Quitar" onPress={() => setQuitando(true)} />}
        </>
      )}
    </HojaPlan>
  );
}
