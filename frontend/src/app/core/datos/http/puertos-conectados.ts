import type {
  CierrePort,
  CuentasPort,
  Fecha,
  HogarPort,
  IngresosPort,
  Invitacion,
  InvitacionRecibida,
  MovimientosPort,
  Origen,
  PlanPort,
  Preferencias,
  Puertos,
  Sesion,
  SesionPort,
  Usuario,
  VistaHogar,
} from '@steward/domain';
import { ReglaError } from '@steward/domain';
import { crearAdaptadorDemo, type StorageLike } from '@steward/domain/demo';

import {
  usuarioDe,
  type Api,
  type HogarApi,
  type InvitacionApi,
  type InvitacionEnviadaApi,
  type FinanzasApi,
  type InvitacionRecibidaApi,
  type OrigenRequest,
  type SesionApi,
  type UsuarioApi,
} from './api';
import { categoria, ingresoFijo, regla, superponerFinanzas } from './superposicion';
import type { TokenSesion } from './token-sesion';

/** Lo que agrega el modo conectado a la invitacion: si el correo salio y el enlace para copiar (spec "Correo caido"). */
export type InvitacionConectada = Invitacion & { correoEnviado: boolean; enlace: string };

/** Invitacion para el correo de la sesion: se acepta por id, sin token. */
export type MiInvitacion = InvitacionRecibida & { id: string };

export interface ResultadoLogin {
  sesion: Sesion;
  tieneHogar: boolean;
}

interface Dependencias {
  api: Api;
  tokens: TokenSesion;
  storage: StorageLike;
  ahora?: () => Date;
}

/**
 * Puertos del modo conectado (design D9 de backend-acceso-hogar y D5 de backend-ingresos-diezmo y backend-plan-mes-hoy):
 * - del backend: sesion, hogar, miembros, invitaciones, categorias, ingresos fijos, regla de diezmo, cuentas, el plan de
 *   cada mes con su Opcion A y todo lo registrado ("Recibi", "Entregado", pagos, gastos y aportes);
 * - del adaptador de prueba, con la persona real como titular: creditos, plan anual y cierre;
 * - lo que llega en otras etapas (varias opciones, cerrar el mes, crear meses desde el anual) avisa sin cambiar nada.
 *
 * Las finanzas reales se superponen al estado de prueba en cada lectura, asi que Hoy, Planear, Cuentas y el Cierre
 * calculan con las reglas del dominio. El adaptador de prueba se rehace cuando cambia el usuario.
 */
export class PuertosConectados implements Puertos {
  private demoActual: Puertos;
  private titularId: string | null = null;
  private dejarDemo: () => void;
  private readonly oyentes = new Set<() => void>();
  private preferenciasLocales: Preferencias = { faceIdAlAbrir: false, ocultarMontos: false };
  /** Lo ultimo leido de `GET /api/finanzas`; null sin sesion o sin hogar. */
  private finanzas: FinanzasApi | null = null;
  /** Nombres de los miembros reales (titulares de cuentas), de la ultima lectura del hogar. */
  private miembrosReales: UsuarioApi[] = [];

  readonly sesion: SesionPort;
  readonly hogar: HogarPort;
  readonly ingresos: IngresosPort;
  readonly cuentas: CuentasPort;
  readonly movimientos: MovimientosPort;
  readonly plan: PlanPort;
  readonly cierre: CierrePort;

  constructor(private readonly d: Dependencias) {
    this.demoActual = this.nuevoDemo(null);
    this.dejarDemo = this.demoActual.suscribir(() => this.avisar());
    this.sesion = this.crearSesion();
    this.hogar = this.crearHogar();
    this.ingresos = this.crearIngresos();
    this.cuentas = this.crearCuentas();
    this.movimientos = this.crearMovimientos();
    this.plan = this.crearPlan();
    this.cierre = {
      // Plan vs. real con lo real; cerrar el mes llega en la Etapa 6.
      vista: (ref) => this.demoActual.cierre.vista(ref),
      cerrar: () => Promise.reject(new ReglaError('ETAPA_6', 'Cerrar el mes llega en una próxima versión.')),
    };
  }
  /** Sin "Probar desde cero": el hogar es real (spec steward-ui-shell, modo conectado). */
  get demo() {
    const demo = this.demoActual.demo!;
    return {
      restablecer: () => demo.restablecer(),
      probarDesdeCero: () => Promise.reject(new ReglaError('NO_DISPONIBLE', 'En modo conectado el hogar es real')),
    };
  }

