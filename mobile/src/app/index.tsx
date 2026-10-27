import { Redirect } from 'expo-router';

/** La raiz abre Hoy; las rutas protegidas del layout llevan a Acceso u onboarding si hace falta. */
export default function Inicio() {
  return <Redirect href="/hoy" />;
}
