// Matchers que registra expo-router/testing-library pero que su paquete no declara para TypeScript.
declare global {
  namespace jest {
    interface Matchers<R> {
      toHavePathname(pathname: string): R;
      toHaveSegments(segments: string[]): R;
    }
  }
}

export {};
