package co.com.srdejo.steward.domain.model;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Categoria de gasto del hogar. Las del sistema nacen con cada hogar y no se borran (si se renombran, salvo Diezmo, design
 * D1 de diezmo-como-gasto). Todas cambian de color con la paleta, Diezmo incluida (color-categorias).
 */
public record Categoria(UUID id, UUID hogarId, String nombre, String color, int orden, Tipo tipo, boolean sistema) {

    public static final int NOMBRE_MAX = 40;
    /** El color de una categoria nueva si no se elige otro (color-categorias). */
    public static final String COLOR_NUEVA = "#8A8D85";

    /** Los colores que se pueden elegir, como PALETA_CATEGORIAS del dominio compartido (design D1 de color-categorias). */
    public static final List<String> PALETA = List.of("#C2603A", "#8A8D85", "#6B5BA8", "#3F6E9E", "#2C7A70", "#A87A1E",
            "#9A4F7E", "#5E7D32", "#55687A", "#8A6446");

    /** El color de la paleta en su forma canonica, sin importar mayusculas; vacio si no esta en ella. */
    public static Optional<String> deLaPaleta(String color) {
        if (color == null) {
            return Optional.empty();
        }
        String c = color.strip().toUpperCase(Locale.ROOT);
        return PALETA.contains(c) ? Optional.of(c) : Optional.empty();
    }

    public enum Tipo {
        DIEZMO,
        FIJO,
        TARJETA,
        VARIABLE,
        CREDITO,
        OTRO
    }

    /**
     * Las cinco del sistema, como en el dominio compartido (seed.ts), en su orden. Tarjetas tiene las lineas de las
     * tarjetas; Creditos, las compras a cuotas y los prestamos (tarjetas-y-creditos, V13).
     */
    public static List<Categoria> delSistema(UUID hogarId) {
        return List.of(
                new Categoria(UUID.randomUUID(), hogarId, "Diezmo", "#2C7A70", 0, Tipo.DIEZMO, true),
                new Categoria(UUID.randomUUID(), hogarId, "Gastos fijos", "#C2603A", 1, Tipo.FIJO, true),
                new Categoria(UUID.randomUUID(), hogarId, "Variables", "#8A8D85", 2, Tipo.VARIABLE, true),
                new Categoria(UUID.randomUUID(), hogarId, "Tarjetas", "#6B5BA8", 3, Tipo.TARJETA, true),
                new Categoria(UUID.randomUUID(), hogarId, "Créditos", "#6B5BA8", 4, Tipo.CREDITO, true));
    }
}
