import { TestBed } from '@angular/core/testing';

import { NOV, OCT, conSesion, provideAppPrueba, puertos } from '../../../testing/demo';
import { app } from '../../../testing/harness';

describe('Hoy (steward-hoy)', () => {
  beforeEach(() => {
    localStorage.removeItem('steward/mes-hoy');
    TestBed.configureTestingModule({ providers: provideAppPrueba() });
  });

  const libre = (a: Awaited<ReturnType<typeof app>>) => a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim();

  it('muestra el resumen de los datos de ejemplo', async () => {
    await conSesion();
    const a = await app('/hoy');
    expect(a.texto()).toContain('Ejecución · LUN 26');
    expect(a.texto()).toContain('Octubre 2026');
    expect(libre(a)).toBe('$3.436.000');
    expect(a.texto()).toMatch(/Plan\s*\$5\.390\.000/);
    expect(a.texto()).toMatch(/Pagado\s*\$2\.613\.000/);
    expect(a.texto()).toMatch(/Vs\. plan\s*−\$62\.000/);
    expect(a.texto()).toContain('Aportes Esposa 2 aportes · 1 pago directo');
    expect(a.texto()).toContain('Tarjeta Mastercard Vence en 4 días');
    expect(a.texto()).toContain('Mercado Variable · llevas $180.000 de $320.000');
  });

  it('muestra plan vs real en un pago', async () => {
    await conSesion();
    const a = await app('/hoy');
    const luz = [...a.raiz().querySelectorAll('app-fila')].find((f) => f.textContent!.includes('Recibo Luz'))!;
    expect(luz.textContent!.replace(/\s+/g, ' ')).toContain('plan $50.000 · −$12.000');
    expect(luz.textContent).toContain('$38.000');
    expect(luz.querySelector('app-avatar')?.getAttribute('aria-label')).toBe('Pagó Esposa');
  });

  it('el diezmo es un gasto por pagar: Recibí no crea tarjeta y se marca pagado (diezmo-como-gasto)', async () => {
    const p = puertos();
    await p.demo!.probarDesdeCero();
    await p.sesion.iniciar('GOOGLE');
    await p.hogar.nombrar('Nuestra casa');
    await p.ingresos.guardarRegla({ activa: true, porcentaje: 10, base: 'BRUTO', aplicaAportes: false });
    await p.ingresos.guardarFijo({ nombre: 'Salario Daniel', bruto: 7_000_000, neto: 6_288_000, diaPago: 25, cuentaId: null });
    await p.hogar.completarOnboarding();
    await p.plan.crearMes(OCT, 'CERO');
    const a = await app('/hoy');
    expect(a.texto()).toContain('Diezmo · Salario Daniel');
    const libre = a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim();

    // Recibí abre el monto de la linea para confirmarlo o cambiarlo.
    await a.tocar('Recibí');
    expect(a.url()).toMatch(/^\/hoy\/recibir\//);
    await a.escribir('Valor recibido', '6350000');
    await a.tocar('Marcar recibido');
    expect(a.url()).toBe('/hoy');
    expect(a.texto()).not.toContain('Disponible para diezmar');
    expect(a.texto()).toContain('Fijo · recibido 26 oct');
    expect(a.raiz().querySelector('[data-testid="libre"]')!.textContent!.trim()).not.toBe(libre);

    // Llevar el diezmo: Marcar pago desde una cuenta, como cualquier gasto.
    const diezmo = (await p.movimientos.resumenMes(OCT)).porPagar.find((i) => i.item.tipo === 'DIEZMO')!;
    expect(diezmo.plan).toBe(700_000);
    await a.ir(`/hoy/pagar/${diezmo.item.id}`);
    await a.tocar('Marcar pagado');
    expect((await p.movimientos.resumenMes(OCT)).yaPagado.map((i) => i.item.nombre)).toContain('Diezmo · Salario Daniel');
  });

  it('un aporte para el mes siguiente no cambia el libre de este mes', async () => {
    await conSesion();
    const a = await app('/hoy/aporte');
    await a.tocar('Esposa');
    await a.escribir('¿Cuánto?', '500000');
    await a.tocar('Noviembre', 'app-hoja [role="radio"]');
    expect(a.raiz().querySelector('[data-testid="efecto-aporte"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Noviembre pasa a tener $500.000 más en ingresos');
    await a.tocar('Guardar aporte');
    expect(a.url()).toBe('/hoy');
    expect(libre(a)).toBe('$3.436.000');
    const nov = await puertos().plan.mes(NOV);
    expect(nov.opciones[0]!.ingresos.find((l) => l.nombre === 'Aporte Esposa')?.monto).toBe(2_500_000);
  });

  it('pago directo desde "Su cuenta" cuenta como aporte de quien pagó', async () => {
    await conSesion();
    const a = await app('/hoy/pagar/m0-mastercard');
    expect(a.texto()).toContain('Tarjetas y cuotas');
    expect(a.texto()).toContain('vence 30 oct');
    expect(a.campo('Valor pagado').value).toBe('$1.500.000');
    await a.tocar('Esposa');
    await a.tocar('Su cuenta');
    expect(a.raiz().querySelector('[data-testid="aviso-su-cuenta"]')!.textContent!.replace(/\s+/g, ' ')).toContain('aporte de Esposa en octubre');
    await a.tocar('Marcar pagado');
    expect(a.url()).toBe('/hoy');
    expect(a.texto()).toContain('Aportes Esposa 2 aportes · 2 pagos directos');
    expect(a.texto()).toContain('$4.038.000');
    const fila = [...a.raiz().querySelectorAll('#ya-pagado ~ div app-fila')].find((f) => f.textContent!.includes('Tarjeta Mastercard'))!;
    expect(fila.querySelector('app-avatar')?.textContent?.trim()).toBe('E');
  });

  it('un fijo ya pagado avisa quién y cuándo en lugar de pagarlo otra vez', async () => {
    await conSesion();
    const a = await app('/hoy/pagar/m0-luz');
    expect(a.raiz().querySelector('[data-testid="ya-pagado"]')!.textContent!.trim()).toBe('Ya lo pagó Esposa el 12 oct');
    expect(a.texto()).not.toContain('Marcar pagado');
  });

  it('el mes siguiente se ejecuta sin tocar el mes en curso, y se recuerda (plan-mes-siguiente)', async () => {
    const p = await conSesion();
    const a = await app('/hoy');
    const libreOct = libre(a);
    await a.tocar('Noviembre');
    expect(a.texto()).toContain('Noviembre 2026');
    expect(a.raiz().querySelector('[data-testid="opcion-por-elegir"]')!.textContent).toContain('Opción A · elige otra en Plan');

    const linea = (await p.movimientos.resumenMes(NOV)).ingresos.find((l) => l.lineaId && !l.recibido)!;
    await a.ir('/hoy/recibir/' + linea.clave);
    expect(a.raiz().querySelector('[data-testid="aviso-mes"]')!.textContent).toContain('Se registra en noviembre');
    await a.tocar('Marcar recibido');
    expect((await p.movimientos.resumenMes(NOV)).ingresos.find((l) => l.lineaId === linea.lineaId)!.recibido).toBe(true);
    const m = (await p.movimientos.resumenMes(NOV)).ingresos.find((l) => l.lineaId === linea.lineaId)!;
    expect(m.detalle).toContain('26 oct');

    const item = (await p.movimientos.resumenMes(NOV)).porPagar.find((i) => i.item.tipo === 'FIJO')!;
    await a.ir('/hoy/pagar/' + item.item.id);
    await a.tocar('Marcar pagado');
    expect((await p.movimientos.resumenMes(NOV)).yaPagado.map((i) => i.item.id)).toContain(item.item.id);

    await a.tocar('Octubre');
    expect(libre(a)).toBe(libreOct);
    await a.tocar('Noviembre');
    expect(localStorage.getItem('steward/mes-hoy')).toBe('2026-11');
    localStorage.removeItem('steward/mes-hoy');
  });

  it('un mes recordado que ya pasó vuelve al mes en curso (plan-mes-siguiente)', async () => {
    localStorage.setItem('steward/mes-hoy', '2026-09');
    await conSesion();
    const a = await app('/hoy');
    expect(a.texto()).toContain('Octubre 2026');
    localStorage.removeItem('steward/mes-hoy');
  });

  it('borrar un gasto equivocado desde Hoy (usabilidad-plan)', async () => {
    const p = await conSesion();
    await p.movimientos.registrarGasto({ monto: 95_000, itemId: null, nota: 'Farmacia (error)', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    const a = await app('/hoy');
    const antes = libre(a);
    await a.tocar(/^Farmacia \(error\)/);
    expect(a.url()).toMatch(/^\/hoy\/registro\//);
    await a.tocar('Borrar este registro');
    expect(a.raiz().querySelector('[data-testid="efecto-borrar"]')!.textContent).toContain('Pagado baja $95.000');
    await a.tocar('Sí, borrar');
    expect(a.url()).toBe('/hoy');
    expect(a.texto()).not.toContain('Farmacia (error)');
    expect(libre(a)).toBe('$3.436.000');
    expect(antes).toBe('$3.341.000');
  });

  it('corregir un pago y deshacer un Recibí (usabilidad-plan)', async () => {
    const p = await conSesion();
    const a = await app('/hoy');
    await a.tocar(/^Recibo Luz/);
    await a.escribir('Monto', '50000');
    await a.tocar('Guardar');
    expect(a.url()).toBe('/hoy');
    const luz = (await p.movimientos.resumenMes(OCT)).yaPagado.find((i) => i.item.nombre === 'Recibo Luz')!;
    expect(luz.real).toBe(50_000);
    expect(luz.detalle).toContain('igual al plan');

    const linea = (await p.movimientos.resumenMes(OCT)).ingresos.find((l) => l.movimientoId)!;
    await a.tocar(new RegExp('^' + linea.nombre));
    await a.tocar('Borrar este registro');
    expect(a.raiz().querySelector('[data-testid="efecto-borrar"]')!.textContent).toContain(linea.nombre + ' vuelve a Por recibir');
    await a.tocar('Sí, borrar');
    expect((await p.movimientos.resumenMes(OCT)).ingresos.find((l) => l.nombre === linea.nombre)!.recibido).toBe(false);
  });

  it('la cuota no cambia su monto: se borra y el saldo del crédito vuelve (usabilidad-plan)', async () => {
    const p = await conSesion();
    await p.cuentas.agregarCredito({ nombre: 'Moto', entidad: 'Banco', saldo: 10_000_000, totalOriginal: 10_000_000, cuota: 500_000, tasaEM: 1, diaPago: 15 });
    const credito = (await p.cuentas.creditos()).find((c) => c.credito.nombre === 'Moto')!.credito;
    const item = (await p.movimientos.resumenMes(OCT)).porPagar.find((i) => i.item.creditoId === credito.id)!;
    await p.movimientos.marcarPago({ itemId: item.item.id, ref: OCT, monto: 500_000, usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' } });
    const a = await app('/hoy');
    await a.tocar(new RegExp('^' + item.item.nombre));
    expect(a.raiz().querySelector('[data-testid="aviso-cuota"]')).not.toBeNull();
    await a.tocar('Borrar este registro');
    await a.tocar('Sí, borrar');
    expect((await p.cuentas.creditos()).find((c) => c.credito.nombre === 'Moto')!.credito.saldo).toBe(10_000_000);
  });

  it('los aportes de una persona abren su lista (usabilidad-plan)', async () => {
    await conSesion();
    const a = await app('/hoy');
    await a.tocar(/^Aportes Esposa/);
    expect(a.url()).toContain('/hoy/registros?aportes=');
    expect(a.texto()).toContain('Registros del mes');
    await a.tocar(/Aporte Esposa|Tarjeta|Recibo/, 'app-hoja a');
    expect(a.url()).toMatch(/^\/hoy\/registro\//);
  });

  it('el diezmo por pagar dice de dónde viene, sin Venció (usabilidad-plan)', async () => {
    const p = await conSesion();
    const diezmo = (await p.movimientos.resumenMes(OCT)).porPagar.find((i) => i.item.tipo === 'DIEZMO')!;
    expect(diezmo.detalle).toMatch(/^Del /);
    const a = await app('/hoy');
    const fila = [...a.raiz().querySelectorAll('app-fila')].find((f) => f.textContent!.includes(diezmo.item.nombre))!;
    expect(fila.textContent).not.toContain('Venció');
    expect(fila.querySelector('.text-negativo')).toBeNull();
  });

  it('gasto variable acumula y gasto no planeado resta del libre', async () => {
    await conSesion();
    const a = await app('/hoy/gasto?item=m0-mercado');
    expect(a.porTexto('Mercado').getAttribute('aria-checked')).toBe('true');
    await a.escribir('¿Cuánto?', '40000');
    expect(a.raiz().querySelector('[data-testid="vista-previa-gasto"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Mercado: llevas $220.000 de $320.000 con este gasto.');
    await a.tocar('Guardar gasto');
    expect(a.texto()).toContain('Mercado Variable · llevas $220.000 de $320.000');

    await a.ir('/hoy/gasto');
    await a.escribir('¿Cuánto?', '85000');
    await a.tocar('No estaba planeado');
    await a.escribir('Nota · Opcional', 'Farmacia');
    await a.tocar('Guardar gasto');
    expect(libre(a)).toBe('$3.351.000');
    expect(a.texto()).toContain('Farmacia No estaba planeado');
  });
});
