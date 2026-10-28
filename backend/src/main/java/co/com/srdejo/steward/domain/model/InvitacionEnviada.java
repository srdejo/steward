package co.com.srdejo.steward.domain.model;

/**
 * Resultado de invitar, reenviar u obtener el enlace: la invitacion, su enlace (con el token nuevo) y si el correo
 * salio. Si {@code correoEnviado} es falso, la invitacion igual quedo creada y el enlace se puede copiar.
 */
public record InvitacionEnviada(Invitacion invitacion, String enlace, boolean correoEnviado, boolean nueva) {
}
