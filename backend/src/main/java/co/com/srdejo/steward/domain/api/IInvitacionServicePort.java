package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.InvitacionEnviada;
import co.com.srdejo.steward.domain.model.InvitacionRecibida;
import co.com.srdejo.steward.domain.model.Sesion;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Invitaciones por correo con token de un solo uso (spec steward-hogar). */
public interface IInvitacionServicePort {

    Mono<InvitacionEnviada> invitar(String email);

    Mono<InvitacionEnviada> reenviar(UUID invitacionId);

    Mono<InvitacionEnviada> enlace(UUID invitacionId);

    /** Publica: no exige sesion. */
    Mono<InvitacionRecibida> consultar(String token);

    Mono<Sesion> aceptar(String token, String nombre, boolean diezmoAportes);
}
