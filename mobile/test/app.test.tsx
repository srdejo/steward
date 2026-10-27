/**
 * Pruebas de recorrido de la app completa (rutas reales de src/app) sobre el adaptador de prueba con reloj fijo:
 * las mismas cifras que los tests de la PWA (spec steward-mobile-app: paridad).
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { conSesion, puertosDePrueba } from './demo';

// La primera prueba compila toda la app: mas margen que los 5 s por defecto.
jest.setTimeout(30_000);

const tocar = async (texto: string | RegExp) => fireEvent.press(await screen.findByText(texto));
const escribir = async (etiqueta: string, valor: string) => fireEvent.changeText(await screen.findByLabelText(etiqueta), valor);
const enRuta = (ruta: string) => waitFor(() => expect(screen).toHavePathname(ruta));

describe('acceso y onboarding', () => {
  it('primer acceso → Face ID → cinco pasos → Hoy', async () => {
    const p = puertosDePrueba();
    await p.demo!.probarDesdeCero();
    renderRouter('./src/app', { initialUrl: '/' });

    await tocar('Continuar con Google');
    await enRuta('/face-id');
    await tocar('Ahora no');
    await enRuta('/onboarding/1');

    await escribir('Nombre del hogar', 'Nuestra casa');
    await tocar('Continuar');
    await enRuta('/onboarding/2');
    await tocar('Continuar');
    await enRuta('/onboarding/3');

    await escribir('Bruto', '7000000');
    await escribir('Entra (neto)', '6288000');
    await escribir('Día de pago', '25');
    expect(await screen.findByTestId('vista-previa-diezmo')).toHaveTextContent(/\$700\.000/);
    await tocar('Continuar');
    await enRuta('/onboarding/4');
    await tocar('Saltar por ahora');
    await enRuta('/onboarding/5');

    await escribir('Correo', 'esposa@ejemplo.com');
    await tocar('Invitar');
    expect(await screen.findByText('Invitación enviada · pendiente')).toBeTruthy();
    await tocar('Empezar');
    await enRuta('/hoy');
    expect((await p.sesion.actual())?.hogarConfigurado).toBe(true);
    expect((await p.ingresos.fijos()).map((f) => [f.nombre, f.bruto, f.neto, f.diaPago])).toEqual([['Salario', 7_000_000, 6_288_000, 25]]);
  });

  it('con el hogar configurado, el acceso va directo a Hoy', async () => {
    puertosDePrueba();
    renderRouter('./src/app', { initialUrl: '/' });
    await tocar('Continuar con correo');
    await enRuta('/hoy');
  });

  it('unirse desde una invitación deja al invitado como miembro', async () => {
    const p = puertosDePrueba();
    await p.demo!.probarDesdeCero();
    await p.sesion.iniciar('GOOGLE');
    await p.hogar.nombrar('Nuestra casa');
    await p.hogar.completarOnboarding();
    const inv = await p.hogar.invitar('esposa@ejemplo.com');
    await p.sesion.cerrar();

    renderRouter('./src/app', { initialUrl: `/invitacion/${inv.token}` });
    expect(await screen.findByText('Daniel te invitó a Nuestra casa')).toBeTruthy();
    await escribir('Tu nombre', 'Ana');
    await tocar('Unirme al hogar');
    await enRuta('/hoy');
    expect((await p.hogar.obtener()).miembros.map((m) => m.usuario.nombre)).toEqual(['Daniel', 'Ana']);
  });
});

describe('Hoy (steward-hoy)', () => {
  it('muestra el resumen de los datos de ejemplo', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
    expect(screen.getByText('$5.390.000')).toBeTruthy();
    expect(screen.getByText('$2.613.000')).toBeTruthy();
    expect(screen.getByText('−$62.000')).toBeTruthy();
    expect(screen.getByText('2 aportes · 1 pago directo')).toBeTruthy();
  });

  it('pago directo desde "Su cuenta" cuenta como aporte de quien pagó', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await tocar('Tarjeta Mastercard');
    await enRuta('/pagar/m0-mastercard');
    expect(await screen.findByLabelText('Valor pagado')).toHaveDisplayValue('$1.500.000');
    await tocar('Esposa');
    await tocar('Su cuenta');
    expect(await screen.findByTestId('aviso-su-cuenta')).toHaveTextContent(/aporte de Esposa en octubre/);
    await tocar('Marcar pagado');
    await enRuta('/hoy');
    expect(await screen.findByText('2 aportes · 2 pagos directos')).toBeTruthy();
    expect(screen.getByText('$4.038.000')).toBeTruthy();
    expect(screen.getByTestId('pagado-Tarjeta Mastercard')).toHaveTextContent(/E$/);
  });

  it('un fijo ya pagado avisa quién y cuándo', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/pagar/m0-luz' });
    expect(await screen.findByTestId('ya-pagado')).toHaveTextContent('Ya lo pagó Esposa el 12 oct');
  });

  it('gasto variable acumula contra su presupuesto', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/gasto?item=m0-mercado' });
    await escribir('¿Cuánto?', '40000');
    expect(await screen.findByTestId('vista-previa-gasto')).toHaveTextContent('Mercado: llevas $220.000 de $320.000 con este gasto.');
    await tocar('Guardar gasto');
    expect(await screen.findByText('Variable · llevas $220.000 de $320.000')).toBeTruthy();
  });
});

export { conSesion };
