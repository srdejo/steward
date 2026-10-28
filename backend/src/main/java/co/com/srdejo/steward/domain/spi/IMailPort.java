package co.com.srdejo.steward.domain.spi;

import reactor.core.publisher.Mono;

/** Correos del hogar. Siempre salen por la API contact del workspace: el backend no tiene SMTP (design D7). */
public interface IMailPort {

    Mono<Void> enviarInvitacion(String para, String quienInvita, String hogar, String enlace);
}
