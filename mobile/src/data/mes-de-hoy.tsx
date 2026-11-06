import AsyncStorage from '@react-native-async-storage/async-storage';
import { claveMes, mesDe, nombreMes, nombreMesCapital, sumarMeses, type MesRef } from '@steward/domain';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { colors, fonts, Texto, type Opcion } from '@/ui';
import { usePuertos } from './puertos';

const CLAVE = 'steward/mes-hoy';

interface MesDeHoy {
  ref: MesRef;
  clave: string;
  opciones: Opcion<string>[];
  /** "Se registra en noviembre" cuando no es el mes en curso. */
  aviso: string;
  elegir(clave: string): void;
  seEjecuta(ref: MesRef): boolean;
}

const Contexto = createContext<MesDeHoy | null>(null);

/**
 * El mes que se ejecuta en Hoy: el mes en curso o el siguiente (design D2 de plan-mes-siguiente). Se recuerda en el
 * dispositivo; si lo recordado ya no es uno de los dos, vuelve al mes en curso.
 */
export function MesDeHoyProvider({ children }: { children: ReactNode }) {
  const enCurso = mesDe(usePuertos().hoy());
  const siguiente = sumarMeses(enCurso, 1);
  const claveSiguiente = claveMes(siguiente);
  const [clave, setClave] = useState(claveMes(enCurso));

  useEffect(() => {
    void AsyncStorage.getItem(CLAVE).then((g) => {
      if (g === claveSiguiente) setClave(g);
    });
  }, [claveSiguiente]);

  const valor = useMemo<MesDeHoy>(() => {
    const esSiguiente = clave === claveSiguiente;
    const meses = [enCurso, siguiente];
    return {
      ref: esSiguiente ? siguiente : enCurso,
      clave,
      opciones: meses.map((m) => ({ valor: claveMes(m), etiqueta: nombreMesCapital(m.mes) })),
      aviso: esSiguiente ? `Se registra en ${nombreMes(siguiente.mes)}` : '',
      elegir(c) {
        setClave(c);
        void AsyncStorage.setItem(CLAVE, c);
      },
      seEjecuta: (r) => meses.some((m) => claveMes(m) === claveMes(r)),
    };
    // enCurso y siguiente dependen solo de estas claves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, claveSiguiente]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMesDeHoy(): MesDeHoy {
  const m = useContext(Contexto);
  if (!m) throw new Error('useMesDeHoy fuera de MesDeHoyProvider');
  return m;
}

/** Lo que dicen las hojas de Hoy cuando no es el mes en curso. */
export function AvisoMes() {
  const { aviso } = useMesDeHoy();
  if (!aviso) return null;
  return (
    <Texto testID="aviso-mes" style={{ borderRadius: 12, backgroundColor: colors.acentoSuave, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, fontFamily: fonts.medium, color: colors.acento }}>
      {aviso}
    </Texto>
  );
}
