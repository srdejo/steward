package co.com.srdejo.steward.domain.model;

import java.util.UUID;

/** Ingreso fijo de una persona en su hogar. Quitarlo lo desactiva: lo ya recibido lo sigue nombrando. */
public record IngresoFijo(UUID id, UUID hogarId, UUID usuarioId, String nombre, long bruto, long neto, int diaPago,
                          UUID cuentaId, boolean activo) {

    public static final int NOMBRE_MAX = 60;
}
