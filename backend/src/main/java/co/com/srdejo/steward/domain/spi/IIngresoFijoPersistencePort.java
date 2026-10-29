package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.IngresoFijo;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Ingresos fijos. Las busquedas por id llevan el hogar del usuario (design D6 de backend-acceso-hogar). */
public interface IIngresoFijoPersistencePort {

    Mono<IngresoFijo> crear(IngresoFijo ingreso);

    /** Actualiza nombre, montos, dia, cuenta y si esta activo. */
    Mono<IngresoFijo> actualizar(IngresoFijo ingreso);

    Mono<IngresoFijo> porIdEnHogar(UUID id, UUID hogarId);

    /** Todos los del hogar, tambien los inactivos (lo recibido los sigue nombrando). */
    Flux<IngresoFijo> delHogar(UUID hogarId);

    /** Al salir del hogar: desactiva los ingresos de esa persona en ese hogar (design D7). */
    Mono<Void> desactivarDe(UUID hogarId, UUID usuarioId);
}
