// Puertos de datos de Presupuesto Hogar, uno por modulo del handoff. Las pantallas solo hablan con
// estos puertos; hoy los implementa el adaptador de prueba (demo/) y mañana uno HTTP contra el backend.
// Todo es asincrono porque asi sera contra la red. Las vistas que devuelven son las de rules/.

import type {
  BaseDiezmo, Categoria, CierreMes, Credito, DiezmoEnHoy, EventoAnual, Fecha, Hogar, Id, IngresoFijo, Invitacion,
  ItemPlan, MesRef, Origen, Pesos, PlanMes, ReglaDiezmo, TipoCategoria, Usuario,
} from '../model';
import type {
  FiltroTitular, ModoNuevoMes, ResumenAnual, ResumenMes, ResumenMesPlan, VistaCierre, VistaCuenta, VistaOpcion,
} from '../rules';
import type { compararOpciones, loQueTraeElMes } from '../rules';

export type MetodoAcceso = 'GOOGLE' | 'FACE_ID' | 'CORREO';

export interface Preferencias {
  faceIdAlAbrir: boolean;
  ocultarMontos: boolean;
}

export interface Sesion {
  usuario: Usuario;
  /** El hogar ya paso por el onboarding. */
  hogarConfigurado: boolean;
  preferencias: Preferencias;
}

export interface SesionPort {
  actual(): Promise<Sesion | null>;
  /** En modo demo cualquier metodo entra como el titular del hogar de prueba. */
  iniciar(metodo: MetodoAcceso): Promise<Sesion>;
  cerrar(): Promise<void>;
  guardarPreferencias(cambios: Partial<Preferencias>): Promise<Preferencias>;
}

export interface VistaMiembro {
  usuario: Usuario;
  unidoEn: Fecha;
  esActual: boolean;
}

export interface VistaHogar {
  hogar: Hogar;
  miembros: VistaMiembro[];
  invitaciones: Invitacion[];
}

export interface InvitacionRecibida {
  token: string;
  hogar: string;
  invitadoPor: Usuario;
  miembros: Usuario[];
  email: string;
}

export interface HogarPort {
  obtener(): Promise<VistaHogar>;
  actualizarPerfil(nombre: string): Promise<void>;
  nombrar(nombre: string): Promise<void>;
  completarOnboarding(): Promise<void>;
  invitar(email: string): Promise<Invitacion>;
  reenviar(invitacionId: Id): Promise<void>;
  /** Enlace para copiar ("O copiar enlace de invitación"). */
  enlaceInvitacion(invitacionId: Id): Promise<string>;
  invitacion(token: string): Promise<InvitacionRecibida | null>;
  /** "Unirme": deja la sesion como el nuevo miembro. */
  aceptar(token: string, nombre: string, diezmoAportes: boolean): Promise<Sesion>;
  salir(): Promise<void>;
  categorias(): Promise<Categoria[]>;
  guardarCategoria(datos: { id?: Id; nombre: string; color?: string; tipo?: TipoCategoria }): Promise<void>;
  definirDiezmoEnHoy(modo: DiezmoEnHoy): Promise<void>;
}

export interface IngresosPort {
  /** Ingresos fijos del usuario actual (o de todos con `todos`). */
  fijos(todos?: boolean): Promise<IngresoFijo[]>;
  guardarFijo(datos: Omit<IngresoFijo, 'id' | 'usuarioId' | 'activo'> & { id?: Id }): Promise<void>;
  quitarFijo(id: Id): Promise<void>;
  /** Regla de diezmo del usuario actual (null si nunca la configuro). */
  regla(): Promise<ReglaDiezmo | null>;
  guardarRegla(datos: { activa: boolean; porcentaje: number; base: BaseDiezmo; aplicaAportes: boolean }): Promise<void>;
  marcarRecibido(ingresoFijoId: Id, ref: MesRef): Promise<void>;
  registrarAporte(datos: { usuarioId: Id; monto: Pesos; ref: MesRef; cuentaId: Id | null; aplicaDiezmo: boolean }): Promise<void>;
  entregarDiezmo(obligaciones: Id[], ref: MesRef, cuentaId: Id | null): Promise<void>;
}

