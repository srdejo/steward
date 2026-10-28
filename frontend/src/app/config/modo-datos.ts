/**
 * De donde salen los datos (design D9, spec steward-ui-shell):
 * - `conectado`: sesion, hogar, miembros e invitaciones vienen del backend; el resto sigue con datos de prueba.
 * - `demo`: todo con el adaptador de prueba, sin backend.
 */
export type ModoDatos = 'conectado' | 'demo';
