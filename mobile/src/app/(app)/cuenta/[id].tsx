import { formatFechaCorta, puedeQuitarCuenta } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { useAccion, useConsulta } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, colors, Encabezado, Fila, fonts, Monto, Pantalla, Texto } from '@/ui';

/** De donde sale el saldo de una cuenta: su ultimo cuadre y lo registrado despues (spec steward-cuentas). */
export default function Cuenta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sesion } = useSesion();
  const cuentas = useConsulta(['cuentas', 'TODAS'], (p) => p.cuentas.cuentas());
  const movimientos = useConsulta(['movimientos-cuenta', id], (p) => p.cuentas.movimientos(id));
  const accion = useAccion();
  const [confirmando, setConfirmando] = useState(false);
  const c = cuentas.data?.cuentas.find((x) => x.cuenta.id === id);

  if (!c) return <Pantalla><Encabezado titulo={cuentas.isLoading ? 'Cargando…' : 'Cuenta no encontrada'} volver="/cuentas" volverTexto="Cuentas" /></Pantalla>;

  // Solo las propias o las conjuntas (spec steward-cuentas, "Eliminar una cuenta").
  const eliminable = !!sesion && puedeQuitarCuenta(c.cuenta, sesion.usuario.id);
  const eliminar = async () => {
    if (accion.ocupado) return;
    if (await accion.ejecutar((p) => p.cuentas.eliminar(c.cuenta.id))) {
      setConfirmando(false);
      router.replace('/cuentas');
    }
  };

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
      {eliminable && (
        <Pressable accessibilityRole="button" onPress={() => { accion.limpiar(); setConfirmando(true); }} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.negativo }}>Eliminar cuenta</Text>
        </Pressable>
      )}

      <Modal visible={confirmando} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setConfirmando(false)}>
        <View style={{ flex: 1, backgroundColor: colors.superficie, padding: 20, gap: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22, flexShrink: 1 }}>{`Eliminar ${c.cuenta.nombre}`}</Texto>
            <Boton tipo="enlace" titulo="Cancelar" onPress={() => setConfirmando(false)} />
          </View>
          <Texto style={{ fontSize: 15, color: colors.secundario }}>
            El total del hogar baja en <Monto valor={c.saldo} />. Lo que registraron con esta cuenta queda en el historial, sin cuenta. No se puede deshacer.
          </Texto>
          <Aviso texto={accion.error} />
          <Boton tipo="peligro" titulo="Eliminar cuenta" onPress={eliminar} deshabilitado={accion.ocupado} />
        </View>
      </Modal>
    </Pantalla>
  );
}
