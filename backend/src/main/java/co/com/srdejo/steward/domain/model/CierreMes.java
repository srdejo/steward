package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * El cierre de un mes, como {@code CierreMes} del dominio compartido: la foto que calcula la PWA con {@code vistaCierre}
 * y el reparto del sobrante (design D1 de backend-cierre-mes). El backend la valida y la guarda; no recalcula las filas.
 */
public record CierreMes(UUID id, UUID hogarId, YearMonth ref, List<Fila> filas, long sinRegistrar, long sobrante,
                        long aAhorro, long aSiguiente, UUID cerradoPor, LocalDate cerradoEn) {

    public CierreMes {
        filas = filas == null ? List.of() : List.copyOf(filas);
    }

    /** {@code repartoValido} del dominio: los dos de cero en adelante y suman lo que sobro (o cero si no sobro). */
    public boolean repartoValido() {
        return aAhorro >= 0 && aSiguiente >= 0 && aAhorro + aSiguiente == Math.max(0, sobrante);
    }

    /** Una fila plan vs. real; {@code plan} null es "No estaba planeado". */
    public record Fila(String nombre, Long plan, long real) {
    }
}
