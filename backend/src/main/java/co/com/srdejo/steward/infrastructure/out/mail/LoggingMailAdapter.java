package co.com.srdejo.steward.infrastructure.out.mail;

import co.com.srdejo.steward.domain.spi.IMailPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Mono;

/**
 * Perfiles dev y contract: en vez de llamar a contact, deja el enlace en el log (como CodeLoggingMailAdapter de
 * denti-caja). Para el escenario "Correo caido" de los tests de contrato, los correos de {@code @correo-caido.test}
 * fallan como fallaria contact.
 */
public class LoggingMailAdapter implements IMailPort {

    static final String DOMINIO_CAIDO = "@correo-caido.test";
    private static final Logger log = LoggerFactory.getLogger(LoggingMailAdapter.class);

    @Override
    public Mono<Void> enviarInvitacion(String para, String quienInvita, String hogar, String enlace) {
        if (para.toLowerCase().endsWith(DOMINIO_CAIDO)) {
            return Mono.error(new IllegalStateException("contact no responde (simulado)"));
        }
        log.info("[correo] Invitacion de {} a {} para {}: {}", quienInvita, hogar, para, enlace);
        return Mono.empty();
    }

    @Override
    public Mono<Void> enviarResumenAvisos(String para, String nombre, java.util.List<co.com.srdejo.steward.domain.model.FilaResumenAviso> filas,
                                          long total, String enlace) {
        log.info("[correo] Resumen de avisos para {}: {} pagos, total {}", para, filas.size(), total);
        return Mono.empty();
    }
}
