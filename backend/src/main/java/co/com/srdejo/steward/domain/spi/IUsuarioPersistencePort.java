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

    Mono<Usuario> porAppleSub(String sub);

    Mono<Usuario> enlazarApple(UUID id, String sub);

    /** Borra sus datos propios y el usuario; si quedan registros suyos en un hogar compartido, lo anonimiza. */
    Mono<Void> eliminar(UUID id);
}
