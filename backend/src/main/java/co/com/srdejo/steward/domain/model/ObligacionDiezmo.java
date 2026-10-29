package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.util.UUID;

/** Diezmo pendiente de un ingreso recibido; {@code id} es el del movimiento que la genera. */
public record ObligacionDiezmo(UUID id, long monto, String detalle, UUID usuarioId, LocalDate fecha) {
}
