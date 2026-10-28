package co.com.srdejo.steward.domain.model;

import java.util.List;
import java.util.UUID;

/** Lo que ve un miembro de su hogar: miembros (marcando cual es el) e invitaciones pendientes y vigentes. */
public record VistaHogar(Hogar hogar, List<Miembro> miembros, UUID usuarioActual, List<Invitacion> invitaciones) {
}
