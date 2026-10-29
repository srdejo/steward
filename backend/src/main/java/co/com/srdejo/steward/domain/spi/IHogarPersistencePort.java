package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.DiezmoEnHoy;
import co.com.srdejo.steward.domain.model.EstadoHogar;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Miembro;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.UUID;

/** Hogares y miembros. Toda consulta parte del usuario o lleva el id del hogar del usuario (design D6). */
public interface IHogarPersistencePort {

    /** Si el usuario tiene hogar y si ese hogar termino el onboarding. */
    Mono<EstadoHogar> estadoDe(UUID usuarioId);

    /** El hogar del usuario; vacio si no tiene. */
    Mono<Hogar> hogarDe(UUID usuarioId);

    /** Solo para una invitacion ya validada por su token (sin sesion no hay usuario desde el cual resolverlo). */
    Mono<Hogar> porId(UUID hogarId);

    /**
     * Crea el hogar con el usuario como primer miembro. Si el usuario ya pertenece a un hogar, falla con
     * {@code YA_TIENE_HOGAR} (un hogar por usuario, garantizado por la base).
     */
    Mono<Hogar> crear(Hogar hogar, UUID usuarioId, LocalDate unidoEn);

    Mono<Void> renombrar(UUID hogarId, String nombre);

    Mono<Void> marcarConfigurado(UUID hogarId);

    Flux<Miembro> miembros(UUID hogarId);

    Mono<Boolean> tieneMiembroConEmail(UUID hogarId, String email);

    /** Une al usuario; si ya pertenece a un hogar, falla con {@code YA_TIENE_HOGAR}. */
    Mono<Void> unir(UUID hogarId, UUID usuarioId, LocalDate unidoEn);

    Mono<DiezmoEnHoy> diezmoEnHoy(UUID hogarId);

    Mono<Void> definirDiezmoEnHoy(UUID hogarId, DiezmoEnHoy modo);

    /** Quita al miembro; si era el ultimo, borra el hogar y sus invitaciones. */
    Mono<Void> salir(UUID hogarId, UUID usuarioId);
}
