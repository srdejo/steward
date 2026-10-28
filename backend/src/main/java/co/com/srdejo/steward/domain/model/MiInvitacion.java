package co.com.srdejo.steward.domain.model;

import java.util.UUID;

/** Invitacion pendiente para el correo de la sesion: lo que ve quien entra sin el enlace. */
public record MiInvitacion(UUID id, InvitacionRecibida detalle) {
}