  hoy(): Fecha {
    return this.demoActual.hoy();
  }

  suscribir(listener: () => void): () => void {
    this.oyentes.add(listener);
    return () => this.oyentes.delete(listener);
  }

  /** Login con el ID token de Google Identity Services. */
  async iniciarConGoogle(credential: string): Promise<ResultadoLogin> {
    return this.conSesionNueva(await this.d.api.loginGoogle(credential));
  }

  /** Acceso de desarrollo (solo local): misma sesion que Google, por correo y nombre. */
  async iniciarDesarrollo(email: string, nombre: string): Promise<ResultadoLogin> {
    return this.conSesionNueva(await this.d.api.loginDesarrollo(email, nombre));
  }

  /** Invitaciones pendientes para el correo de la sesion: quien entra sin el enlace tambien puede unirse. */
  async misInvitaciones(): Promise<MiInvitacion[]> {
    return (await this.d.api.misInvitaciones()).map((r) => ({ id: r.id, ...recibida('', r) }));
  }

  async aceptarMia(id: string, nombre: string, diezmoAportes: boolean): Promise<Sesion> {
    const s = await this.d.api.aceptarMia(id, nombre, diezmoAportes);
    await this.recargarFinanzas();
    return this.aSesion(s);
  }

  /** Relee las finanzas reales y avisa a las pantallas. Sin sesion o sin hogar, no hay nada que superponer. */
  private async recargarFinanzas(): Promise<void> {
    if (!this.d.tokens.leer()) {
      this.finanzas = null;
    } else {
      try {
        this.finanzas = await this.d.api.finanzas();
      } catch (e) {
        if (!(e instanceof ReglaError && e.codigo === 'SIN_HOGAR')) throw e;
        this.finanzas = null;
      }
    }
    this.avisar();
  }

  private async conSesionNueva(s: SesionApi): Promise<ResultadoLogin> {
    if (s.token) this.d.tokens.guardar(s.token);
    return { sesion: await this.aSesion(s), tieneHogar: s.tieneHogar };
  }

  private avisar(): void {
    for (const o of [...this.oyentes]) o();
  }

  private nuevoDemo(titular: Usuario | null): Puertos {
    return crearAdaptadorDemo({
      storage: this.d.storage,
      ahora: this.d.ahora,
      titular: titular ? { nombre: titular.nombre, email: titular.email, inicial: titular.inicial } : undefined,
      superponer: (s) => (this.finanzas ? superponerFinanzas(s, this.finanzas, this.miembrosReales) : s),
    });
  }

  /** La persona real ocupa el lugar del titular en los datos de prueba; si cambia, se rehace el adaptador. */
  private async aSesion(s: SesionApi): Promise<Sesion> {
    const usuario = usuarioDe(s.usuario);
    if (this.titularId !== usuario.id) {
      this.titularId = usuario.id;
      this.dejarDemo();
      this.demoActual = this.nuevoDemo(usuario);
      this.dejarDemo = this.demoActual.suscribir(() => this.avisar());
      this.preferenciasLocales = (await this.demoActual.sesion.actual())?.preferencias ?? this.preferenciasLocales;
      this.miembrosReales = [s.usuario];
      // Las pantallas no calculan con datos mezclados hasta tener las finanzas reales de esta persona.
      await this.recargarFinanzas().catch(() => this.avisar());
    }
    return { usuario, hogarConfigurado: s.hogarConfigurado, preferencias: this.preferenciasLocales };
  }

  private crearSesion(): SesionPort {
    return {
      actual: async () => {
        if (!this.d.tokens.leer()) return null;
        try {
          return await this.aSesion(await this.d.api.sesion());
        } catch (e) {
          if (e instanceof ReglaError && e.codigo === 'NO_AUTENTICADO') {
            this.d.tokens.borrar();
            return null;
          }
          throw e;
        }
      },
      iniciar: async () => {
        throw new ReglaError('USAR_GOOGLE', 'Entra con Google');
      },
      cerrar: async () => {
        this.d.tokens.borrar();
        this.finanzas = null;
        this.avisar();
      },
      // Face ID y "Ocultar montos" son del dispositivo: se guardan con el adaptador de prueba.
      guardarPreferencias: async (cambios) => {
        this.preferenciasLocales = await this.demoActual.sesion.guardarPreferencias(cambios);
        return this.preferenciasLocales;
      },
    };
  }

