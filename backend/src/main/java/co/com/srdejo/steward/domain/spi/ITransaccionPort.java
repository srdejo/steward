package co.com.srdejo.steward.domain.spi;

import reactor.core.publisher.Mono;

/** Ejecuta varias escrituras como una sola transaccion, sin que el dominio conozca Spring. */
public interface ITransaccionPort {

    <T> Mono<T> enTransaccion(Mono<T> trabajo);
}
