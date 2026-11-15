package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Tarjeta;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Tarjetas de credito del hogar (spec steward-tarjetas). */
public interface ITarjetaPersistencePort {

    Mono<Tarjeta> crear(Tarjeta tarjeta);

    Mono<Tarjeta> actualizar(Tarjeta tarjeta);

    Mono<Tarjeta> porIdEnHogar(UUID id, UUID hogarId);

    /** En el orden en que se agregaron. */
    Flux<Tarjeta> delHogar(UUID hogarId);

    /** Sus items quedan sin enlace (ON DELETE SET NULL). */
    Mono<Void> borrar(UUID id);

    /** Una tarjeta que se paga completa sugiere lo pagado para el proximo mes (design D1 de tarjetas-y-creditos). */
    Mono<Void> pagada(UUID id, long monto);
}
