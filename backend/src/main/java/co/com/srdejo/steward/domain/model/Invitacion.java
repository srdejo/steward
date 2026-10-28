package co.com.srdejo.steward.domain.model;

import java.time.Instant;
import java.util.UUID;

/**
 * Invitacion a un hogar. El token en claro nunca se guarda: solo su hash (design D7). Vence a los 7 dias del ultimo
 * envio y sirve una sola vez.
 */
public record Invitacion(UUID id, UUID hogarId, String email, Estado estado, UUID creadaPor, Instant enviadaEn,
                         Instant expiraEn) {

    public enum Estado {
        PENDIENTE,
        ACEPTADA
    }

    public boolean vigenteEn(Instant ahora) {
        return estado == Estado.PENDIENTE && ahora.isBefore(expiraEn);
    }
}
