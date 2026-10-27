import type { MetodoAcceso, Preferencias, Sesion } from '@steward/domain';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { usePuertos } from './puertos';

interface EstadoSesion {
  cargando: boolean;
  sesion: Sesion | null;
  preferencias: Preferencias;
  iniciar(metodo: MetodoAcceso): Promise<Sesion>;
  establecer(s: Sesion | null): void;
  recargar(): Promise<void>;
  cerrar(): Promise<void>;
  guardarPreferencias(cambios: Partial<Preferencias>): Promise<void>;
}

const SesionContexto = createContext<EstadoSesion | null>(null);
const SIN_PREFERENCIAS: Preferencias = { faceIdAlAbrir: false, ocultarMontos: false };

/** Sesion actual (en modo demo, la del adaptador de prueba). La raiz decide con ella entre acceso y app. */
export function SesionProvider({ children }: { children: ReactNode }) {
  const puertos = usePuertos();
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<Sesion | null>(null);

  const recargar = useCallback(async () => {
    setSesion(await puertos.sesion.actual());
  }, [puertos]);

  useEffect(() => {
    recargar().finally(() => setCargando(false));
  }, [recargar]);

  const valor = useMemo<EstadoSesion>(
    () => ({
      cargando,
      sesion,
      preferencias: sesion?.preferencias ?? SIN_PREFERENCIAS,
      async iniciar(metodo) {
        const s = await puertos.sesion.iniciar(metodo);
        setSesion(s);
        return s;
      },
      establecer: setSesion,
      recargar,
      async cerrar() {
        await puertos.sesion.cerrar();
        setSesion(null);
      },
      async guardarPreferencias(cambios) {
        const preferencias = await puertos.sesion.guardarPreferencias(cambios);
        setSesion((s) => (s ? { ...s, preferencias } : s));
      },
    }),
    [cargando, sesion, puertos, recargar],
  );
  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export function useSesion(): EstadoSesion {
  const s = useContext(SesionContexto);
  if (!s) throw new Error('useSesion fuera de SesionProvider');
  return s;
}
