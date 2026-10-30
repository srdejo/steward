package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.CierreMes;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.UUID;

/** Cierres de mes del hogar (design D2 y D3 de backend-cierre-mes). */
public interface ICierrePersistencePort {

    /**
     * Guarda el cierre con sus filas y deja el plan del mes, si lo hay, en CERRADO. Si el mes ya estaba cerrado falla con
     * {@code MES_CERRADO} (indice unico), aunque lleguen dos a la vez. Corre en la transaccion del caso de uso.
     */
    Mono<CierreMes> guardar(CierreMes cierre);

    /** Los cierres desde ese mes en adelante, con sus filas en orden. */
    Flux<CierreMes> desde(UUID hogarId, YearMonth desde);

    /** Como {@code asegurarAbierto} del dominio: el plan del mes esta CERRADO o el mes tiene cierre. */
    Mono<Boolean> estaCerrado(UUID hogarId, YearMonth mes);

    /** Borra el cierre del mes, si lo tiene (design D4 de usabilidad-plan). */
    Mono<Void> borrar(UUID hogarId, YearMonth mes);
}
