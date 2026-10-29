package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.CierreMes;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.List;

/** "Cerrar {mes}" del hogar de la sesion (spec steward-plan-mes, design D1 de backend-cierre-mes). */
public interface ICierreServicePort {

    Mono<CierreMes> cerrar(DatosCierre datos);

    /**
     * La foto que calcula la PWA con {@code vistaCierre}, el reparto, y {@code ultimoSeq}: el orden del ultimo movimiento del
     * mes con que se calculo.
     */
    record DatosCierre(YearMonth ref, List<CierreMes.Fila> filas, long sinRegistrar, long sobrante, long aAhorro,
                       long aSiguiente, long ultimoSeq) {
    }
}
