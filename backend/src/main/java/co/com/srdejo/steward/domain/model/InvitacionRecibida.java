package co.com.srdejo.steward.domain.model;

import java.util.List;

/** Lo que ve quien abre un enlace de invitacion, sin sesion. */
public record InvitacionRecibida(String hogar, Usuario invitadoPor, List<Usuario> miembros, String email) {
}
