import { Redirect } from 'expo-router';

/** Espacio del + en la barra (ver `_layout.tsx`): no es una pantalla; si se llega por enlace, abre Agregar. */
export default function Nuevo() {
  return <Redirect href="/agregar" />;
}
