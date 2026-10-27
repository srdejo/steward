import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { mensajeDeError, useConsulta, usePuertos } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Avatar, Aviso, Boton, Campo, colors, fonts, Interruptor, Pantalla, Texto } from '@/ui';

/** Invitado.dc.html: "{quien} te invitó a {hogar}". El invitado no configura ingresos ni cuentas. */
export default function Invitacion() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const puertos = usePuertos();
  const sesion = useSesion();
  const inv = useConsulta(['invitacion', token], (p) => p.hogar.invitacion(token));
  const [nombre, setNombre] = useState('');
  const [diezmo, setDiezmo] = useState(false);
  const [error, setError] = useState('');

  async function unirme() {
    setError('');
    try {
      sesion.establecer(await puertos.hogar.aceptar(token, nombre, diezmo));
      router.replace('/hoy');
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  if (inv.isLoading) return <Pantalla demo={false}><Texto v="pequeno">Cargando invitación…</Texto></Pantalla>;
  if (!inv.data) {
    return (
      <Pantalla demo={false} style={{ paddingTop: 96, alignItems: 'center', gap: 16 }}>
        <Texto v="titulo" style={{ textAlign: 'center' }}>Esta invitación ya no sirve</Texto>
        <Texto style={{ color: colors.secundario, textAlign: 'center' }}>Se usó o venció (duran 7 días). Pide a quien te invitó que la reenvíe.</Texto>
        <Boton titulo="Ir al acceso" onPress={() => router.replace('/acceso')} />
      </Pantalla>
    );
  }
  const i = inv.data;
  return (
    <Pantalla demo={false} style={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, gap: 24 }}>
      <View style={{ marginTop: 24, alignItems: 'center', gap: 16 }}>
        <View style={{ flexDirection: 'row' }}>
          {i.miembros.map((m, k) => (
            <Avatar key={m.id} inicial={m.inicial} variante={k === 0 ? 'fuerte' : 'suave'} tamano={56} style={k ? { marginLeft: -14, borderWidth: 3, borderColor: colors.fondo } : undefined} />
          ))}
          <Avatar inicial={(nombre.trim().charAt(0) || i.email.charAt(0)).toUpperCase()} variante="suave" tamano={56} style={{ marginLeft: -14, borderWidth: 3, borderColor: colors.fondo }} />
        </View>
        <Texto v="titulo" accessibilityRole="header" style={{ textAlign: 'center' }}>{i.invitadoPor.nombre} te invitó a {i.hogar}</Texto>
        <Texto style={{ fontSize: 15, lineHeight: 22, color: colors.secundario, textAlign: 'center' }}>
          Van a llevar juntos los gastos del hogar. Tus ingresos siguen siendo tuyos: aquí solo pones lo que aportas.
        </Texto>
      </View>
      <Campo etiqueta="Tu nombre" valor={nombre} onCambio={setNombre} placeholder="Tu nombre" />
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
        <Interruptor titulo="Diezmar de mis aportes" detalle="Opcional · 10% al registrar cada aporte" activo={diezmo} onCambio={setDiezmo} />
      </View>
      <View style={{ gap: 10, padding: 16, borderRadius: 14, backgroundColor: colors.nota }}>
        <Texto style={{ fontSize: 13, fontFamily: fonts.semibold }}>Lo que vas a hacer aquí</Texto>
        <Texto style={{ fontSize: 13, color: colors.textoSuave }}>Marcar lo que pagas · poner un aporte cuando quieras · ver cuánto queda libre en el mes</Texto>
      </View>
      <Aviso texto={error} />
      <View style={{ marginTop: 'auto', gap: 4 }}>
        <Boton titulo="Unirme al hogar" onPress={unirme} />
        <Boton tipo="enlace" titulo="No soy yo" onPress={() => router.replace('/acceso')} />
      </View>
    </Pantalla>
  );
}
