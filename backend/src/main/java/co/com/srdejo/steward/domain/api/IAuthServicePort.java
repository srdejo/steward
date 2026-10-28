package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Sesion;
import co.com.srdejo.steward.domain.model.Usuario;
import reactor.core.publisher.Mono;

import java.util.Optional;

/** Acceso: login con Google, sesion actual y perfil propio (spec steward-auth). */
public interface IAuthServicePort {

    Optional<String> googleClientId();

    /** Si el acceso de desarrollo (sin Google, solo local) esta encendido. */
    boolean devLogin();

    /** Acceso de desarrollo: sesion por correo y nombre. Apagado responde NO_ENCONTRADO, como si no existiera. */
    Mono<Sesion> loginDesarrollo(String email, String nombre);

    /** Sesion nueva con token. Crea el usuario la primera vez que entra un correo. */
    Mono<Sesion> loginConGoogle(String idToken);

    Mono<Sesion> sesionActual();

    Mono<Usuario> cambiarNombre(String nombre);
}
