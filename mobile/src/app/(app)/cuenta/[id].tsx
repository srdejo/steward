import { formatFechaCorta } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useConsulta } from '@/data/puertos';
import { colors, Encabezado, Fila, fonts, Monto, Pantalla, Texto } from '@/ui';

/** De donde sale el saldo de una cuenta: su ultimo cuadre y lo registrado despues (spec steward-cuentas). */
export default function Cuenta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cuentas = useConsulta(['cuentas', 'TODAS'], (p) => p.cuentas.cuentas());
  const movimientos = useConsulta(['movimientos-cuenta', id], (p) => p.cuentas.movimientos(id));
  const c = cuentas.data?.cuentas.find((x) => x.cuenta.id === id);

  if (!c) return <Pantalla><Encabezado titulo={cuentas.isLoading ? 'Cargando…' : 'Cuenta no encontrada'} volver="/cuentas" volverTexto="Cuentas" /></Pantalla>;

  return (
    <Pantalla>
      <Encabezado titulo={c.cuenta.nombre} rotulo={c.titular} volver="/cuentas" volverTexto="Cuentas" />
      <View>
        {(movimientos.data ?? []).map((m) => (
          <Fila key={m.movimiento.id} titulo={m.descripcion} detalle={formatFechaCorta(m.movimiento.fecha)} onPress={m.corregible ? () => router.push(`/registro/${m.movimiento.id}`) : undefined}>
            <Monto valor={m.efecto} signo />
          </Fila>
        ))}
        <Fila testID="ultimo-cuadre" titulo={`Cuadre ${formatFechaCorta(c.cuenta.fechaCuadre)}`} ultima>
          <Monto valor={c.cuenta.saldoCuadre} />
        </Fila>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.divisor, paddingTop: 12 }}>
        <Texto v="rotulo">Saldo estimado</Texto>
        <Text testID="saldo-cuenta" style={{ fontFamily: fonts.monoSemibold, fontSize: 18, color: colors.texto }}>≈ <Monto valor={c.saldo} style={{ fontSize: 18, fontFamily: fonts.monoSemibold }} /></Text>
      </View>
    </Pantalla>
  );
}
