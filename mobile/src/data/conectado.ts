import AsyncStorage from '@react-native-async-storage/async-storage';
import { Api, errorDeApi, PuertosConectados, type MetodoHttp, type TokenSesion, type Transporte } from '@steward/domain/conectado';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const CLAVE = 'steward.sesion';

export const API_URL: string = Constants.expoConfig?.extra?.apiUrl ?? 'https://steward.srdejo.com.co';

/**
 * Token de la sesion en el Keychain (design D2 de app-movil-conectada). La capa conectada lo lee de forma sincrona: se carga
 * al arrancar y se mantiene una copia en memoria.
 */
export class TokenKeychain implements TokenSesion {
  private valor: string | null = null;

  async cargar(): Promise<void> {
    try {
      this.valor = await SecureStore.getItemAsync(CLAVE);
    } catch {
      this.valor = null;
    }
  }

  leer(): string | null {
    return this.valor;
  }

  guardar(token: string): void {
    this.valor = token;
    void SecureStore.setItemAsync(CLAVE, token).catch(() => undefined);
  }

  borrar(): void {
    this.valor = null;
    void SecureStore.deleteItemAsync(CLAVE).catch(() => undefined);
  }
}

/** La app llega al backend con fetch: agrega la sesion, y un 401 fuera del login la cierra. */
export class TransporteFetch implements Transporte {
  constructor(
    private readonly base: string,
    private readonly tokens: TokenSesion,
    private readonly alExpirar: () => void,
  ) {}

  async pedir<T>(metodo: MetodoHttp, ruta: string, cuerpo?: unknown): Promise<T> {
    const esLogin = ruta.startsWith('/api/auth/');
    const token = esLogin ? null : this.tokens.leer();
    let respuesta: Response;
    try {
      respuesta = await fetch(this.base + ruta, {
        method: metodo,
        headers: { ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
    } catch {
      throw errorDeApi(0, null);
    }
    const texto = await respuesta.text();
    const datos: unknown = texto ? parsear(texto) : undefined;
    if (!respuesta.ok) {
      if (respuesta.status === 401 && token) {
        this.tokens.borrar();
        this.alExpirar();
      }
      throw errorDeApi(respuesta.status, datos);
    }
    return datos as T;
  }
}

function parsear(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

let oyenteExpira: () => void = () => undefined;

/** La sesion vencio mientras se usaba la app: la raiz vuelve a Acceso. */
export function alExpirarSesion(oyente: () => void): void {
  oyenteExpira = oyente;
}

export async function crearPuertosConectados(): Promise<PuertosConectados> {
  const tokens = new TokenKeychain();
  await tokens.cargar();
  return new PuertosConectados({
    api: new Api(new TransporteFetch(API_URL, tokens, () => oyenteExpira())),
    tokens,
    storage: AsyncStorage,
  });
}
