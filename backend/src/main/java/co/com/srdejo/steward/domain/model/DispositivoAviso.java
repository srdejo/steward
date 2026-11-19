package co.com.srdejo.steward.domain.model;

import java.util.UUID;

/** Un iPhone (token de Expo) o un navegador (suscripcion Web Push) que recibe los avisos de una persona. */
public record DispositivoAviso(UUID id, UUID usuarioId, Tipo tipo, String token, String p256dh, String auth) {

    public enum Tipo {
        EXPO,
        WEB
    }
}
