package co.com.srdejo.steward.domain.model;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/** Persona con cuenta. El correo es unico sin distinguir mayusculas y no cambia (spec steward-auth). */
public record Usuario(UUID id, String email, String nombre, Instant creadoEn) {

    public static final int NOMBRE_MAX = 60;

    /** Letra del avatar: la primera del nombre, en mayuscula. */
    public String inicial() {
        String limpio = nombre == null ? "" : nombre.strip();
        return limpio.isEmpty() ? "?" : limpio.substring(0, limpio.offsetByCodePoints(0, 1)).toUpperCase(Locale.ROOT);
    }

    public Usuario conNombre(String nuevo) {
        return new Usuario(id, email, nuevo, creadoEn);
    }
}