  private crearHogar(): HogarPort {
    const api = this.d.api;
    const conAviso = async <T>(accion: Promise<T>): Promise<T> => {
      const r = await accion;
      this.avisar();
      return r;
    };
    // Crear el hogar, unirse o salir cambian las finanzas que se superponen.
    const conFinanzas = async <T>(accion: Promise<T>): Promise<T> => {
      const r = await accion;
      await this.recargarFinanzas();
      return r;
    };
    return {
      // Sin hogar todavia (onboarding paso 1): un hogar vacio, como el del adaptador de prueba.
      obtener: async () => {
        try {
          return this.vista(await api.hogar());
        } catch (e) {
          if (e instanceof ReglaError && e.codigo === 'SIN_HOGAR') return this.vista(HOGAR_VACIO);
          throw e;
        }
      },
      actualizarPerfil: async (nombre) => {
        await conAviso(api.perfil(nombre));
      },
      // Paso 1 del onboarding: crea el hogar la primera vez; despues lo renombra.
      nombrar: async (nombre) => {
        try {
          await conAviso(api.renombrarHogar(nombre));
        } catch (e) {
          if (!(e instanceof ReglaError && e.codigo === 'SIN_HOGAR')) throw e;
          await conFinanzas(api.crearHogar(nombre));
        }
      },
      completarOnboarding: async () => {
        await conAviso(api.completarOnboarding());
      },
      invitar: async (email) => invitacionConectada(await conAviso(api.invitar(email))),
      reenviar: async (id) => {
        await conAviso(api.reenviar(id));
      },
      enlaceInvitacion: async (id) => rutaDe((await conAviso(api.enlace(id))).enlace),
      invitacion: async (token) => {
        try {
          return recibida(token, await api.invitacion(token));
        } catch (e) {
          if (e instanceof ReglaError && e.codigo === 'INVITACION_NO_VALIDA') return null;
          throw e;
        }
      },
      aceptar: async (token, nombre, diezmoAportes) => {
        const s = await conFinanzas(api.aceptar(token, nombre, diezmoAportes));
        return this.aSesion(s);
      },
      salir: async () => {
        await conFinanzas(api.salir());
      },
      categorias: async () => [...(this.finanzas?.categorias ?? [])].sort((a, b) => a.orden - b.orden).map(categoria),
      guardarCategoria: async (datos) => {
        await conFinanzas(datos.id ? api.renombrarCategoria(datos.id, datos.nombre) : api.crearCategoria(datos.nombre));
      },
      definirDiezmoEnHoy: async (modo) => {
        await conFinanzas(api.definirDiezmoEnHoy(modo));
      },
    };
  }

  /** Ingresos fijos, regla, "Recibi", aportes y "Entregado", todo en el backend. */
  private crearIngresos(): IngresosPort {
    const api = this.d.api;
    const escribir = async (accion: Promise<unknown>): Promise<void> => {
      await accion;
      await this.recargarFinanzas();
    };
    return {
      fijos: async (todos = false) =>
        (this.finanzas?.ingresosFijos ?? []).filter((f) => f.activo && (todos || f.usuarioId === this.titularId)).map(ingresoFijo),
      guardarFijo: (datos) => {
        const cuerpo = { nombre: datos.nombre, bruto: datos.bruto, neto: datos.neto, diaPago: datos.diaPago, cuentaId: datos.cuentaId };
        return escribir(datos.id ? api.editarIngreso(datos.id, cuerpo) : api.crearIngreso(cuerpo));
      },
      quitarFijo: (id) => escribir(api.quitarIngreso(id)),
      regla: async () => {
        const r = this.finanzas?.reglas.find((x) => x.usuarioId === this.titularId);
        return r ? regla(r) : null;
      },
      guardarRegla: (datos) => escribir(api.guardarRegla(datos)),
      marcarRecibido: async (ingresoFijoId, ref) => {
        this.mesDelBackend(ref);
        try {
          await escribir(api.recibido(ingresoFijoId));
        } catch (e) {
          // Ya estaba recibido (otro miembro, otra pestana): se muestra el mensaje con el ingreso ya como recibido.
          if (e instanceof ReglaError && e.codigo === 'YA_RECIBIDO') await this.recargarFinanzas();
          throw e;
        }
      },
      registrarAporte: (datos) =>
        escribir(api.aportar({ usuarioId: datos.usuarioId, monto: datos.monto, mes: datos.ref, cuentaId: datos.cuentaId, aplicaDiezmo: datos.aplicaDiezmo })),
      // Todas las obligaciones son reales: de ingresos recibidos y de aportes.
      entregarDiezmo: async (obligaciones, ref, cuentaId) => {
        this.mesDelBackend(ref);
        const cuentaReal = cuentaId && this.finanzas?.cuentas.some((c) => c.id === cuentaId) ? cuentaId : null;
        await escribir(api.entregarDiezmo(obligaciones, cuentaReal));
      },
    };
  }

