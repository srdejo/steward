package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.PreferenciasAviso;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.UUID;

/** Dispositivos, configuracion y avisos enviados (V18, avisos-pagos). */
public interface IAvisoPersistencePort {

    /** Un token es de una sola persona: si ya existia, pasa a quien lo registra ahora. */
    Mono<Void> guardarDispositivo(DispositivoAviso dispositivo);

    /** Quita el dispositivo de esa persona; uno de otra persona no se toca. */
    Mono<Void> quitarDispositivo(UUID usuarioId, String token);

    /** Quita un token que el servicio de push reporto como invalido. */
    Mono<Void> quitarToken(String token);

    Flux<DispositivoAviso> dispositivos(UUID usuarioId);

    /** Sin fila, {@link PreferenciasAviso#DEFECTO}. */
    Mono<PreferenciasAviso> preferencias(UUID usuarioId);

    Mono<Void> guardarPreferencias(UUID usuarioId, PreferenciasAviso preferencias);

    /** Marca el aviso como enviado; false si ya lo estaba (restriccion unica: no se repite). */
    Mono<Boolean> reservar(UUID usuarioId, String clave, String momento, LocalDate fecha);

    /** "Recordar mañana": deja el aviso pendiente para esa fecha. */
    Mono<Void> posponer(UUID usuarioId, String clave, LocalDate fecha);

    /** Las claves pospuestas de una persona que tocan hasta esa fecha y no se han enviado. */
    Flux<String> pospuestos(UUID usuarioId, LocalDate hasta);

    Mono<Void> marcarPospuestoEnviado(UUID usuarioId, String clave, LocalDate hasta);
}
