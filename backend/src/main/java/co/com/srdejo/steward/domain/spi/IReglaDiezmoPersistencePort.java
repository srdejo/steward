package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Collection;
import java.util.UUID;

/** Reglas de diezmo, una por persona. */
public interface IReglaDiezmoPersistencePort {

    /** La regla de la persona; vacio si nunca la configuro. */
    Mono<ReglaDiezmo> dePersona(UUID usuarioId);

    Flux<ReglaDiezmo> dePersonas(Collection<UUID> usuarioIds);

    /** Crea o reemplaza la regla de la persona. */
    Mono<ReglaDiezmo> guardar(ReglaDiezmo regla);

    /**
     * Al unirse a un hogar (spec steward-hogar, "Aceptar una invitacion"): sin regla y con diezmo, crea 10 % del bruto
     * sobre aportes; con regla, solo cambia si aplica a los aportes; sin regla y sin diezmo, nada.
     */
    Mono<Void> alUnirse(UUID usuarioId, boolean diezmoAportes);
}