  /** "Marcar pago" y "Registrar gasto" en el backend; Hoy se calcula con el dominio sobre lo real. */
  private crearMovimientos(): MovimientosPort {
    const api = this.d.api;
    return {
      resumenMes: (ref) => this.demoActual.movimientos.resumenMes(ref),
      previsualizarGasto: (ref, itemId, monto) => this.demoActual.movimientos.previsualizarGasto(ref, itemId, monto),
      marcarPago: async (datos) => {
        this.mesDelBackend(datos.ref);
        try {
          await api.pagar({ itemId: datos.itemId, monto: datos.monto, usuarioId: datos.usuarioId, origen: origenApi(datos.origen) });
        } finally {
          // Tambien con YA_PAGADO: el otro miembro lo pago hace un momento y Hoy debe mostrarlo pagado.
          await this.recargarFinanzas();
        }
      },
      registrarGasto: async (datos) => {
        this.mesDelBackend(datos.ref);
        await api.gastar({ itemId: datos.itemId, monto: datos.monto, nota: datos.nota, usuarioId: datos.usuarioId, origen: origenApi(datos.origen) });
        await this.recargarFinanzas();
      },
    };
  }

  /**
   * El plan del mes en el backend, con su Opcion A. Las lecturas (inicio, mes, comparar, anual) siguen en el dominio
   * sobre lo real; varias opciones llegan en la Etapa 7 y crear meses desde el anual en la Etapa 8.
   */
  private crearPlan(): PlanPort {
    const api = this.d.api;
    const demo = () => this.demoActual.plan;
    const escribir = async (accion: Promise<unknown>): Promise<void> => {
      await accion;
      await this.recargarFinanzas();
    };
    const etapa7 = () => Promise.reject(new ReglaError('ETAPA_7', 'Varias opciones por mes llegan en una próxima versión.'));
    return {
      inicio: () => demo().inicio(),
      mes: (ref) => demo().mes(ref),
      loQueTrae: (ref) => demo().loQueTrae(ref),
      comparar: (ref) => demo().comparar(ref),
      anual: (anio) => demo().anual(anio),
      agregarEvento: (anio, evento) => demo().agregarEvento(anio, evento),
      editarMontoAnual: (anio, categoriaId, mes, monto) => demo().editarMontoAnual(anio, categoriaId, mes, monto),
      crearMes: (ref, modo) => escribir(api.crearPlan(ref, modo)),
      guardarItem: (planId, escenarioId, item) => {
        const cuerpo = { categoriaId: item.categoriaId, nombre: item.nombre, monto: item.monto, diaVence: item.diaVence, tipo: item.tipo, cuota: item.cuota };
        return escribir(item.id ? api.editarItem(planId, escenarioId, item.id, cuerpo) : api.crearItem(planId, escenarioId, cuerpo));
      },
      quitarItem: (planId, escenarioId, itemId) => escribir(api.quitarItem(planId, escenarioId, itemId)),
      usar: (planId, escenarioId) => escribir(api.usarOpcion(planId, escenarioId)),
      duplicar: etapa7,
      crearMesesDesdeAnual: () => Promise.reject(new ReglaError('ETAPA_8', 'Crear los meses desde el plan anual llega en una próxima versión.')),
    };
  }

