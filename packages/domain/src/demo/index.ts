// Adaptador de prueba: implementa todos los puertos en memoria con las reglas de rules/ y guarda el
// estado en el dispositivo (localStorage en la PWA, AsyncStorage en la app). Ver design D2-D4.

import type { EstadoHogar, Fecha, Id, Usuario } from '../model';
import type { Preferencias, Puertos, Sesion } from '../ports';
import * as R from '../rules';
import { crearHogarVacio, crearSemilla, DANIEL, VERSION_ESQUEMA } from './seed';

export { crearHogarVacio, crearSemilla, DANIEL, ESPOSA, VERSION_ESQUEMA } from './seed';

/** Lo minimo de localStorage/AsyncStorage que usa el adaptador (sincrono o asincrono). */
export interface StorageLike {
  getItem(clave: string): string | null | Promise<string | null>;
  setItem(clave: string, valor: string): void | Promise<void>;
  removeItem(clave: string): void | Promise<void>;
}

/** Claves propias del modo demo. La app v1 usa `@steward/budget_v3` y nunca se toca. */
export const CLAVE_ESTADO = 'steward-demo/v1';
export const CLAVE_SESION = 'steward-demo/session';

interface SesionGuardada {
  usuarioId: Id | null;
  preferencias: Preferencias;
}

const PREFERENCIAS: Preferencias = { faceIdAlAbrir: false, ocultarMontos: false };

export interface OpcionesDemo {
  storage: StorageLike;
  /** Reloj de la app; por defecto la hora real. */
  ahora?: () => Date;
  /** Generador de tokens de invitacion (inyectable para los tests). */
  token?: () => string;
  /**
   * Modo conectado (design D9): la persona real de la sesion del backend. Ocupa el lugar de "Daniel" en los datos de
   * prueba (nombre, correo e inicial) y la sesion demo queda siempre como ella, para que "tu" cuadre en las pantallas
   * que todavia usan datos de prueba.
   */
  titular?: Pick<Usuario, 'nombre' | 'email' | 'inicial'>;
  /**
   * Modo conectado (design D5 de backend-ingresos-diezmo): reemplaza al leer partes del estado con los datos reales del
   * backend (ingresos, reglas, cuentas, ingresos recibidos y diezmos entregados). Se aplica en cada lectura y nunca se
   * guarda: los cambios del adaptador se aplican sobre el estado de prueba sin superponer.
   */
  superponer?: (s: EstadoHogar) => EstadoHogar;
}

