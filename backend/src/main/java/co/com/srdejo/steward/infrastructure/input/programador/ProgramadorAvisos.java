package co.com.srdejo.steward.infrastructure.input.programador;

import co.com.srdejo.steward.domain.api.IAvisosServicePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;

/**
 * Cada 15 minutos, en hora de Colombia, corre los avisos (design D2 de avisos-pagos). Un reinicio no repite nada: lo
 * enviado queda en aviso_enviado. Se apaga con {@code steward.avisos.habilitados=false} (rollback del design).
 */
public class ProgramadorAvisos {

    private static final Logger log = LoggerFactory.getLogger(ProgramadorAvisos.class);
    private final IAvisosServicePort avisos;
    private final boolean habilitados;

    public ProgramadorAvisos(IAvisosServicePort avisos, boolean habilitados) {
        this.avisos = avisos;
        this.habilitados = habilitados;
    }

    @Scheduled(cron = "0 */15 * * * *", zone = "America/Bogota")
    public void correr() {
        if (!habilitados) return;
        try {
            avisos.correr().block(Duration.ofMinutes(10));
        } catch (RuntimeException ex) {
            log.warn("[avisos] La corrida fallo: {}", ex.getMessage());
        }
    }
}
