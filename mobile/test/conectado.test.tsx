import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

import { avisarSiVieneDeLaV1, CLAVE_V1 } from '@/data/acceso-nativo';
import { TokenKeychain, TransporteFetch } from '@/data/conectado';

/** app-movil-conectada: el transporte de la app, la sesion en el Keychain y el aviso a quien viene de la v1. */
describe('capa conectada de la app', () => {
  const respuesta = (status: number, cuerpo?: unknown) => ({ ok: status < 400, status, text: async () => (cuerpo === undefined ? '' : JSON.stringify(cuerpo)) });
  let fetchFalso: jest.Mock;

  beforeEach(async () => {
    fetchFalso = jest.fn();
    globalThis.fetch = fetchFalso as unknown as typeof fetch;
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  function transporte(token: string | null, alExpirar = jest.fn()) {
    const tokens = new TokenKeychain();
    if (token) tokens.guardar(token);
    return { t: new TransporteFetch('https://api.prueba', tokens, alExpirar), tokens, alExpirar };
  }

  it('manda la sesión y devuelve el cuerpo', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, { id: 'x' }));
    const { t } = transporte('jwt');
    await expect(t.pedir('POST', '/api/gastos', { monto: 1 })).resolves.toEqual({ id: 'x' });
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://api.prueba/api/gastos');
    expect(opciones.headers.Authorization).toBe('Bearer jwt');
    expect(opciones.body).toBe('{"monto":1}');
  });

  it('el login no lleva sesión, y un 204 no tiene cuerpo', async () => {
    fetchFalso.mockResolvedValue(respuesta(204));
    const { t } = transporte('jwt');
    await expect(t.pedir('POST', '/api/auth/apple', {})).resolves.toBeUndefined();
    expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('un error del backend llega como ReglaError con su código', async () => {
    fetchFalso.mockResolvedValue(respuesta(409, { codigo: 'YA_PAGADO', mensaje: 'Ya lo pagó Ana' }));
    await expect(transporte('jwt').t.pedir('POST', '/api/pagos', {})).rejects.toMatchObject({ codigo: 'YA_PAGADO', message: 'Ya lo pagó Ana' });
  });

  it('sin red dice que no hay conexión', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Network request failed'));
    await expect(transporte('jwt').t.pedir('GET', '/api/sesion')).rejects.toMatchObject({ codigo: 'SIN_CONEXION' });
  });

  it('un 401 borra la sesión y avisa', async () => {
    fetchFalso.mockResolvedValue(respuesta(401, { codigo: 'NO_AUTENTICADO' }));
    const { t, tokens, alExpirar } = transporte('jwt');
    await expect(t.pedir('GET', '/api/sesion')).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });
    expect(tokens.leer()).toBeNull();
    expect(alExpirar).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('el token vuelve del Keychain al arrancar', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('guardado');
    const tokens = new TokenKeychain();
    await tokens.cargar();
    expect(tokens.leer()).toBe('guardado');
  });

  it('avisa una vez a quien viene de la v1, sin tocar sus datos', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await AsyncStorage.setItem(CLAVE_V1, '{"datos":1}');
    await avisarSiVieneDeLaV1();
    await avisarSiVieneDeLaV1();
    expect(alerta).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(CLAVE_V1)).toBe('{"datos":1}');
  });

  it('sin datos de la v1 no avisa', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await avisarSiVieneDeLaV1();
    expect(alerta).not.toHaveBeenCalled();
  });
});
