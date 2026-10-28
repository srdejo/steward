package co.com.srdejo.steward.domain.spi;

import reactor.core.publisher.Mono;

import java.util.UUID;

/** Usuario de la sesion actual (design D6). Sin sesion valida, falla con NO_AUTENTICADO. */
public interface ICurrentUserPort {

    Mono<UUID> usuarioId();
}
