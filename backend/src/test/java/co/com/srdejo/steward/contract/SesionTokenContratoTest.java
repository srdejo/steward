package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Spec steward-auth, "Sesion con token": vencido, alterado o de otra clave → 401 estandar. */
class SesionTokenContratoTest extends ContratoBase {

    private static final String RUTA = "/api/hogar";

    @Test
    void tokenVencidoDa401() {
        String token = TokensDePrueba.sesion(UUID.randomUUID(), Instant.now().minus(Duration.ofDays(8)));
        esperar401(token);
    }

    @Test
    void tokenAlteradoDa401() {
        String token = TokensDePrueba.sesion(UUID.randomUUID(), Instant.now());
        String[] partes = token.split("\\.");
        // Otro sub en el payload con la firma original.
        String payload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                ("{\"sub\":\"" + UUID.randomUUID() + "\",\"exp\":" + (Instant.now().getEpochSecond() + 3600) + "}").getBytes());
        esperar401(partes[0] + "." + payload + "." + partes[2]);
    }

    @Test
    void tokenDeOtraClaveDa401() {
        esperar401(TokensDePrueba.conOtroSecreto(UUID.randomUUID()));
    }

    @Test
    void tokenValidoPasaLaSeguridad() {
        String token = TokensDePrueba.sesion(UUID.randomUUID(), Instant.now());
        // Pasa la autenticacion: lo que responda la ruta ya no es un 401.
        client.get().uri(RUTA).header("Authorization", "Bearer " + token).exchange()
                .expectStatus().value(status -> {
                    if (status == 401) {
                        throw new AssertionError("Un token valido no deberia dar 401");
                    }
                });
    }

    private void esperar401(String token) {
        client.get().uri(RUTA).header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isUnauthorized()
                .expectBody().jsonPath("$.codigo").isEqualTo("NO_AUTENTICADO");
    }
}
