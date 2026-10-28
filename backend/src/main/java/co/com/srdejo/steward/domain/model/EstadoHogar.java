package co.com.srdejo.steward.domain.model;

/** En que punto esta el hogar de un usuario: si tiene uno y si ya termino el onboarding. */
public record EstadoHogar(boolean tieneHogar, boolean configurado) {

    public static final EstadoHogar SIN_HOGAR = new EstadoHogar(false, false);
}
