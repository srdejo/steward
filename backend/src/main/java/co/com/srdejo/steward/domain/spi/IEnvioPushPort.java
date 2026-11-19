package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.MensajeAviso;
import reactor.core.publisher.Mono;

import java.util.List;

/** Envio de push: Expo para la app y Web Push para la PWA (design D3 y D4 de avisos-pagos). */
public interface IEnvioPushPort {

    /** Envia el mensaje; true si el dispositivo ya no es valido y hay que quitarlo. */
    Mono<Boolean> enviar(DispositivoAviso dispositivo, MensajeAviso mensaje);

    /** La clave publica VAPID para suscribir navegadores; null si el push web no esta configurado. */
    String clavePublicaWeb();

    /**
     * Los tokens de la app que, segun los recibos de los envios anteriores, ya no reciben push y hay que quitar
     * (design D3 de avisos-pagos). Sin recibos que revisar, vacio.
     */
    default Mono<List<String>> tokensInvalidosPorRecibos() {
        return Mono.just(List.of());
    }
}