function tokenAleatorio(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export function crearAdaptadorDemo(opciones: OpcionesDemo): Puertos {
  const { storage } = opciones;
  const ahora = opciones.ahora ?? (() => new Date());
  const token = opciones.token ?? tokenAleatorio;
  const hoy = (): Fecha => R.fechaDe(ahora());
  const mesActual = () => R.mesDe(hoy());

  let estado: EstadoHogar | null = null;
  const titular = opciones.titular;

  /** Pone al titular real en el lugar de Daniel; sin titular deja el estado igual. */
  function conTitular(s: EstadoHogar): EstadoHogar {
    if (!titular) return s;
    return { ...s, usuarios: s.usuarios.map((u) => (u.id === DANIEL ? { ...u, ...titular } : u)) };
  }

  function semilla(): EstadoHogar {
    return conTitular(crearSemilla(hoy()));
  }
  let sesion: SesionGuardada = { usuarioId: null, preferencias: { ...PREFERENCIAS } };
  const oyentes = new Set<() => void>();

  async function leer<T>(clave: string): Promise<T | null> {
    try {
      const texto = await storage.getItem(clave);
      return texto ? (JSON.parse(texto) as T) : null;
    } catch {
      return null;
    }
  }

  async function escribir(clave: string, valor: unknown): Promise<void> {
    try {
      await storage.setItem(clave, JSON.stringify(valor));
    } catch {
      // Sin almacenamiento (modo privado, cuota llena): se sigue en memoria.
    }
  }

  let carga: Promise<void> | null = null;
  function cargar(): Promise<void> {
    carga ??= (async () => {
      const guardado = await leer<EstadoHogar>(CLAVE_ESTADO);
      estado = guardado && guardado.version === VERSION_ESQUEMA ? conTitular(guardado) : semilla();
      if (!guardado || guardado.version !== VERSION_ESQUEMA) await escribir(CLAVE_ESTADO, estado);
      const s = await leer<SesionGuardada>(CLAVE_SESION);
      if (s) sesion = { usuarioId: s.usuarioId, preferencias: { ...PREFERENCIAS, ...s.preferencias } };
      if (titular) sesion.usuarioId = DANIEL;
    })();
    return carga;
  }

  /** El estado que ven las pantallas: el de prueba con los datos reales superpuestos, si los hay. */
  async function leerEstado(): Promise<EstadoHogar> {
    await cargar();
    return opciones.superponer ? opciones.superponer(estado!) : estado!;
  }

  function avisar(): void {
    for (const o of [...oyentes]) o();
  }

  /** Aplica una regla, guarda y avisa. Si la regla lanza, el estado no cambia. */
  async function cambiar(regla: (s: EstadoHogar) => EstadoHogar): Promise<void> {
    await cargar();
    // Sobre el estado de prueba, sin superponer: lo real nunca se guarda en el dispositivo.
    estado = regla(estado!);
    await escribir(CLAVE_ESTADO, estado);
    avisar();
  }

  async function guardarSesion(): Promise<void> {
    await escribir(CLAVE_SESION, sesion);
    avisar();
  }

  async function usuarioActual(): Promise<Id> {
    await cargar();
    if (!sesion.usuarioId) throw new R.ReglaError('SIN_SESION', 'No hay sesión');
    return sesion.usuarioId;
  }

  async function vistaSesion(): Promise<Sesion | null> {
    const s = await leerEstado();
    const u = sesion.usuarioId ? s.usuarios.find((x) => x.id === sesion.usuarioId) : null;
    if (!u) return null;
    return { usuario: u, hogarConfigurado: s.hogar.configurado, preferencias: sesion.preferencias };
  }

  const puertos: Puertos = {
    hoy,
    suscribir(listener) {
      oyentes.add(listener);
      return () => oyentes.delete(listener);
    },

    sesion: {
      actual: vistaSesion,
      async iniciar() {
        const s = await leerEstado();
        sesion.usuarioId = s.hogar.miembros[0]?.usuarioId ?? s.usuarios[0]!.id;
        await guardarSesion();
        return (await vistaSesion())!;
      },
      async cerrar() {
        await cargar();
        sesion.usuarioId = null;
        await guardarSesion();
      },
      async guardarPreferencias(cambios) {
        await cargar();
        sesion.preferencias = { ...sesion.preferencias, ...cambios };
        await guardarSesion();
        return sesion.preferencias;
      },
    },

    hogar: {
      async obtener() {
        const s = await leerEstado();
        return {
          hogar: s.hogar,
          invitaciones: s.hogar.invitaciones,
          miembros: s.hogar.miembros.map((m) => ({ usuario: R.usuario(s, m.usuarioId), unidoEn: m.unidoEn, esActual: m.usuarioId === sesion.usuarioId })),
        };
      },
      async actualizarPerfil(nombre) {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.actualizarPerfil(s, { usuarioId, nombre }));
      },
      async nombrar(nombre) {
        await cambiar((s) => R.nombrarHogar(s, nombre));
      },
      async completarOnboarding() {
        const fecha = hoy();
        await cambiar((s) => {
          const listo = R.completarOnboarding(s);
          listo.hogar.miembros = listo.hogar.miembros.map((m) => (m.unidoEn ? m : { ...m, unidoEn: fecha }));
          return listo;
        });
      },
      async invitar(email) {
        const creadaPor = await usuarioActual();
        const t = token();
        await cambiar((s) => R.invitar(s, { email, creadaPor, fecha: hoy(), token: t }));
        return estado!.hogar.invitaciones.find((i) => i.token === t)!;
      },
      async reenviar(invitacionId) {
        await cambiar((s) => R.reenviarInvitacion(s, { invitacionId, fecha: hoy() }));
      },
      async enlaceInvitacion(invitacionId) {
        const s = await leerEstado();
        const inv = s.hogar.invitaciones.find((i) => i.id === invitacionId);
        if (!inv) throw new R.ReglaError('NO_EXISTE', 'No existe la invitación');
        return `/invitacion/${inv.token}`;
      },
      async invitacion(t) {
        const s = await leerEstado();
        const inv = R.invitacionVigente(s, t, hoy());
        if (!inv) return null;
        return {
          token: inv.token, hogar: s.hogar.nombre, email: inv.email, invitadoPor: R.usuario(s, inv.creadaPor),
          miembros: s.hogar.miembros.map((m) => R.usuario(s, m.usuarioId)),
        };
      },
      async aceptar(t, nombre, diezmoAportes) {
        await cargar();
        const s = estado!;
        const r = R.aceptarInvitacion(s, { token: t, nombre, diezmoAportes, fecha: hoy() });
        estado = r.estado;
        await escribir(CLAVE_ESTADO, estado);
        sesion.usuarioId = r.usuario.id;
        await guardarSesion();
        return (await vistaSesion())!;
      },
      async salir() {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.salirDelHogar(s, usuarioId));
        sesion.usuarioId = null;
        await guardarSesion();
      },
      async categorias() {
        return [...(await leerEstado()).categorias].sort((a, b) => a.orden - b.orden);
      },
      async guardarCategoria(datos) {
        await cambiar((s) => R.guardarCategoria(s, datos));
      },
      async definirDiezmoEnHoy(modo) {
        await cambiar((s) => R.definirDiezmoEnHoy(s, modo));
      },
    },

    ingresos: {
      async fijos(todos = false) {
        const s = await leerEstado();
        return s.ingresosFijos.filter((f) => f.activo && (todos || f.usuarioId === sesion.usuarioId));
      },
      async guardarFijo(datos) {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.guardarIngresoFijo(s, { ...datos, usuarioId, activo: true }));
      },
      async quitarFijo(id) {
        await cambiar((s) => R.quitarIngresoFijo(s, id));
      },
      async regla() {
        const s = await leerEstado();
        return s.reglas.find((r) => r.usuarioId === sesion.usuarioId) ?? null;
      },
      async guardarRegla(datos) {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.guardarRegla(s, { ...datos, usuarioId }));
      },
      async marcarRecibido(ingresoFijoId, ref) {
        const creadoPor = await usuarioActual();
        await cambiar((s) => R.marcarRecibido(s, { ingresoFijoId, ref, fecha: hoy(), creadoPor }));
      },
      async registrarAporte(datos) {
        const creadoPor = await usuarioActual();
        await cambiar((s) => R.registrarAporte(s, { ...datos, fecha: hoy(), creadoPor }));
      },
      async entregarDiezmo(obligaciones, ref, cuentaId) {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.entregarDiezmo(s, { obligaciones, ref, fecha: hoy(), usuarioId, cuentaId }));
      },
    },

    movimientos: {
      async resumenMes(ref) {
        return R.resumenMes(await leerEstado(), ref, hoy());
      },
      async marcarPago(datos) {
        const creadoPor = await usuarioActual();
        await cambiar((s) => R.marcarPago(s, { ...datos, fecha: hoy(), creadoPor }));
      },
      async registrarGasto(datos) {
        const creadoPor = await usuarioActual();
        await cambiar((s) => R.registrarGasto(s, { ...datos, fecha: hoy(), creadoPor }));
      },
      async previsualizarGasto(ref, itemId, monto) {
        return R.previsualizarGasto(await leerEstado(), ref, itemId, monto, hoy());
      },
    },

    plan: {
      async inicio() {
        const s = await leerEstado();
        const { proximos, recientes } = R.planInicio(s, hoy());
        const anio = mesActual().anio + 1;
        return { proximos, recientes, anual: R.resumenAnual(s, anio) };
      },
      async mes(ref) {
        const s = await leerEstado();
        const plan = R.planDe(s, ref);
        return { ref, plan, estado: plan ? R.estadoEfectivo(plan, hoy()) : 'SIN_PLAN', opciones: R.vistasOpciones(s, ref) };
      },
      async loQueTrae(ref) {
        return R.loQueTraeElMes(await leerEstado(), ref);
      },
      async crearMes(ref, modo) {
        const creadoPor = await usuarioActual();
        await cambiar((s) => R.crearMes(s, { ref, modo, creadoPor }));
      },
      async duplicar(planId, escenarioId) {
        const creadoPor = await usuarioActual();
        await cambiar((s) => R.duplicarEscenario(s, { planId, escenarioId, creadoPor, hoy: hoy() }));
        return R.planPorId(estado!, planId).escenarios.at(-1)!.id;
      },
      async usar(planId, escenarioId) {
        await cambiar((s) => R.usarEscenario(s, { planId, escenarioId, hoy: hoy() }));
      },
      async quitarOpcion(planId, escenarioId) {
        await cambiar((s) => R.quitarEscenario(s, { planId, escenarioId, hoy: hoy() }));
      },
      async guardarItem(planId, escenarioId, item) {
        await cambiar((s) => R.guardarItem(s, { planId, escenarioId, item }));
      },
      async quitarItem(planId, escenarioId, itemId) {
        await cambiar((s) => R.quitarItem(s, { planId, escenarioId, itemId }));
      },
      async comparar(ref) {
        return R.compararOpciones(await leerEstado(), ref);
      },
      async anual(anio) {
        return R.resumenAnual(await leerEstado(), anio);
      },
      async agregarEvento(anio, evento) {
        await cambiar((s) => R.agregarEvento(s, { anio, evento }));
      },
      async editarMontoAnual(anio, categoriaId, mes, monto) {
        await cambiar((s) => R.editarMontoAnual(s, { anio, categoriaId, mes, monto }));
      },
      async crearMesesDesdeAnual(anio) {
        const creadoPor = await usuarioActual();
        await cambiar((s) => R.crearMesesDesdeAnual(s, { anio, creadoPor }));
      },
      async crearAnual(anio) {
        await cambiar((s) => R.crearAnual(s, { anio, hoy: hoy() }));
      },
      async editarProyeccion(usuarioId, ref, monto) {
        await cambiar((s) => R.editarProyeccion(s, { usuarioId, ref, monto }));
      },
    },

    cuentas: {
      async cuentas(filtro) {
        return R.cuentasDelHogar(await leerEstado(), hoy(), filtro);
      },
      async agregar(datos) {
        await cambiar((s) => R.agregarCuenta(s, { ...datos, fecha: hoy() }));
      },
      async mover(datos) {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.moverDinero(s, { ...datos, fecha: hoy(), usuarioId }));
      },
      async diferencia(cuentaId, saldoBanco) {
        return R.diferenciaCuadre(await leerEstado(), cuentaId, saldoBanco);
      },
      async cuadrar(saldos) {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.cuadrarCuentas(s, { saldos, fecha: hoy(), usuarioId }));
      },
      async creditos() {
        return (await leerEstado()).creditos.map((c) => ({ credito: c, cuotasRestantes: R.cuotasRestantes(c), porcentajePagado: R.porcentajePagado(c) }));
      },
      async credito(id) {
        const c = (await leerEstado()).creditos.find((x) => x.id === id);
        return c ? { credito: c, cuotasRestantes: R.cuotasRestantes(c), porcentajePagado: R.porcentajePagado(c) } : null;
      },
      async agregarCredito(datos) {
        await cambiar((s) => R.agregarCredito(s, { ...datos, fecha: hoy() }));
      },
      async actualizarSaldo(creditoId, saldo) {
        await cambiar((s) => R.actualizarSaldoCredito(s, { creditoId, saldo, fecha: hoy() }));
      },
      async registrarAbono(creditoId, monto, origen) {
        const usuarioId = await usuarioActual();
        await cambiar((s) => R.registrarAbono(s, { creditoId, monto, origen, fecha: hoy(), usuarioId }));
      },
      async simular(creditoId, abono) {
        const c = (await leerEstado()).creditos.find((x) => x.id === creditoId);
        return c ? R.simularAbono(c, abono) : null;
      },
      async probarComoOpcion(creditoId, ref, abono) {
        const creadoPor = await usuarioActual();
        let resultado: { planId: Id; escenarioId: Id } | null = null;
        await cambiar((s) => {
          const r = R.probarAbonoComoOpcion(s, { creditoId, ref, abono, creadoPor, hoy: hoy() });
          resultado = { planId: r.planId, escenarioId: r.escenarioId };
          return r.estado;
        });
        return resultado!;
      },
    },

    cierre: {
      async vista(ref) {
        return R.vistaCierre(await leerEstado(), ref);
      },
      async cerrar(ref, reparto) {
        const cerradoPor = await usuarioActual();
        await cambiar((s) => R.cerrarMes(s, { ref, ...reparto, cerradoPor, fecha: hoy() }));
        return R.cierreDe(estado!, ref)!;
      },
    },

    demo: {
      async restablecer() {
        await cargar();
        estado = semilla();
        await escribir(CLAVE_ESTADO, estado);
        avisar();
      },
      async probarDesdeCero() {
        await cargar();
        estado = crearHogarVacio();
        await escribir(CLAVE_ESTADO, estado);
        sesion.usuarioId = null;
        await guardarSesion();
      },
    },
  };
  return puertos;
}

/** Storage en memoria para tests y para cuando no hay almacenamiento. */
export function storageEnMemoria(inicial: Record<string, string> = {}): StorageLike & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k]! : null),
    setItem: (k, v) => {
      datos[k] = v;
    },
    removeItem: (k) => {
      delete datos[k];
    },
  };
}
