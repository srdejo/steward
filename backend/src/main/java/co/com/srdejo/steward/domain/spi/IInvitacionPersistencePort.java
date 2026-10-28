package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Invitacion;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

/** Invitaciones. Solo se guarda el hash del token (design D7); las busquedas por id llevan el hogar (D6). */
public interface IInvitacionPersistencePort {

    Mono<Invitacion> crear(Invitacion invitacion, String tokenHash);

    Flux<Invitacion> pendientesVigentes(UUID hogarId, Instant ahora);

    /** La pendiente para ese correo en el hogar, vigente o no (una sola por correo). */
    Mono<Invitacion> pendientePorEmail(UUID hogarId, String email);

    Mono<Invitacion> porIdEnHogar(UUID id, UUID hogarId);

    Mono<Invitacion> porTokenHash(String tokenHash);

    /** Token nuevo y nuevo vencimiento: el enlace anterior deja de servir. */
    Mono<Invitacion> rotar(UUID id, UUID hogarId, String tokenHash, Instant enviadaEn, Instant expiraEn);

    /** Marca aceptada solo si sigue pendiente; devuelve si la marco (un solo uso). */
    Mono<Boolean> marcarAceptada(UUID id, UUID usuarioId, Instant ahora);
}