export interface MovimientosPort {
  resumenMes(ref: MesRef): Promise<ResumenMes>;
  marcarPago(datos: { itemId: Id; ref: MesRef; monto: Pesos; usuarioId: Id; origen: Origen }): Promise<void>;
  registrarGasto(datos: { monto: Pesos; itemId: Id | null; nota: string; usuarioId: Id; origen: Origen; ref: MesRef }): Promise<void>;
  previsualizarGasto(ref: MesRef, itemId: Id, monto: Pesos): Promise<{ llevado: Pesos; presupuesto: Pesos }>;
}

export interface VistaMes {
  ref: MesRef;
  plan: PlanMes | null;
  estado: PlanMes['estado'] | 'SIN_PLAN';
  opciones: VistaOpcion[];
}

export interface PlanPort {
  inicio(): Promise<{ proximos: ResumenMesPlan[]; recientes: ResumenMesPlan[]; anual: ResumenAnual | null }>;
  mes(ref: MesRef): Promise<VistaMes>;
  loQueTrae(ref: MesRef): Promise<ReturnType<typeof loQueTraeElMes>>;
  crearMes(ref: MesRef, modo: ModoNuevoMes): Promise<void>;
  duplicar(planId: Id, escenarioId: Id): Promise<Id>;
  usar(planId: Id, escenarioId: Id): Promise<void>;
  guardarItem(planId: Id, escenarioId: Id, item: Omit<ItemPlan, 'id'> & { id?: Id }): Promise<void>;
  quitarItem(planId: Id, escenarioId: Id, itemId: Id): Promise<void>;
  comparar(ref: MesRef): Promise<ReturnType<typeof compararOpciones>>;
  anual(anio: number): Promise<ResumenAnual | null>;
  agregarEvento(anio: number, evento: Omit<EventoAnual, 'id'>): Promise<void>;
  editarMontoAnual(anio: number, categoriaId: Id, mes: number, monto: Pesos): Promise<void>;
  crearMesesDesdeAnual(anio: number): Promise<void>;
}

export interface VistaCredito {
  credito: Credito;
  cuotasRestantes: number | null;
  porcentajePagado: number;
}

export interface CuentasPort {
  cuentas(filtro?: FiltroTitular): Promise<{ cuentas: VistaCuenta[]; total: Pesos }>;
  agregar(datos: { nombre: string; titularId: Id | null; saldo: Pesos }): Promise<void>;
  mover(datos: { desde: Id; hacia: Id; monto: Pesos }): Promise<void>;
  diferencia(cuentaId: Id, saldoBanco: Pesos): Promise<Pesos>;
  cuadrar(saldos: { cuentaId: Id; saldoBanco: Pesos }[]): Promise<void>;
  creditos(): Promise<VistaCredito[]>;
  credito(id: Id): Promise<VistaCredito | null>;
  actualizarSaldo(creditoId: Id, saldo: Pesos): Promise<void>;
  registrarAbono(creditoId: Id, monto: Pesos, origen: Origen): Promise<void>;
  simular(creditoId: Id, abono: Pesos): Promise<{ cuotasMenos: number; interesesMenos: Pesos } | null>;
  probarComoOpcion(creditoId: Id, ref: MesRef, abono: Pesos): Promise<{ planId: Id; escenarioId: Id }>;
}

export interface CierrePort {
  vista(ref: MesRef): Promise<VistaCierre>;
  cerrar(ref: MesRef, reparto: { aAhorro: Pesos; aSiguiente: Pesos }): Promise<CierreMes>;
}

/** Solo existe en modo demo (Ajustes). */
export interface DemoPort {
  restablecer(): Promise<void>;
  probarDesdeCero(): Promise<void>;
}

/** Todos los puertos de la app, mas el reloj y el aviso de cambios. */
export interface Puertos {
  sesion: SesionPort;
  hogar: HogarPort;
  ingresos: IngresosPort;
  movimientos: MovimientosPort;
  plan: PlanPort;
  cuentas: CuentasPort;
  cierre: CierrePort;
  demo: DemoPort | null;
  /** Fecha de hoy segun el reloj de la app. */
  hoy(): Fecha;
  /** Avisa despues de cada escritura; devuelve la funcion para dejar de escuchar. */
  suscribir(listener: () => void): () => void;
}
