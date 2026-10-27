import { mesDe, nombreMesCapital, sumarMeses, type Id } from '@steward/domain';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SU_CUENTA, useOpcionesHoja } from '@/data/hoja';
import { useAccion, useConsulta, usePuertos } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, cerrarHoja, colors, fonts, Hoja, Interruptor, Monto, MontoInput, Segmentado, Texto } from '@/ui';

/** Aporte.dc.html: quien · cuanto · para que mes. Suma al "Te queda libre" del mes elegido al instante. */
export default function Aporte() {
  const puertos = usePuertos();
  const { sesion } = useSesion();
  const hoja = useOpcionesHoja();
  const accion = useAccion();
  const actual = mesDe(puertos.hoy());
  const meses = [actual, sumarMeses(actual, 1)];
  const regla = useConsulta(['regla'], (p) => p.ingresos.regla());

  const [quien, setQuien] = useState<Id | null>(sesion?.usuario.id ?? null);
  const [monto, setMonto] = useState<number | null>(null);
  const [mes, setMes] = useState<string | null>('0');
  const [cuenta, setCuenta] = useState<string | null>(null);
  const [diezmo, setDiezmo] = useState(false);

  // "Por defecto según quién aporta": la regla de quien registra, si diezma de sus aportes.
  useEffect(() => {
    setDiezmo(quien === sesion?.usuario.id && Boolean(regla.data?.activa && regla.data.aplicaAportes));
  }, [quien, regla.data, sesion]);

  const ref = meses[Number(mes ?? 0)]!;
  async function guardar() {
    const ok = await accion.ejecutar((p) => p.ingresos.registrarAporte({ usuarioId: quien!, monto: monto!, ref, cuentaId: cuenta && cuenta !== SU_CUENTA ? cuenta : null, aplicaDiezmo: diezmo }));
    if (ok) cerrarHoja();
  }

  return (
    <Hoja titulo="Nuevo aporte">
      <Segmentado etiqueta="¿Quién?" opciones={hoja.personas} valor={quien} onCambio={setQuien} />
      <MontoInput etiqueta="¿Cuánto?" grande valor={monto} onCambio={setMonto} />
      <Segmentado etiqueta="¿Para qué mes?" opciones={meses.map((m, i) => ({ valor: String(i), etiqueta: nombreMesCapital(m.mes) }))} valor={mes} onCambio={setMes} />
      <Segmentado etiqueta="¿Dónde quedó? · Opcional" chips opcional opciones={hoja.desde} valor={cuenta} onCambio={setCuenta} />
      <View style={{ borderRadius: 12, backgroundColor: colors.nota, paddingHorizontal: 16, paddingVertical: 6 }}>
        <Interruptor titulo="Aplicar diezmo" detalle="Por defecto según quién aporta" activo={diezmo} onCambio={setDiezmo} />
      </View>
      <Aviso texto={accion.error} />
      <View style={{ gap: 10 }}>
        {monto ? (
          <Texto testID="efecto-aporte" style={{ fontSize: 13, color: colors.secundario, textAlign: 'center' }}>
            {nombreMesCapital(ref.mes)} pasa a tener <Monto valor={monto} siempreVisible style={{ fontSize: 13, fontFamily: fonts.monoSemibold, color: colors.acento }} /> más en ingresos
          </Texto>
        ) : null}
        <Boton titulo="Guardar aporte" deshabilitado={!quien || !monto || accion.ocupado} onPress={guardar} />
      </View>
    </Hoja>
  );
}
