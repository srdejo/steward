import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { conSesion } from './demo';

const enRuta = (ruta: string) => waitFor(() => expect(screen).toHavePathname(ruta));

/** Spec steward-ui-shell "Navegación principal" y steward-hoy "Agregar desde un solo botón" (rediseno-libreta-clara). */
describe('Barra y Agregar en la app', () => {
  it('la barra tiene Hoy, Planear, el +, Cuentas y Ajustes', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    expect(await screen.findByTestId('agregar')).toBeTruthy();
    for (const nombre of ['Hoy', 'Planear', 'Cuentas', 'Ajustes']) expect(screen.getAllByText(nombre).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Agregar gasto, aporte o pago')).toBeTruthy();
  });

  it('el + abre Agregar en Gasto; guardar vuelve a la pestaña donde estaba', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/planear' });
    fireEvent.press(await screen.findByTestId('agregar'));
    await enRuta('/agregar');
    expect(screen.getByTestId('pestana-gasto')).toHaveProp('accessibilityState', { selected: true });
    fireEvent.changeText(await screen.findByLabelText('¿Cuánto?'), '40000');
    fireEvent.press(await screen.findByText('Guardar gasto'));
    await enRuta('/planear');
  });

  it('la pestaña Pago lista lo pendiente y abre el elegido', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/agregar?tipo=pago' });
    fireEvent.press(await screen.findByTestId('pendiente-Tarjeta Nu · Mercado'));
    expect(await screen.findByTestId('pago-elegido')).toHaveTextContent(/Tarjeta Nu · Mercado/);
    expect(await screen.findByLabelText('Valor pagado')).toBeTruthy();
  });

  it('"+ Aporte" de Hoy abre Agregar en Aporte', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    fireEvent.press(await screen.findByText('+ Aporte'));
    await enRuta('/agregar');
    expect(await screen.findByText('Guardar aporte')).toBeTruthy();
    expect(screen.getByTestId('pestana-aporte')).toHaveProp('accessibilityState', { selected: true });
  });
});
