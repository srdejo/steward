import { describe, expect, it, vi } from 'vitest';
import { CLAVE_ESTADO, crearAdaptadorDemo, storageEnMemoria } from '.';

const ahora = () => new Date(2026, 9, 26, 10, 0, 0);
const OCT = { anio: 2026, mes: 10 };

describe('adaptador demo (steward-ui-shell: modo demo)', () => {
  it('la semilla da los totales de Hoy', async () => {
    const p = crearAdaptadorDemo({ storage: storageEnMemoria(), ahora });
    const r = await p.movimientos.resumenMes(OCT);
    expect([r.libre, r.plan, r.pagado, r.vsPlan]).toEqual([3_436_000, 5_390_000, 2_613_000, -62_000]);
  });

  it('un registro sobrevive a recargar desde el storage y avisa a los oyentes', async () => {
    const storage = storageEnMemoria();
    const p = crearAdaptadorDemo({ storage, ahora });
    await p.sesion.iniciar('GOOGLE');
    const oyente = vi.fn();
    p.suscribir(oyente);
    await p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: 'Farmacia', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    expect(oyente).toHaveBeenCalled();

    const recargado = crearAdaptadorDemo({ storage, ahora });
    expect((await recargado.movimientos.resumenMes(OCT)).noPlaneados.map((m) => m.nota)).toEqual(['Farmacia']);
    expect((await recargado.sesion.actual())?.usuario.nombre).toBe('Daniel');
  });

  it('restablecer vuelve a los datos iniciales', async () => {
    const p = crearAdaptadorDemo({ storage: storageEnMemoria(), ahora });
    await p.sesion.iniciar('CORREO');
    await p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: '', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    await p.demo!.restablecer();
    expect((await p.movimientos.resumenMes(OCT)).libre).toBe(3_436_000);
  });

  it('probar desde cero deja el hogar sin configurar y sin sesion', async () => {
    const p = crearAdaptadorDemo({ storage: storageEnMemoria(), ahora });
    await p.sesion.iniciar('GOOGLE');
    await p.demo!.probarDesdeCero();
    expect(await p.sesion.actual()).toBeNull();
    expect((await p.sesion.iniciar('GOOGLE')).hogarConfigurado).toBe(false);
  });

  it('cerrar sesion conserva los datos', async () => {
    const p = crearAdaptadorDemo({ storage: storageEnMemoria(), ahora });
    await p.sesion.iniciar('GOOGLE');
    await p.cuentas.agregar({ nombre: 'Bancolombia', titularId: null, saldo: 100_000 });
    await p.sesion.cerrar();
    expect(await p.sesion.actual()).toBeNull();
    await p.sesion.iniciar('FACE_ID');
    expect((await p.cuentas.cuentas()).cuentas.map((c) => c.cuenta.nombre)).toContain('Bancolombia');
  });

  it('si el storage falla sigue en memoria; nunca toca la clave de la v1', async () => {
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); }, removeItem: () => undefined };
    const p = crearAdaptadorDemo({ storage: roto, ahora });
    expect((await p.movimientos.resumenMes(OCT)).libre).toBe(3_436_000);

    const storage = storageEnMemoria({ '@steward/budget_v3': '{"v1":true}' });
    const q = crearAdaptadorDemo({ storage, ahora });
    await q.sesion.iniciar('GOOGLE');
    await q.demo!.restablecer();
    expect(storage.datos['@steward/budget_v3']).toBe('{"v1":true}');
    expect(Object.keys(storage.datos).sort()).toEqual(['@steward/budget_v3', CLAVE_ESTADO, 'steward-demo/session'].sort());
  });

  it('una version de esquema distinta vuelve a sembrar', async () => {
    const storage = storageEnMemoria({ [CLAVE_ESTADO]: JSON.stringify({ version: 0 }) });
    const p = crearAdaptadorDemo({ storage, ahora });
    expect((await p.movimientos.resumenMes(OCT)).libre).toBe(3_436_000);
  });

  it('invitacion: enlace, aceptar y la sesion queda como el invitado', async () => {
    const p = crearAdaptadorDemo({ storage: storageEnMemoria(), ahora, token: () => 'tok-demo' });
    await p.demo!.probarDesdeCero();
    await p.sesion.iniciar('GOOGLE');
    await p.hogar.nombrar('Nuestra casa');
    await p.hogar.completarOnboarding();
    const inv = await p.hogar.invitar('esposa@ejemplo.com');
    expect(await p.hogar.enlaceInvitacion(inv.id)).toBe('/invitacion/tok-demo');
    expect((await p.hogar.invitacion('tok-demo'))?.invitadoPor.nombre).toBe('Daniel');
    const sesion = await p.hogar.aceptar('tok-demo', 'Ana', false);
    expect(sesion.usuario.nombre).toBe('Ana');
    expect((await p.hogar.obtener()).miembros).toHaveLength(2);
  });

  it('una regla que falla no cambia el estado', async () => {
    const p = crearAdaptadorDemo({ storage: storageEnMemoria(), ahora });
    await p.sesion.iniciar('GOOGLE');
    await expect(p.movimientos.marcarPago({ itemId: 'm0-luz', ref: OCT, monto: 38_000, usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' } })).rejects.toThrow('Ya lo pagó Esposa el 12 oct');
    expect((await p.movimientos.resumenMes(OCT)).pagado).toBe(2_613_000);
  });
});
