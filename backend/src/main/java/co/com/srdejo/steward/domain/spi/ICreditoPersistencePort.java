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

    /** Paga una cuota segun el metodo del credito ({@link co.com.srdejo.steward.domain.model.Amortizacion}). La fecha del saldo no cambia. */
    Mono<Long> pagarCuota(UUID id, long monto);

    /**
     * Le devuelve al saldo lo que le bajo un pago o abono borrado (design D3 de usabilidad-plan). Si era una cuota, tambien
     * descuenta la cuota pagada (tarjetas-y-creditos).
     */
    Mono<Void> devolver(UUID id, long capital, boolean cuota);

    /** "Cambiar" como baja el saldo: el metodo y sus datos (design D3 de tarjetas-y-creditos). */
    Mono<Credito> cambiarMetodo(Credito credito);
}
