package co.com.srdejo.steward.domain.model;

import java.util.UUID;

/** Hogar compartido. Nace sin terminar el onboarding (spec steward-hogar). */
public record Hogar(UUID id, String nombre, boolean configurado) {

    public static final int NOMBRE_MAX = 60;
}
