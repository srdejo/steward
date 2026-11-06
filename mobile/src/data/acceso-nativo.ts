import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { ReglaError } from '@steward/domain';
import type { PuertosConectados, ResultadoLogin } from '@steward/domain/conectado';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { Alert } from 'react-native';

export const URL_PRIVACIDAD = 'https://srdejo.github.io/steward-privacy';

/** Clave de la v1 en este dispositivo: solo se comprueba que exista, nunca se escribe ni se borra. */
export const CLAVE_V1 = '@steward/budget_v3';
const AVISO_VISTO = 'steward/aviso-v1-visto';
const ENTRO_CON_APPLE = 'steward/entro-con-apple';

function esCancelado(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED';
}

/** Google nativo (design D3 de app-movil-conectada). El client web sale del backend; null si se cancela. */
export async function entrarConGoogle(p: PuertosConectados): Promise<ResultadoLogin | null> {
  const { googleClientId } = await p.configAcceso();
  if (!googleClientId) throw new ReglaError('GOOGLE_NO_CONFIGURADO', 'El acceso con Google no está disponible');
  GoogleSignin.configure({ webClientId: googleClientId, iosClientId: Constants.expoConfig?.extra?.googleIosClientId });
  const respuesta = await GoogleSignin.signIn();
  if (!isSuccessResponse(respuesta)) return null;
  if (!respuesta.data.idToken) throw new ReglaError('GOOGLE_TOKEN_INVALIDO', 'No pudimos verificar tu cuenta de Google. Intenta de nuevo.');
  await AsyncStorage.removeItem(ENTRO_CON_APPLE);
  return p.iniciarConGoogle(respuesta.data.idToken);
}

/** Sign in with Apple (design D4); el nombre solo llega la primera vez. Null si se cancela. */
export async function entrarConApple(p: PuertosConectados): Promise<ResultadoLogin | null> {
  try {
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!c.identityToken) throw new ReglaError('APPLE_TOKEN_INVALIDO', 'No pudimos verificar tu cuenta de Apple. Intenta de nuevo.');
    const nombre = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    await AsyncStorage.setItem(ENTRO_CON_APPLE, '1');
    return await p.iniciarConApple(c.identityToken, nombre);
  } catch (e) {
    if (esCancelado(e)) return null;
    throw e;
  }
}

/**
 * Para eliminar la cuenta: quien entro con Apple se autentica otra vez, y ese codigo revoca su acceso (design D5).
 * `cancelado`: decidio no seguir. Quien entro con Google no necesita nada.
 */
export async function codigoParaEliminar(): Promise<{ cancelado: boolean; codigo?: string }> {
  if ((await AsyncStorage.getItem(ENTRO_CON_APPLE)) === null) return { cancelado: false };
  try {
    const c = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return { cancelado: false, codigo: c.authorizationCode ?? undefined };
  } catch (e) {
    if (esCancelado(e)) return { cancelado: true };
    throw e;
  }
}

/** Una sola vez, a quien trae datos de la v1 (design D8). */
export async function avisarSiVieneDeLaV1(): Promise<void> {
  const [v1, visto] = await Promise.all([AsyncStorage.getItem(CLAVE_V1), AsyncStorage.getItem(AVISO_VISTO)]);
  if (v1 === null || visto !== null) return;
  await AsyncStorage.setItem(AVISO_VISTO, '1');
  Alert.alert(
    'Esta versión empieza de cero',
    'Ahora tu presupuesto se guarda en la nube y se comparte con tu hogar. Lo que tenías en la versión anterior no se pasa a esta, pero sigue guardado en este teléfono.',
  );
}