  /** Cuentas reales; cuadrar y mover llegan en la Etapa 5, y los creditos siguen de prueba. */
  private crearCuentas(): CuentasPort {
    const etapa5 = () => Promise.reject(new ReglaError('ETAPA_5', 'Cuadrar y mover dinero llegan en una próxima versión.'));
    return {
      cuentas: (filtro) => this.demoActual.cuentas.cuentas(filtro),
      agregar: async (datos) => {
        if (datos.titularId !== null && datos.titularId !== this.titularId) {
          throw new ReglaError('SOLO_TUYAS', 'Solo puedes agregar cuentas a tu nombre o conjuntas.');
        }
        await this.d.api.crearCuenta(datos.nombre, datos.titularId === null ? 'CONJUNTA' : 'YO', datos.saldo);
        await this.recargarFinanzas();
      },
      mover: etapa5,
      diferencia: (cuentaId, saldoBanco) => this.demoActual.cuentas.diferencia(cuentaId, saldoBanco),
      cuadrar: etapa5,
      creditos: () => this.demoActual.cuentas.creditos(),
      credito: (id) => this.demoActual.cuentas.credito(id),
      actualizarSaldo: (id, saldo) => this.demoActual.cuentas.actualizarSaldo(id, saldo),
      registrarAbono: (id, monto, origen) => this.demoActual.cuentas.registrarAbono(id, monto, origen),
      simular: (id, abono) => this.demoActual.cuentas.simular(id, abono),
      // El plan del mes ya es real y solo tiene la Opcion A: probar un abono como opcion llega despues.
      probarComoOpcion: () => Promise.reject(new ReglaError('ETAPA_7', 'Probar un abono como opción llega en una próxima versión.')),
    };
  }

  /** "Recibi", "Entregado", pagos y gastos son del mes en curso del backend (design D4 y D6). */
  private mesDelBackend(ref: { anio: number; mes: number }): void {
    const mes = this.finanzas?.mes;
    if (mes && (mes.anio !== ref.anio || mes.mes !== ref.mes)) {
      throw new ReglaError('MES_NO_DISPONIBLE', 'Solo se puede registrar en el mes en curso.');
    }
  }

  private async vista(h: HogarApi): Promise<VistaHogar> {
    // Los nombres de los miembros entran a la superposicion ("Aportes {nombre}"): si cambian, las vistas se recalculan.
    const nuevos = h.miembros.map((m) => m.usuario);
    const antes = this.miembrosReales.map((u) => `${u.id}:${u.nombre}`).join();
    if (nuevos.length && nuevos.map((u) => `${u.id}:${u.nombre}`).join() !== antes) {
      this.miembrosReales = nuevos;
      this.avisar();
    }
    const diezmoEnHoy = this.finanzas?.diezmoEnHoy ?? 'SEPARADO';
    const invitaciones = h.invitaciones.map(invitacion);
    return {
      hogar: {
        id: h.id,
        nombre: h.nombre,
        configurado: h.configurado,
        diezmoEnHoy,
        miembros: h.miembros.map((m) => ({ usuarioId: m.usuario.id, unidoEn: m.unidoEn })),
        invitaciones,
      },
      miembros: h.miembros.map((m) => ({ usuario: usuarioDe(m.usuario), unidoEn: m.unidoEn, esActual: m.esActual })),
      invitaciones,
    };
  }
}

const HOGAR_VACIO: HogarApi = { id: '', nombre: '', configurado: false, miembros: [], invitaciones: [] };

function origenApi(o: Origen): OrigenRequest {
  return o.tipo === 'CUENTA' ? { tipo: 'CUENTA', cuentaId: o.cuentaId } : { tipo: o.tipo };
}

/** Fecha del hogar (Colombia) de un instante del backend. */
function fechaDe(iso: string): Fecha {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function invitacion(i: InvitacionApi): Invitacion {
  // El token en claro no vuelve del backend: solo viaja en el enlace (design D7).
  return { id: i.id, email: i.email, token: '', estado: i.estado, expiraEn: fechaDe(i.expiraEn), creadaPor: '', enviadaEn: fechaDe(i.enviadaEn) };
}

function invitacionConectada(r: InvitacionEnviadaApi): InvitacionConectada {
  return { ...invitacion(r.invitacion), correoEnviado: r.correoEnviado, enlace: rutaDe(r.enlace) };
}

/** El backend arma el enlace con su origen publico; la PWA usa la ruta sobre su propio origen. */
function rutaDe(enlace: string): string {
  try {
    return new URL(enlace).pathname;
  } catch {
    return enlace;
  }
}

function recibida(token: string, r: InvitacionRecibidaApi): InvitacionRecibida {
  return { token, hogar: r.hogar, invitadoPor: usuarioDe(r.invitadoPor), miembros: r.miembros.map(usuarioDe), email: r.email };
}
