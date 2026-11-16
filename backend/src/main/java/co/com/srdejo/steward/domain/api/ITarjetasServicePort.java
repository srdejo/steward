package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Tarjeta;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Tarjetas de credito del hogar de la sesion (spec steward-tarjetas, design D6 de tarjetas-y-creditos). */
public interface ITarjetasServicePort {

    Flux<Tarjeta> delHogar();

    /**
     * "+ Tarjeta": su linea entra a la opcion principal del mes en curso si tiene plan y no esta cerrado; con {@code itemId},
     * ese item de Creditos del mes en curso pasa a ser su linea en lugar de crear otro.
     */
    Mono<Tarjeta> crear(DatosTarjeta datos, UUID itemId);

    /** Cambia los datos; las lineas de los meses en Borrador siguen el nombre, el dia y el monto nuevos. */
    Mono<Tarjeta> editar(UUID id, DatosTarjeta datos);

    /** Sus items quedan sin enlace y los pagos registrados no cambian. */
    Mono<Void> quitar(UUID id);

    /** {@code pagoTipo}: COMPLETA o FIJO; {@code pagoMonto}: el fijo o el estimado del extracto. */
    record DatosTarjeta(String nombre, int diaCorte, int diaPago, String uso, String pagoTipo, long pagoMonto) {
    }
}
