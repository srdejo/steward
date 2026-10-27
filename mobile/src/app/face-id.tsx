import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useSesion } from '@/data/sesion';
import { Boton, colors, fonts, Icono, Interruptor, Pantalla, Texto } from '@/ui';

/** FaceId.dc.html. En modo demo solo guarda la preferencia: no llama a la biometria del sistema. */
export default function FaceId() {
  const sesion = useSesion();
  const [alAbrir, setAlAbrir] = useState(true);

  async function seguir(activar: boolean) {
    await sesion.guardarPreferencias({ faceIdAlAbrir: activar && alAbrir });
    router.replace('/onboarding/1');
  }

  return (
    <Pantalla demo={false} style={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, gap: 28 }}>
      <View style={{ marginTop: 80, alignItems: 'center', gap: 20 }}>
        <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: colors.acentoSuave, alignItems: 'center', justifyContent: 'center' }}>
          <Icono nombre="rostro" tamano={44} color={colors.acento} />
        </View>
        <Texto accessibilityRole="header" style={{ fontSize: 26, lineHeight: 31, fontFamily: fonts.bold, textAlign: 'center' }}>Entra con tu cara la próxima vez</Texto>
        <Texto style={{ fontSize: 15, lineHeight: 22, color: colors.secundario, textAlign: 'center' }}>
          Guardamos una llave de acceso en este dispositivo. Sin contraseñas que recordar, y en la web funciona igual con Touch ID o Windows Hello.
        </Texto>
      </View>
      <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
        <Interruptor titulo="Pedir Face ID al abrir la app" detalle="Después de 5 min sin usarla" activo={alAbrir} onCambio={setAlAbrir} />
      </View>
      <View style={{ marginTop: 'auto', gap: 6 }}>
        <Boton titulo="Activar Face ID" onPress={() => seguir(true)} />
        <Boton tipo="enlace" titulo="Ahora no" onPress={() => seguir(false)} />
      </View>
    </Pantalla>
  );
}
