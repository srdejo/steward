import AsyncStorage from '@react-native-async-storage/async-storage';
import { keepPreviousData, QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReglaError, type Puertos } from '@steward/domain';
import { crearAdaptadorDemo } from '@steward/domain/demo';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Los puertos de datos de la app (design D2). Las pantallas solo usan `usePuertos()`, `useConsulta()` y
 * `useAccion()`; cual adaptador los cumple se decide aqui. Hoy: el de prueba sobre AsyncStorage, con la clave
 * `steward-demo/v1` (la v1 de la app usa `@steward/budget_v3` y nunca se toca).
 */
export function crearPuertosDemo(ahora?: () => Date): Puertos {
  return crearAdaptadorDemo({ storage: AsyncStorage, ahora });
}

const PuertosContexto = createContext<Puertos | null>(null);

export function usePuertos(): Puertos {
  const p = useContext(PuertosContexto);
  if (!p) throw new Error('usePuertos fuera de DatosProvider');
  return p;
}

/** Provee los puertos y un QueryClient que se invalida entero tras cada escritura del adaptador. */
export function DatosProvider({ puertos, children }: { puertos: Puertos; children: ReactNode }) {
  const [cliente] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { gcTime: Infinity } } }));
  useEffect(() => puertos.suscribir(() => void cliente.invalidateQueries()), [puertos, cliente]);
  return (
    <PuertosContexto.Provider value={puertos}>
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    </PuertosContexto.Provider>
  );
}

/** Lectura de un puerto. Conserva el valor anterior mientras recarga (sin parpadeo tras una escritura). */
export function useConsulta<T>(clave: readonly unknown[], leer: (p: Puertos) => Promise<T>) {
  const puertos = usePuertos();
  return useQuery({ queryKey: clave, queryFn: () => leer(puertos), placeholderData: keepPreviousData });
}

/** Escritura con su error listo para mostrar (las reglas traen texto; lo demas es tecnico). */
export function useAccion() {
  const puertos = usePuertos();
  const cliente = useQueryClient();
  const m = useMutation({
    mutationFn: (accion: (p: Puertos) => Promise<unknown>) => accion(puertos),
    onSettled: () => cliente.invalidateQueries(),
  });
  return {
    ejecutar: (accion: (p: Puertos) => Promise<unknown>) => m.mutateAsync(accion).then(() => true, () => false),
    ocupado: m.isPending,
    error: m.error ? mensajeDeError(m.error) : '',
    limpiar: m.reset,
  };
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof ReglaError || (error instanceof Error && error.name === 'ReglaError')) return (error as Error).message;
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo guardar. Intenta de nuevo.';
}
