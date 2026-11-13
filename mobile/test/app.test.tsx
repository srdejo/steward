/**
 * Pruebas de recorrido de la app completa (rutas reales de src/app) sobre el adaptador de prueba con reloj fijo:
 * las mismas cifras que los tests de la PWA (spec steward-mobile-app: paridad).
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { conSesion, NOV, OCT, puertosDePrueba } from './demo';

// La primera prueba compila toda la app: mas margen que los 5 s por defecto.
jest.setTimeout(30_000);

const tocar = async (texto: string | RegExp) => fireEvent.press(await screen.findByText(texto));
const escribir = async (etiqueta: string, valor: string) => fireEvent.changeText(await screen.findByLabelText(etiqueta), valor);
const enRuta = (ruta: string) => waitFor(() => expect(screen).toHavePathname(ruta));

describe('acceso y onboarding', () => {
  it('primer acceso → cinco pasos → Hoy', async () => {
    const p = puertosDePrueba();
    await p.demo!.probarDesdeCero();
    renderRouter('./src/app', { initialUrl: '/' });

    await tocar('Continuar con Google');
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
    await tocar('Continuar con Google');
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
    expect(screen.getByTestId('falta-pagar')).toHaveTextContent('Falta pagar$2.715.000');
    expect(screen.getByTestId('por-pagar-total')).toHaveTextContent('$2.715.000');
    expect(screen.getByText('$2.613.000')).toBeTruthy();
    expect(screen.getByText('−$62.000')).toBeTruthy();
    expect(screen.getByText('2 aportes · 1 pago directo')).toBeTruthy();
  });

  it('Por pagar empieza con 3 y Ver 1 más despliega el resto', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
    expect(screen.getByTestId('por-pagar-Tarjeta Mastercard')).toBeTruthy();
    expect(screen.queryByTestId('por-pagar-Mercado')).toBeNull();
    expect(screen.getByTestId('ver-mas')).toHaveTextContent('Ver 1 más · 4 pendientes en total$140.000');
    fireEvent.press(screen.getByTestId('ver-mas'));
    expect(await screen.findByTestId('por-pagar-Mercado')).toBeTruthy();
    expect(screen.queryByTestId('ver-mas')).toBeNull();
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
    fireEvent.press(await screen.findByTestId('ver-mas'));
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
    // El diezmo es un item del plan: se marca pagado como los demas (diezmo-como-gasto).
    await p.movimientos.marcarPago({ itemId: 'm0-diezmo-salario', ref: OCT, monto: 700_000, usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' } });
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

  it('duplicar crea una opción nueva y el diezmo es la categoría Diezmo', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/mes/2026-11' });
    await waitFor(() => expect(screen.getByTestId('dejaria-libre')).toHaveTextContent('$2.898.000'));
    // El diezmo es un item de la categoria Diezmo, sin fila calculada aparte (diezmo-como-gasto).
    expect(screen.queryByTestId('fila-diezmo')).toBeNull();
    expect(screen.getAllByText(/^Diezmo/).length).toBeGreaterThan(0);
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
  it('sin Face ID ni Ocultar montos, y los montos se ven siempre (usabilidad-plan)', async () => {
    const p = await conSesion();
    await p.sesion.guardarPreferencias({ ocultarMontos: true });
    renderRouter('./src/app', { initialUrl: '/ajustes' });
    expect(await screen.findByText('Esposa')).toBeTruthy();
    expect(screen.queryByText('Ocultar montos')).toBeNull();
    expect(screen.queryByText('Face ID al abrir')).toBeNull();
  });

  it('con la preferencia guardada, los montos no se ocultan (usabilidad-plan)', async () => {
    const p = await conSesion();
    await p.sesion.guardarPreferencias({ ocultarMontos: true });
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
  });

  it('empezar de nuevo pide escribir EMPEZAR (usabilidad-plan)', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/ajustes' });
    await tocar('Empezar de nuevo');
    await escribir('Escribe EMPEZAR para confirmar', 'EMPEZAR');
    fireEvent.press(screen.getAllByText('Empezar de nuevo').at(-1)!);
    await enRuta('/mes/2026-10');
    expect((await p.plan.mes(OCT)).estado).toBe('SIN_PLAN');
  });

  it('eliminar mi cuenta pide escribir ELIMINAR y lleva a Acceso (app-movil-conectada)', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/ajustes' });
    await tocar('Eliminar mi cuenta');
    await escribir('Escribe ELIMINAR para confirmar', 'ELIMINAR');
    fireEvent.press(screen.getAllByText('Eliminar mi cuenta').at(-1)!);
    await enRuta('/acceso');
  });
});

describe('Ejecución y Plan (app-movil-conectada)', () => {
  it('el mes siguiente se ejecuta con la fecha real, sin tocar el mes en curso', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
    await tocar('Noviembre');
    await screen.findByText('Noviembre 2026');
    await screen.findByText('Opción A · elige otra en Plan');
    const linea = (await p.movimientos.resumenMes(NOV)).ingresos.find((l) => l.lineaId && !l.recibido)!;
    await tocar('Recibí');
    await screen.findByTestId('aviso-mes');
    await tocar('Marcar recibido');
    await waitFor(async () => expect((await p.movimientos.resumenMes(NOV)).ingresos.find((l) => l.lineaId === linea.lineaId)!.detalle).toContain('26 oct'));
    await tocar('Octubre');
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
  });

  it('borrar un gasto equivocado', async () => {
    const p = await conSesion();
    await p.movimientos.registrarGasto({ monto: 95_000, itemId: null, nota: 'Farmacia (error)', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await tocar('Farmacia (error)');
    await tocar('Borrar este registro');
    await waitFor(() => expect(screen.getByTestId('efecto-borrar')).toHaveTextContent('Pagado baja $95.000'));
    await tocar('Sí, borrar');
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
  });

  it('corregir un pago', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await tocar('Recibo Luz');
    await waitFor(() => expect(screen.getByLabelText('Monto')).toBeTruthy());
    await escribir('Monto', '50000');
    await tocar('Guardar');
    await waitFor(async () => expect((await p.movimientos.resumenMes(OCT)).yaPagado.find((i) => i.item.nombre === 'Recibo Luz')!.real).toBe(50_000));
  });

  it('las hojas del plan guardan al confirmar y el tipo sale de la categoría', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/mes/2026-11' });
    await tocar('+ Gasto');
    await escribir('Nombre', 'Regalo');
    await escribir('Monto', '150000');
    fireEvent.press((await screen.findAllByText('Variables')).at(-1)!);
    await tocar('Guardar');
    await screen.findByTestId('guardado');
    await waitFor(() => expect(screen.getByTestId('dejaria-libre')).toHaveTextContent('$2.748.000'));
    expect((await p.plan.mes(NOV)).opciones[0]!.escenario.items.find((i) => i.nombre === 'Regalo')!.tipo).toBe('VARIABLE');
  });

  it('el mes en curso se edita, sin + Duplicar', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/mes/2026-10' });
    await tocar(/^Variables/);
    await tocar('Mercado');
    expect(screen.queryByText('+ Duplicar')).toBeNull();
    await escribir('Monto', '400000');
    await tocar('Guardar');
    await waitFor(async () => expect((await p.plan.mes(OCT)).opciones[0]!.escenario.items.find((i) => i.nombre === 'Mercado')!.monto).toBe(400_000));
  });

  it('con saldo negativo dice faltarían', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/mes/2026-11' });
    await tocar('+ Gasto');
    await escribir('Nombre', 'Moto');
    await escribir('Monto', '3000000');
    await tocar('Guardar');
    await screen.findByText('Con la Opción A faltarían');
    expect(screen.getByTestId('dejaria-libre')).toHaveTextContent('$102.000');
  });

  it('borrar el plan de un mes dice qué se borra', async () => {
    const p = await conSesion();
    renderRouter('./src/app', { initialUrl: '/mes/2026-11' });
    await tocar('Borrar plan de noviembre');
    await waitFor(() => expect(screen.getByTestId('que-se-borra')).toHaveTextContent(/Se borra el plan de noviembre/));
    await tocar('Borrar plan');
    await screen.findByText(/Aún no tiene plan/);
    expect((await p.plan.mes(NOV)).estado).toBe('SIN_PLAN');
  });

  it('el detalle de una cuenta muestra de dónde sale su saldo', async () => {
    const p = await conSesion();
    await p.cuentas.agregar({ nombre: 'Bancolombia', titularId: null, saldo: 4_000_000 });
    const id = (await p.cuentas.cuentas()).cuentas.find((c) => c.cuenta.nombre === 'Bancolombia')!.cuenta.id;
    await p.movimientos.registrarGasto({ monto: 1_500_000, itemId: null, nota: 'Arriendo', usuarioId: 'u-daniel', origen: { tipo: 'CUENTA', cuentaId: id }, ref: OCT });
    renderRouter('./src/app', { initialUrl: `/cuenta/${id}` });
    await screen.findByText('Arriendo');
    await waitFor(() => expect(screen.getByTestId('saldo-cuenta')).toHaveTextContent('≈ $2.500.000'));
  });
});

describe('planear el año desde un mes (planear-anio-desde-un-mes)', () => {
  it('sin plan del año: replicar octubre, agregar un cambio y verlo en la lista de meses', async () => {
    const p = await conSesion();
    await p.hogar.empezarDeNuevo();
    await p.plan.crearMes({ anio: 2026, mes: 10 }, 'CERO');
    renderRouter('./src/app', { initialUrl: '/planear' });
    await tocar('Planear 2027 ›');
    await enRuta('/anual/2027');
    expect(await screen.findByText(/^Octubre 2026 · /)).toBeTruthy();
    await tocar('Replicar en los 12 meses');
    expect(await screen.findByText('2027: lo que cambia')).toBeTruthy();
    expect(await screen.findByText('Enero a diciembre')).toBeTruthy();
    await tocar('+ Algo distinto');
    await escribir('¿Qué es?', 'SOAT');
    await escribir('¿Cuánto?', '900000');
    await tocar('Mar');
    await tocar('Guardar');
    expect(await screen.findByText('SOAT −$900.000')).toBeTruthy();
    expect(screen.getByText('Lo que cambia · 1')).toBeTruthy();
    expect((await p.plan.anual(2027))!.cambios[0]!.evento).toMatchObject({ nombre: 'SOAT', mes: 3, monto: 900_000 });
  });
});

describe('borrar el plan del año (planear-anio-desde-un-mes)', () => {
  it('dice qué se borra, vuelve a Planear con el año sin plan y los meses creados no cambian', async () => {
    const p = await conSesion();
    await p.plan.crearMesesDesdeAnual(2027);
    const febrero = (await p.plan.mes({ anio: 2027, mes: 2 })).plan;
    renderRouter('./src/app', { initialUrl: '/anual/2027' });
    await tocar('Borrar plan de 2027');
    expect(await screen.findByText('Se borran los montos, 6 cambios y los aportes proyectados de 2027. Los meses ya creados no cambian.')).toBeTruthy();
    await tocar('Sí, borrar plan de 2027');
    await enRuta('/planear');
    expect(await screen.findByText('Año 2027 · Sin plan')).toBeTruthy();
    expect(await p.plan.anual(2027)).toBeNull();
    expect((await p.plan.mes({ anio: 2027, mes: 2 })).plan).toEqual(febrero);
  });
});

describe('paridad con la PWA (steward-mobile-app)', () => {
  it('pagar la Mastercard desde Davivienda y un aporte para noviembre dan las mismas cifras que la PWA', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/hoy' });
    await tocar('Tarjeta Mastercard');
    await tocar('Davivienda');
    await tocar('Marcar pagado');
    await enRuta('/hoy');
    await tocar('+ Aporte');
    await escribir('¿Cuánto?', '500000');
    fireEvent.press((await screen.findAllByText('Noviembre')).at(-1)!);
    await tocar('Guardar aporte');
    await enRuta('/hoy');
    // Mismas cifras que frontend/src/app/features/hoy/paridad.spec.ts.
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
    expect(screen.getByText('$4.113.000')).toBeTruthy();
    expect(screen.getByText('−$62.000')).toBeTruthy();
    expect(screen.getByTestId('falta-pagar')).toHaveTextContent('Falta pagar$1.215.000');
    expect(screen.queryByTestId('ver-mas')).toBeNull();
  });

  it('replicar octubre en 2028 y la revisión del carro en mayo dan las mismas cifras que la PWA', async () => {
    await conSesion();
    renderRouter('./src/app', { initialUrl: '/anual/2028' });
    expect(await screen.findByText('Octubre 2026 · Activo')).toBeTruthy();
    await tocar('Replicar en los 12 meses');
    await tocar('+ Algo distinto');
    await escribir('¿Qué es?', 'Revisión carro');
    await escribir('¿Cuánto?', '400000');
    await tocar('May');
    await tocar('Guardar');
    // Mismas cifras que frontend/src/app/features/hoy/paridad.spec.ts.
    await waitFor(() => expect(screen.getByTestId('kpi-libre')).toHaveTextContent('$40.376.000'));
    expect(screen.getByTestId('mes-5')).toHaveTextContent('MayoRevisión carro −$400.000$2.998.000');
    expect(screen.getByTestId('mes-1')).toHaveTextContent('Enero a abrilIgual al mes base · 4 meses$3.398.000');
  });
});

export { conSesion };
