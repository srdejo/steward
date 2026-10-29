package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Categoria;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.UUID;

/** Categorias del hogar. Un nombre repetido en el hogar falla con {@code DUPLICADA} (indice unico). */
public interface ICategoriaPersistencePort {

    Mono<Void> crearTodas(List<Categoria> categorias);

    Mono<Categoria> crear(Categoria categoria);

    Mono<Categoria> renombrar(Categoria categoria, String nombre);

    Mono<Categoria> porIdEnHogar(UUID id, UUID hogarId);

    /** En su orden. */
    Flux<Categoria> delHogar(UUID hogarId);
}
