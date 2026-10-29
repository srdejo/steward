package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Movimiento;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.UUID;

/** Movimientos del hogar. */
public interface IMovimientoPersistencePort {

    /**
     * Registra un ingreso recibido. Si ese ingreso ya se recibio en el mes, falla con {@code YA_RECIBIDO}: lo garantiza
     * el indice unico, aunque lleguen dos a la vez.
     */
    Mono<Movimiento> registrarRecibido(Movimiento recibido);

    /**
     * Registra una entrega de diezmo con las obligaciones que cubre ({@code diezmoDe}). Si alguna ya estaba cubierta,
     * falla con {@code SIN_DIEZMO} sin registrar nada (la PK de {@code diezmo_cubierto}). Corre en la transaccion del caso
     * de uso.
     */
    Mono<Movimiento> registrarEntrega(Movimiento entrega);

    /**
     * Registra un pago, un gasto o un aporte. Un segundo PAGO del mismo item en el mes falla con {@code YA_PAGADO}
     * (indice unico), aunque lleguen dos a la vez.
     */
    Mono<Movimiento> registrar(Movimiento movimiento);

    /** Los movimientos del mes, con {@code diezmoDe} lleno en las entregas, en orden de registro. */
    Flux<Movimiento> delMes(UUID hogarId, YearMonth mes);

    /** Los movimientos desde ese mes en adelante, en orden de registro. */
    Flux<Movimiento> desde(UUID hogarId, YearMonth desde);

    /** El PAGO de ese item en ese mes, si ya lo hay. */
    Mono<Movimiento> pagoDe(UUID itemId, YearMonth mes);

    /** Si el item tiene pagos o gastos (cualquier mes). */
    Mono<Boolean> hayDeItem(UUID itemId);
}
