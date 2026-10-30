import type { BaseDiezmo, EstadoHogar, Fecha, Id, IngresoFijo, Pesos, ReglaDiezmo, TipoCategoria, Usuario } from '../model';
import { ReglaError, clonar, diasEntre, nuevoId } from './base';
import { ingresoFijoAlMes } from './ingresos';

/** Dias de vigencia de una invitacion (HANDOFF: token de un solo uso, sugerido 7 dias). */
export const DIAS_INVITACION = 7;

function sumarDias(fecha: Fecha, dias: number): Fecha {
  const d = new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function inicialDe(nombre: string): string {
  return (nombre.trim().charAt(0) || '?').toUpperCase();
}

export function actualizarPerfil(estado: EstadoHogar, datos: { usuarioId: Id; nombre: string }): EstadoHogar {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new ReglaError('NOMBRE_REQUERIDO', 'Escribe tu nombre');
  const s = clonar(estado);
  const u = s.usuarios.find((x) => x.id === datos.usuarioId);
  if (!u) throw new ReglaError('NO_EXISTE', 'No existe el usuario');
  u.nombre = nombre;
  u.inicial = inicialDe(nombre);
  return s;
}

export function nombrarHogar(estado: EstadoHogar, nombre: string): EstadoHogar {
  if (!nombre.trim()) throw new ReglaError('NOMBRE_REQUERIDO', 'El hogar necesita un nombre');
  const s = clonar(estado);
  s.hogar.nombre = nombre.trim();
  return s;
}

/** Regla de diezmo de una persona (onboarding paso 2 y Ajustes). Cada uno edita solo la suya. */
export function guardarRegla(estado: EstadoHogar, regla: ReglaDiezmo): EstadoHogar {
  if (regla.porcentaje <= 0 || regla.porcentaje > 100) throw new ReglaError('PORCENTAJE_INVALIDO', 'El porcentaje va de 1 a 100');
  const s = clonar(estado);
  s.reglas = [...s.reglas.filter((r) => r.usuarioId !== regla.usuarioId), regla];
  return s;
}

/** Con `fecha`, uno nuevo entra al plan del mes en curso (design D8 de diezmo-como-gasto). */
export function guardarIngresoFijo(estado: EstadoHogar, datos: Omit<IngresoFijo, 'id'> & { id?: Id }, fecha?: Fecha): EstadoHogar {
  if (!datos.nombre.trim()) throw new ReglaError('NOMBRE_REQUERIDO', 'El ingreso necesita un nombre');
  if (!(datos.neto > 0) || datos.bruto < datos.neto) throw new ReglaError('MONTO_INVALIDO', 'El bruto debe ser mayor o igual al neto');
  if (datos.diaPago < 1 || datos.diaPago > 31) throw new ReglaError('DIA_INVALIDO', 'El día de pago va de 1 a 31');
  const s = clonar(estado);
  const existente = datos.id ? s.ingresosFijos.find((f) => f.id === datos.id) : undefined;
  if (existente) Object.assign(existente, datos, { nombre: datos.nombre.trim() });
  else {
    const nuevo = { ...datos, nombre: datos.nombre.trim(), id: nuevoId(s, 'ing') };
    s.ingresosFijos.push(nuevo);
    if (fecha) ingresoFijoAlMes(s, nuevo, fecha);
  }
  return s;
}

export function quitarIngresoFijo(estado: EstadoHogar, id: Id): EstadoHogar {
  const s = clonar(estado);
  const f = s.ingresosFijos.find((x) => x.id === id);
  if (f) f.activo = false;
  return s;
}

/** Invitar por correo: queda Pendiente con un token de un solo uso que vence en 7 dias. */
export function invitar(estado: EstadoHogar, datos: { email: string; creadaPor: Id; fecha: Fecha; token: string }): EstadoHogar {
  const email = datos.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ReglaError('CORREO_INVALIDO', 'Escribe un correo válido');
  if (estado.usuarios.some((u) => u.email.toLowerCase() === email && estado.hogar.miembros.some((m) => m.usuarioId === u.id))) {
    throw new ReglaError('YA_ES_MIEMBRO', 'Esa persona ya está en el hogar');
  }
  const s = clonar(estado);
  const previa = s.hogar.invitaciones.find((i) => i.email === email && i.estado === 'PENDIENTE');
  if (previa) throw new ReglaError('YA_INVITADO', 'Ya hay una invitación pendiente para ese correo');
  s.hogar.invitaciones.push({ id: nuevoId(s, 'inv'), email, token: datos.token, estado: 'PENDIENTE', creadaPor: datos.creadaPor, enviadaEn: datos.fecha, expiraEn: sumarDias(datos.fecha, DIAS_INVITACION) });
  return s;
}

/** "Reenviar": renueva la fecha de envio y la vigencia. */
export function reenviarInvitacion(estado: EstadoHogar, datos: { invitacionId: Id; fecha: Fecha }): EstadoHogar {
  const s = clonar(estado);
  const inv = s.hogar.invitaciones.find((i) => i.id === datos.invitacionId && i.estado === 'PENDIENTE');
  if (!inv) throw new ReglaError('NO_EXISTE', 'No hay invitación pendiente');
  inv.enviadaEn = datos.fecha;
  inv.expiraEn = sumarDias(datos.fecha, DIAS_INVITACION);
  return s;
}

export function invitacionVigente(estado: EstadoHogar, token: string, hoy: Fecha) {
  const inv = estado.hogar.invitaciones.find((i) => i.token === token);
  if (!inv || inv.estado !== 'PENDIENTE') return null;
  if (diasEntre(hoy, inv.expiraEn) < 0) return null;
  return inv;
}

/** "Unirme": el invitado queda como miembro con los mismos permisos. No configura ingresos ni cuentas. */
export function aceptarInvitacion(estado: EstadoHogar, datos: { token: string; nombre: string; diezmoAportes: boolean; fecha: Fecha }): { estado: EstadoHogar; usuario: Usuario } {
  const inv = invitacionVigente(estado, datos.token, datos.fecha);
  if (!inv) throw new ReglaError('INVITACION_INVALIDA', 'La invitación ya se usó o venció');
  const nombre = datos.nombre.trim();
  if (!nombre) throw new ReglaError('NOMBRE_REQUERIDO', 'Escribe tu nombre');
  const s = clonar(estado);
  const usuario: Usuario = { id: nuevoId(s, 'usr'), nombre, email: inv.email, inicial: inicialDe(nombre) };
  s.usuarios.push(usuario);
  s.hogar.miembros.push({ usuarioId: usuario.id, unidoEn: datos.fecha });
  s.hogar.invitaciones.find((i) => i.id === inv.id)!.estado = 'ACEPTADA';
  if (datos.diezmoAportes) s.reglas.push({ usuarioId: usuario.id, activa: true, porcentaje: 10, base: 'BRUTO', aplicaAportes: true });
  return { estado: s, usuario };
}

export function salirDelHogar(estado: EstadoHogar, usuarioId: Id): EstadoHogar {
  const s = clonar(estado);
  s.hogar.miembros = s.hogar.miembros.filter((m) => m.usuarioId !== usuarioId);
  if (!s.hogar.miembros.length) s.hogar.configurado = false;
  return s;
}

export function completarOnboarding(estado: EstadoHogar): EstadoHogar {
  if (!estado.hogar.nombre.trim()) throw new ReglaError('NOMBRE_REQUERIDO', 'El hogar necesita un nombre');
  const s = clonar(estado);
  s.hogar.configurado = true;
  return s;
}

export function guardarCategoria(estado: EstadoHogar, datos: { id?: Id; nombre: string; color?: string; tipo?: TipoCategoria }): EstadoHogar {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new ReglaError('NOMBRE_REQUERIDO', 'La categoría necesita un nombre');
  if (nombre.toLowerCase() === 'diezmo') throw new ReglaError('RESERVADA', 'Diezmo ya es una categoría del sistema');
  if (estado.categorias.some((c) => c.id === datos.id && c.tipo === 'DIEZMO')) throw new ReglaError('RESERVADA', 'La categoría Diezmo no se renombra');
  const s = clonar(estado);
  if (s.categorias.some((c) => c.id !== datos.id && c.nombre.toLowerCase() === nombre.toLowerCase())) throw new ReglaError('DUPLICADA', 'Ya existe esa categoría');
  const existente = datos.id ? s.categorias.find((c) => c.id === datos.id) : undefined;
  if (existente) {
    existente.nombre = nombre;
    if (datos.color) existente.color = datos.color;
  } else {
    const orden = Math.max(0, ...s.categorias.filter((c) => c.orden < 90).map((c) => c.orden)) + 1;
    s.categorias.push({ id: nuevoId(s, 'cat'), nombre, color: datos.color ?? '#8D8F88', orden, tipo: datos.tipo ?? 'OTRO', sistema: false });
  }
  return s;
}

/** Valores por defecto del onboarding (paso 2). */
export const REGLA_POR_DEFECTO: Omit<ReglaDiezmo, 'usuarioId'> = { activa: true, porcentaje: 10, base: 'BRUTO' as BaseDiezmo, aplicaAportes: false };

export function previsualizarDiezmo(regla: Pick<ReglaDiezmo, 'activa' | 'porcentaje' | 'base'>, bruto: Pesos, neto: Pesos): Pesos | null {
  if (!regla.activa) return null;
  return Math.round(((regla.base === 'BRUTO' ? bruto : neto) * regla.porcentaje) / 100);
}
