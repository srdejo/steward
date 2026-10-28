package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.EstadoHogar;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface IHogarPersistencePort {

    /** Si el usuario tiene hogar y si ese hogar termino el onboarding. */
    Mono<EstadoHogar> estadoDe(UUID usuarioId);
}
