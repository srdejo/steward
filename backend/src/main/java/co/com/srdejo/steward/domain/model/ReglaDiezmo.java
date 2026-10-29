package co.com.srdejo.steward.domain.model;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Regla de diezmo de una persona (spec steward-finanzas, "Regla de diezmo propia"). Es suya, no del hogar: la conserva
 * si sale y entra a otro. Se aplica a sus ingresos fijos y, si {@code aplicaAportes}, a sus aportes.
 */
public record ReglaDiezmo(UUID usuarioId, boolean activa, BigDecimal porcentaje, Base base, boolean aplicaAportes) {

    public enum Base {
        BRUTO,
        NETO
    }

    /** La que queda al unirse eligiendo "diezmar de mis aportes", como {@code aceptarInvitacion} del dominio. */
    public static ReglaDiezmo deAportes(UUID usuarioId) {
        return new ReglaDiezmo(usuarioId, true, BigDecimal.TEN, Base.BRUTO, true);
    }
}
