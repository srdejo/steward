import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AvisoMes, useMesDeHoy } from '@/data/mes-de-hoy';
import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, cerrarHoja, Hoja, Monto, MontoInput, Texto } from '@/ui';

/** "Recibí": el monto de la linea viene lleno para confirmarlo o cambiarlo por lo que llego (spec steward-hoy). */
export default function Recibir() {
  const { clave } = useLocalSearchParams<{ clave: string }>();
  const { ref } = useMesDeHoy();
  const accion = useAccion();
  const resumen = useConsulta(['resumen', ref], (p) => p.movimientos.resumenMes(ref));
  const l = resumen.data?.ingresos.find((x) => x.clave === clave && !x.recibido && (x.lineaId || x.ingresoFijoId));
  const [monto, setMonto] = useState<number | null>(null);

  useEffect(() => {
    if (l && monto === null) setMonto(l.monto);
  }, [l, monto]);

  async function guardar() {
    if (!l) return;
    const ok = await accion.ejecutar((p) =>
      p.ingresos.marcarRecibido(l.lineaId ? { ref, lineaId: l.lineaId, monto: monto! } : { ref, ingresoFijoId: l.ingresoFijoId!, monto: monto! }),
    );
    if (ok) cerrarHoja();
  }

  return (
    <Hoja titulo={l?.nombre ?? 'Recibí'} antetitulo="Ingreso del mes" subtitulo={l ? <Texto v="pequeno">Plan <Monto valor={l.monto} style={{ fontSize: 13 }} /></Texto> : undefined}>
      <AvisoMes />
      {l ? (
        <>
          <MontoInput etiqueta="Valor recibido" grande valor={monto} onCambio={setMonto} ayuda="Viene lleno con el plan. Si llegó otro valor, cámbialo." />
          <Boton titulo="Marcar recibido" deshabilitado={!monto || accion.ocupado} onPress={guardar} />
        </>
      ) : !resumen.isLoading && !accion.error ? (
        <Texto v="pequeno">Ese ingreso ya se recibió o no está en el plan del mes.</Texto>
      ) : null}
      <Aviso texto={accion.error} />
    </Hoja>
  );
}
