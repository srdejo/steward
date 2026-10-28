package co.com.srdejo.steward.domain.model;

/**
 * Sesion actual: el usuario y en que punto esta su hogar. {@code token} solo viene al iniciar sesion.
 */
public record Sesion(String token, Usuario usuario, boolean tieneHogar, boolean hogarConfigurado) {

    public Sesion sinToken() {
        return new Sesion(null, usuario, tieneHogar, hogarConfigurado);
    }
}
