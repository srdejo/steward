package co.com.srdejo.steward.domain.model;

/** Lo que el backend toma de un token de Apple ya verificado. {@code email} es null si no viene o no esta verificado. */
public record IdentidadApple(String sub, String email) {
}
