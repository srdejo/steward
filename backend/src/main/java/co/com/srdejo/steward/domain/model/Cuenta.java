package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Cuenta del hogar. {@code titularId} null es la conjunta. Nace sin cuadrar, con el saldo aproximado como ultimo cuadre.
 * {@code seqCuadre} es el orden del ultimo movimiento incluido en {@code saldoCuadre}: el saldo estimado le suma lo
 * registrado despues (design D1 de backend-cuentas-creditos).
 */
public record Cuenta(UUID id, UUID hogarId, String nombre, UUID titularId, long saldoCuadre, LocalDate fechaCuadre,
                     boolean cuadrada, long seqCuadre) {

    public static final int NOMBRE_MAX = 60;

    /** Una cuenta nueva: su {@code seqCuadre} lo fija la base al guardarla. */
    public Cuenta(UUID id, UUID hogarId, String nombre, UUID titularId, long saldoCuadre, LocalDate fechaCuadre,
                  boolean cuadrada) {
        this(id, hogarId, nombre, titularId, saldoCuadre, fechaCuadre, cuadrada, 0);
    }
}
