package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Cuenta;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.UUID;

/** Cuentas del hogar. */
public interface ICuentaPersistencePort {

    Mono<Cuenta> crear(Cuenta cuenta);

    Mono<Cuenta> porIdEnHogar(UUID id, UUID hogarId);

    /** La cuenta, bloqueada hasta el final de la transaccion: para cuadrarla (design D3 de backend-cuentas-creditos). */
    Mono<Cuenta> paraCuadrar(UUID id, UUID hogarId);

    /** Deja la cuenta cuadrada hoy con lo que dijo el banco; {@code seqCuadre} es lo ultimo incluido en ese saldo. */
    Mono<Cuenta> cuadrar(Cuenta cuenta, long saldoBanco, LocalDate fecha, long seqCuadre);

    Flux<Cuenta> delHogar(UUID hogarId);

    /** Al salir del hogar: quita las cuentas propias de esa persona; las conjuntas siguen (design D7). */
    Mono<Void> quitarPropias(UUID hogarId, UUID usuarioId);
}
