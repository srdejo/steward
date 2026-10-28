package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.VistaHogar;
import reactor.core.publisher.Mono;

/** El hogar del usuario de la sesion (spec steward-hogar). */
public interface IHogarServicePort {

    Mono<VistaHogar> crear(String nombre);

    Mono<VistaHogar> obtener();

    Mono<VistaHogar> renombrar(String nombre);

    Mono<Void> completarOnboarding();

    Mono<Void> salir();
}
