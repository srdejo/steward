import { Redirect } from 'expo-router';

import { useSesion } from '@/data/sesion';

/** Al abrir: sin sesion, Acceso; con el hogar sin configurar, el onboarding; si no, Hoy del mes en curso. */
export default function Inicio() {
  const { sesion } = useSesion();
  if (!sesion) return <Redirect href="/acceso" />;
  if (!sesion.hogarConfigurado) return <Redirect href="/onboarding/1" />;
  return <Redirect href="/hoy" />;
}
