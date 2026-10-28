package co.com.srdejo.steward.domain.model;

/** Lo que el backend toma de un ID token de Google ya verificado: correo verificado y nombre visible. */
public record IdentidadGoogle(String email, String nombre) {
}
