// Push en la app con expo-notifications (spec steward-avisos, "Push en la app"; design D8 de avisos-pagos).
import type { Puertos } from '@steward/domain';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { usePuertos } from './puertos';

/** La categoria del aviso de un solo pago y sus acciones (las define la app; el backend manda `categoryId: "pago"`). */
export const CATEGORIA_PAGO = 'pago';
export const ACCION_PAGADO = 'pagado';
export const ACCION_MANANA = 'manana';

export type EstadoNotificaciones = 'ACTIVADAS' | 'APAGADAS' | 'BLOQUEADAS';

/** Lo que trae el aviso en `data`: el identificador firmado de las acciones y a donde lleva tocarlo. */
interface DatosAviso {
  accion?: string;
  destino?: 'avisos' | 'hoy';
}

let configurada = false;

/** Una vez por arranque: como se muestran en primer plano y la categoria con "Ya lo pagué" y "Recordar mañana". */
export async function configurarNotificaciones(): Promise<void> {
  if (configurada) return;
  configurada = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  await Notifications.setNotificationCategoryAsync(CATEGORIA_PAGO, [
    { identifier: ACCION_PAGADO, buttonTitle: 'Ya lo pagué', options: { opensAppToForeground: false } },
    { identifier: ACCION_MANANA, buttonTitle: 'Recordar mañana', options: { opensAppToForeground: false } },
  ]).catch(() => undefined);
}

function idProyecto(): string | undefined {
  return Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
}

async function tokenExpo(): Promise<string | null> {
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId: idProyecto() })).data;
  } catch {
    return null;
  }
}

function estadoDe(p: Notifications.NotificationPermissionsStatus): EstadoNotificaciones {
  const ios = p.ios?.status;
  if (ios === Notifications.IosAuthorizationStatus.AUTHORIZED || ios === Notifications.IosAuthorizationStatus.PROVISIONAL || ios === Notifications.IosAuthorizationStatus.EPHEMERAL) return 'ACTIVADAS';
  if (ios === Notifications.IosAuthorizationStatus.DENIED || (!p.granted && !p.canAskAgain)) return 'BLOQUEADAS';
  return p.granted ? 'ACTIVADAS' : 'APAGADAS';
}

/** El estado del permiso en este celular, y activarlas: pide el permiso (no al abrir la app) y registra el token. */
export function useNotificaciones() {
  const puertos = usePuertos();
  const [estado, setEstado] = useState<EstadoNotificaciones>('APAGADAS');
  const [error, setError] = useState('');

  useEffect(() => {
    void Notifications.getPermissionsAsync().then((p) => setEstado(estadoDe(p))).catch(() => undefined);
  }, []);

  const activar = useCallback(async (): Promise<boolean> => {
    setError('');
    try {
      const p = await Notifications.requestPermissionsAsync();
      const nuevo = estadoDe(p);
      setEstado(nuevo);
      if (nuevo !== 'ACTIVADAS') return false;
      const token = await tokenExpo();
      if (!token) throw new Error('No se pudo registrar este celular para los avisos.');
      await puertos.avisos.registrarDispositivo({ tipo: 'EXPO', token });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron activar las notificaciones.');
      return false;
    }
  }, [puertos]);

  return { estado, activar, error };
}

/** Al cerrar sesion o eliminar la cuenta: este celular deja de recibir los avisos de la persona. */
export async function quitarEsteCelular(puertos: Puertos): Promise<void> {
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  if (!p || estadoDe(p) !== 'ACTIVADAS') return;
  const token = await tokenExpo();
  if (token) await puertos.avisos.quitarDispositivo(token).catch(() => undefined);
}

/** Responde a un aviso tocado o a una de sus acciones. */
async function responder(puertos: Puertos, r: Notifications.NotificationResponse): Promise<void> {
  const datos = (r.notification.request.content.data ?? {}) as DatosAviso;
  if (r.actionIdentifier === ACCION_PAGADO || r.actionIdentifier === ACCION_MANANA) {
    if (datos.accion) await puertos.avisos.responderAccion(datos.accion, r.actionIdentifier === ACCION_PAGADO ? 'PAGADO' : 'MANANA').catch(() => undefined);
    return;
  }
  router.push(datos.destino === 'hoy' ? '/hoy' : '/avisos');
}

/**
 * Escucha los avisos tocados mientras hay sesion. Tambien atiende el que abrio la app (o la desperto con una accion),
 * porque iOS no siempre corre JS en segundo plano por una accion (docs de expo-notifications, SDK 57).
 */
export function OyenteNotificaciones(): null {
  const puertos = usePuertos();
  useEffect(() => {
    void configurarNotificaciones();
    let vivo = true;
    void Notifications.getLastNotificationResponseAsync()
      .then(async (r) => {
        if (!r || !vivo) return;
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        await responder(puertos, r);
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      void responder(puertos, r);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    });
    return () => {
      vivo = false;
      sub.remove();
    };
  }, [puertos]);
  return null;
}
