package co.com.srdejo.steward.domain.model;

import java.util.List;
import java.util.UUID;

/** Categoria de gasto del hogar. Las del sistema nacen con cada hogar y no se borran (si se renombran). */
public record Categoria(UUID id, UUID hogarId, String nombre, String color, int orden, Tipo tipo, boolean sistema) {

    public static final int NOMBRE_MAX = 40;
    public static final String COLOR_NUEVA = "#8D8F88";

    public enum Tipo {
        FIJO,
        TARJETA,
        VARIABLE,
        CREDITO,
        OTRO
    }

    /** Las cuatro del sistema, como en el dominio compartido (seed.ts), en su orden. */
    public static List<Categoria> delSistema(UUID hogarId) {
        return List.of(
                new Categoria(UUID.randomUUID(), hogarId, "Gastos fijos", "#E2551B", 1, Tipo.FIJO, true),
                new Categoria(UUID.randomUUID(), hogarId, "Tarjetas y cuotas", "#7C4DDB", 2, Tipo.TARJETA, true),
                new Categoria(UUID.randomUUID(), hogarId, "Variables", "#8D8F88", 3, Tipo.VARIABLE, true),
                new Categoria(UUID.randomUUID(), hogarId, "Créditos", "#2E6B45", 4, Tipo.CREDITO, true));
    }
}
