package co.com.srdejo.steward.infrastructure.out.push;

import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.MensajeAviso;
import co.com.srdejo.steward.domain.spi.IEnvioPushPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Mono;

/**
 * Perfiles dev y contract: deja el aviso en el log en lugar de enviarlo. Un token que termina en {@code invalido]} se
 * reporta como no registrado, para el escenario "Token inválido" de los tests de contrato.
 */
public class LoggingEnvioPush implements IEnvioPushPort {

    private static final Logger log = LoggerFactory.getLogger(LoggingEnvioPush.class);
    private final String clavePublica;

    public LoggingEnvioPush(String clavePublica) {
        this.clavePublica = clavePublica == null || clavePublica.isBlank() ? null : clavePublica;
    }

    @Override
    public Mono<Boolean> enviar(DispositivoAviso d, MensajeAviso m) {
        log.info("[avisos] {} a {}: {} · {} {}", d.tipo(), d.usuarioId(), m.titulo(), m.cuerpo(), m.datos().keySet());
        return Mono.just(d.token().endsWith("invalido]"));
    }

    @Override
    public String clavePublicaWeb() {
        return clavePublica;
    }
}
