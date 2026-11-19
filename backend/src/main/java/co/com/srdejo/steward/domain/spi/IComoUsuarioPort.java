package co.com.srdejo.steward.domain.spi;

import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Corre una accion como si esa persona tuviera la sesion: "Ya lo pagué" desde un aviso llega sin sesion, con un
 * identificador firmado (design D5 de avisos-pagos), y registra el pago con las mismas reglas que Hoy.
 */
public interface IComoUsuarioPort {

    <T> Mono<T> como(UUID usuarioId, Mono<T> accion);
}
