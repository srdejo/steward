import type { MetodoAcceso } from '@steward/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { mensajeDeError } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Aviso, Boton, colors, fonts, Icono, Pantalla, Texto } from '@/ui';

/** Acceso.dc.html: una sola pantalla para entrar o crear cuenta. En modo demo, cualquier opcion entra. */
export default function Acceso() {
  const sesion = useSesion();
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(metodo: MetodoAcceso) {
    setEntrando(true);
    setError('');
    try {
      const s = await sesion.iniciar(metodo);
      router.replace(s.hogarConfigurado ? '/hoy' : '/face-id');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEntrando(false);
    }
  }

  return (
    <Pantalla demo={false} style={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, gap: 32 }}>
      <View style={{ marginTop: 40, gap: 16 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.acento, alignItems: 'center', justifyContent: 'center' }}>
          <Icono nombre="casa" tamano={28} color="#FFFFFF" />
        </View>
        <Texto accessibilityRole="header" style={{ fontSize: 30, lineHeight: 35, fontFamily: fonts.bold }}>Presupuesto Hogar</Texto>
        <Texto style={{ fontSize: 16, lineHeight: 23, color: colors.secundario }}>Planeen el mes juntos y lleven lo que de verdad pasa.</Texto>
      </View>

      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Boton
          tipo="secundario"
          titulo="Continuar con Google"
          deshabilitado={entrando}
          onPress={() => entrar('GOOGLE')}
          style={{ borderColor: '#D9D8D2' }}
          icono={
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
              <Path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
              <Path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.2a11 11 0 0 0 0 9.9z" />
              <Path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
            </Svg>
          }
        />
        <Boton titulo="Entrar con Face ID" deshabilitado={entrando} onPress={() => entrar('FACE_ID')} icono={<Icono nombre="rostro" tamano={20} color="#FFFFFF" />} />
        <Boton tipo="enlace" titulo="Continuar con correo" deshabilitado={entrando} onPress={() => entrar('CORREO')} />
        <Aviso texto={error} />
      </View>

      <View style={{ gap: 6 }}>
        <Texto style={{ fontSize: 13, lineHeight: 19, color: colors.secundario, textAlign: 'center' }}>
          Si es tu primera vez, se crea tu cuenta. Si te invitaron, entra con el correo de la invitación.
        </Texto>
        <Texto v="detalle" style={{ textAlign: 'center' }}>Al continuar aceptas los Términos y la Privacidad (próximamente).</Texto>
      </View>
    </Pantalla>
  );
}
