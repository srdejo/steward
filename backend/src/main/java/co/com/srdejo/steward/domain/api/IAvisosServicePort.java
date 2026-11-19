package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Aviso;
import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.PreferenciasAviso;
import reactor.core.publisher.Mono;

import java.util.List;

/** Avisos de pagos para la persona con sesion (spec steward-avisos, "API de avisos"). */
public interface IAvisosServicePort {

    Mono<List<Aviso>> proximos();

    Mono<PreferenciasAviso> preferencias();

    Mono<PreferenciasAviso> guardarPreferencias(PreferenciasAviso preferencias);

    Mono<Void> registrarDispositivo(DispositivoAviso.Tipo tipo, String token, String p256dh, String auth);

    Mono<Void> quitarDispositivo(String token);

    /** Un aviso de prueba a los dispositivos de quien tiene la sesion. */
    Mono<Void> probar();

    /** La clave publica VAPID, o null si el push web no esta configurado. */
    String claveWeb();

    /** "Ya lo pagué" ({@code PAGADO}) o "Recordar mañana" ({@code MANANA}) con el identificador firmado, sin sesion. */
    Mono<Void> accion(String token, String que);

    /** La corrida del programador (cada 15 minutos): los push del dia y el resumen del lunes. */
    Mono<Void> correr();
}
