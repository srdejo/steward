import type {
  Fecha,
  HogarPort,
  Invitacion,
  InvitacionRecibida,
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
  type InvitacionRecibidaApi,
  type SesionApi,
} from './api';
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
 * Puertos del modo conectado (design D9): sesion, hogar, miembros e invitaciones del backend; ingresos, plan,
 * movimientos, cuentas, cierre, categorias y "Diezmo en Hoy" del adaptador de prueba, con la persona real como
 * titular. El adaptador de prueba se rehace cuando cambia el usuario, asi que los modulos se leen con getters.
 */
export class PuertosConectados implements Puertos {
  private demoActual: Puertos;
  private titularId: string | null = null;
  private dejarDemo: () => void;
  private readonly oyentes = new Set<() => void>();
  private preferenciasLocales: Preferencias = { faceIdAlAbrir: false, ocultarMontos: false };

  readonly sesion: SesionPort;
  readonly hogar: HogarPort;

  constructor(private readonly d: Dependencias) {
    this.demoActual = this.nuevoDemo(null);
    this.dejarDemo = this.demoActual.suscribir(() => this.avisar());
    this.sesion = this.crearSesion();
    this.hogar = this.crearHogar();
  }

  get ingresos() {
    return this.demoActual.ingresos;
  }
  get movimientos() {
    return this.demoActual.movimientos;
  }
  get plan() {
    return this.demoActual.plan;
  }
  get cuentas() {
    return this.demoActual.cuentas;
  }
  get cierre() {
    return this.demoActual.cierre;
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
    this.avisar();
    return this.aSesion(s);
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
      this.avisar();
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
          await conAviso(api.crearHogar(nombre));
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
        const s = await conAviso(api.aceptar(token, nombre, diezmoAportes));
        return this.aSesion(s);
      },
      salir: async () => {
        await conAviso(api.salir());
      },
      categorias: () => this.demoActual.hogar.categorias(),
      guardarCategoria: (datos) => this.demoActual.hogar.guardarCategoria(datos),
      definirDiezmoEnHoy: (modo) => this.demoActual.hogar.definirDiezmoEnHoy(modo),
    };
  }

  private async vista(h: HogarApi): Promise<VistaHogar> {
    // "Diezmo en Hoy" sigue en el adaptador de prueba hasta la Etapa 3.
    const diezmoEnHoy = (await this.demoActual.hogar.obtener()).hogar.diezmoEnHoy;
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
