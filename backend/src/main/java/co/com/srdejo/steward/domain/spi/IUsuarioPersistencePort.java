package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Usuario;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface IUsuarioPersistencePort {

    Mono<Usuario> porId(UUID id);

    /** Busca sin distinguir mayusculas. */
    Mono<Usuario> porEmail(String email);

    /**
     * Crea el usuario; si otro hilo creo el mismo correo al mismo tiempo, devuelve el existente (correo unico en la
     * base).
     */
    Mono<Usuario> crearOObtener(Usuario usuario);

    Mono<Usuario> actualizarNombre(UUID id, String nombre);
}
