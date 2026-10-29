package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Cuenta;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Cuentas basicas del hogar (Etapa 3); el cuadre llega en la Etapa 5. */
public interface ICuentaPersistencePort {

    Mono<Cuenta> crear(Cuenta cuenta);

    Mono<Cuenta> porIdEnHogar(UUID id, UUID hogarId);

    Flux<Cuenta> delHogar(UUID hogarId);

    /** Al salir del hogar: quita las cuentas propias de esa persona; las conjuntas siguen (design D7). */
    Mono<Void> quitarPropias(UUID hogarId, UUID usuarioId);
}
