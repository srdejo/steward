package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Credito;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Creditos del hogar. El saldo se cambia en una sola sentencia que lo lee y lo escribe, para que dos registros a la vez
 * no lo dejen mal (design D4 de backend-cuentas-creditos). Corre en la transaccion del caso de uso.
 */
public interface ICreditoPersistencePort {

    Mono<Credito> crear(Credito credito);

    Mono<Credito> porIdEnHogar(UUID id, UUID hogarId);

    /** Los creditos del hogar, sin sus pagos. */
    Flux<Credito> delHogar(UUID hogarId);

    Mono<Void> actualizarSaldo(UUID id, long saldo, LocalDate fecha);

    /** Baja el saldo en el abono. Vacio si el abono es mayor que el saldo (y no cambia nada). */
    Mono<Credito> abonar(UUID id, long monto, LocalDate fecha);

    /**
     * Baja el saldo en la parte de capital de una cuota: el monto menos el interes del mes, sin bajar de cero. La fecha del
     * saldo no cambia, como en el dominio.
     */
    Mono<Void> pagarCuota(UUID id, long monto);
}
