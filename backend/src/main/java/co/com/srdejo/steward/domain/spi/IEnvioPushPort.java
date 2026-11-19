package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.MensajeAviso;
import reactor.core.publisher.Mono;

/** Envio de push: Expo para la app y Web Push para la PWA (design D3 y D4 de avisos-pagos). */
public interface IEnvioPushPort {

    /** Envia el mensaje; true si el dispositivo ya no es valido y hay que quitarlo. */
    Mono<Boolean> enviar(DispositivoAviso dispositivo, MensajeAviso mensaje);

    /** La clave publica VAPID para suscribir navegadores; null si el push web no esta configurado. */
    String clavePublicaWeb();
}
