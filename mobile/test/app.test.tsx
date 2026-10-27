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

describe('Planear (steward-planear)', () => {
  it('cerrar octubre reparte el sobrante y lo pasa a noviembre', async () => {
    const p = await conSesion();
    const OCT = { anio: 2026, mes: 10 };
    const pagar = (itemId: string, monto: number) => p.movimientos.marcarPago({ itemId, ref: OCT, monto, usuarioId: 'u-daniel', origen: { tipo: 'CUENTA', cuentaId: 'cta-davivienda' } });
    await pagar('m0-mastercard', 1_500_000);
    await pagar('m0-cuotas', 375_000);
    await p.movimientos.registrarGasto({ monto: 140_000, itemId: 'm0-mercado', nota: '', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    await p.movimientos.registrarGasto({ monto: 112_000, itemId: null, nota: 'Farmacia', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    const diezmo = (await p.movimientos.resumenMes(OCT)).diezmo.pendientes[0]!;
    await p.ingresos.entregarDiezmo([diezmo.id], OCT, null);
    await p.cuentas.cuadrar([{ cuentaId: 'cta-nu', saldoBanco: 3_190_000 }, { cuentaId: 'cta-efectivo', saldoBanco: 150_000 }]);

    renderRouter('./src/app', { initialUrl: '/cierre/2026-10' });
    await waitFor(() => expect(screen.getByTestId('sobrante')).toHaveTextContent('$3.166.000'));
    expect(screen.getByText('El plan esperaba $2.898.000 libres.')).toBeTruthy();
    await escribir('A ahorro', '2000000');
    expect(await screen.findByTestId('aviso-reparto')).toBeTruthy();
    await escribir('Pasar a noviembre', '1166000');
    await tocar('Cerrar octubre');
    await enRuta('/mes/2026-11');
    await waitFor(() => expect(screen.getByTestId('dejaria-libre')).toHaveTextContent('$4.064.000'));
    expect(screen.getByText('Sobrante de octubre')).toBeTruthy();
  });

  it('duplicar crea una opción nueva y el diezmo no se edita', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/mes/2026-11' });
    await waitFor(() => expect(screen.getByTestId('dejaria-libre')).toHaveTextContent('$2.898.000'));
    expect(screen.getByTestId('fila-diezmo')).toHaveTextContent(/Calculado · 10% de Salario Daniel/);
    await tocar('+ Duplicar');
    expect(await screen.findByText('Opción D')).toBeTruthy();
    expect((await p.plan.mes({ anio: 2026, mes: 11 })).opciones).toHaveLength(4);
  });
});

describe('Cuentas (steward-cuentas)', () => {
  it('cuadrar muestra la diferencia en vivo y la guarda como ajuste', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/cuadrar' });
    await escribir('Banco dice · Davivienda', '3980000');
    await escribir('Hay en la billetera · Efectivo', '150000');
    await escribir('Banco dice · Nu', '3360000');
    await waitFor(() => expect(screen.getByTestId('sin-registrar')).toHaveTextContent('$220.000'));
    expect(screen.getByTestId('cuadrar-Davivienda')).toHaveTextContent(/−\$170\.000/);
    expect(screen.getByTestId('cuadrar-Nu')).toHaveTextContent(/Cuadra/);
    await tocar('Guardar saldos');
    await waitFor(async () => expect((await p.cierre.vista({ anio: 2026, mes: 10 })).sinRegistrar).toBe(220_000));
  });

  it('detalle de crédito con el simulador del diseño', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/credito/cred-libre' });
    await waitFor(() => expect(screen.getByTestId('simulacion')).toHaveTextContent('≈ 5 cuotas menos y ≈ $1.200.000 menos en intereses.'));
    expect(screen.getByText('Faltan 38 cuotas')).toBeTruthy();
  });
});

describe('Ajustes (steward-ajustes)', () => {
  it('ocultar montos muestra $•••• hasta tocar', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/ajustes' });
    expect(await screen.findByText('Esposa')).toBeTruthy();
    fireEvent(await screen.findByLabelText('Ocultar montos'), 'valueChange', true);
    await waitFor(async () => expect((await screen.findByLabelText('Ocultar montos')).props.value).toBe(true));
  });

  it('con montos ocultos, Hoy muestra $•••• y al tocarlo el valor', async () => {
    const p = await conSesion();
    await p.sesion.guardarPreferencias({ ocultarMontos: true });
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$••••'));
    fireEvent.press(screen.getByTestId('libre'));
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
  });
});

export { conSesion };
