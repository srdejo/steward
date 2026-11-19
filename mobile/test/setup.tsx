/* Mocks de modulos nativos para montar la app en Jest (pruebas de recorrido en test/). */

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 2 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
}));

// Push en la app (avisos-pagos): sin permiso concedido en las pruebas.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true, status: 'undetermined', ios: { status: 0 } })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted', ios: { status: 2 } })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[prueba]' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));
