package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import org.springframework.transaction.reactive.TransactionalOperator;
import reactor.core.publisher.Mono;

/** Transaccion R2DBC: las consultas del DatabaseClient dentro de {@code trabajo} usan la misma conexion. */
public class TransaccionAdapter implements ITransaccionPort {

    private final TransactionalOperator operator;

    public TransaccionAdapter(TransactionalOperator operator) {
        this.operator = operator;
    }

    @Override
    public <T> Mono<T> enTransaccion(Mono<T> trabajo) {
        return operator.transactional(trabajo);
    }
}
