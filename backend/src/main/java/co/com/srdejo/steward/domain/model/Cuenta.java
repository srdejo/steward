package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Cuenta del hogar. {@code titularId} null es la conjunta. Nace sin cuadrar, con el saldo aproximado como ultimo cuadre;
 * cuadrar llega en la Etapa 5.
 */
public record Cuenta(UUID id, UUID hogarId, String nombre, UUID titularId, long saldoCuadre, LocalDate fechaCuadre,
                     boolean cuadrada) {

    public static final int NOMBRE_MAX = 60;
}
