import { formatFechaCorta } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';

import { useMesDeHoy } from '@/data/mes-de-hoy';
import { useMiembros } from '@/data/miembros';
import { useConsulta } from '@/data/puertos';
import { Fila, Hoja, Monto, Texto } from '@/ui';

/** Los gastos de un variable o los aportes de una persona en el mes; cada uno abre su hoja (spec steward-hoy). */
export default function Registros() {
  const { item, aportes } = useLocalSearchParams<{ item?: string; aportes?: string }>();
  const { ref } = useMesDeHoy();
  const m = useMiembros();
  const lista = useConsulta(['registros', ref, item, aportes], (p) => p.movimientos.registros(ref, { itemId: item, aportesDe: aportes }));

  return (
    <Hoja titulo="Registros del mes">
      {(lista.data ?? []).map((r) => (
        <Fila key={r.movimiento.id} titulo={r.movimiento.nota || r.titulo} detalle={`${formatFechaCorta(r.movimiento.fecha)} · ${m.nombreDe(r.movimiento.usuarioId)}`} onPress={() => router.push(`/registro/${r.movimiento.id}`)}>
          <Monto valor={r.movimiento.monto} />
        </Fila>
      ))}
      {lista.data?.length === 0 && <Texto v="pequeno">No hay registros.</Texto>}
    </Hoja>
  );
}
