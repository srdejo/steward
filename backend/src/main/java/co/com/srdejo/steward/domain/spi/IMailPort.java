package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.FilaResumenAviso;
import reactor.core.publisher.Mono;

import java.util.List;

/** Correos del hogar. Siempre salen por la API contact del workspace: el backend no tiene SMTP (design D7). */
public interface IMailPort {

    Mono<Void> enviarInvitacion(String para, String quienInvita, String hogar, String enlace);

    /** El resumen del lunes: los pagos de la semana y lo vencido, con el total y un enlace a Avisos (avisos-pagos). */
    Mono<Void> enviarResumenAvisos(String para, String nombre, List<FilaResumenAviso> filas, long total, String enlace);
}
