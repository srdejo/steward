package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

/** Spec steward-auth, "Acceso de desarrollo" (encendido en el perfil contract, como en local). */
class DevLoginContratoTest extends ContratoBase {

    @Test
    void configIndicaQueEstaEncendido() {
        client.get().uri("/api/auth/config").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.devLogin").isEqualTo(true);
    }

    @Test
    void dosPersonasEnLocal() {
        String daniel = entrarDev("daniel@ejemplo.com", "Daniel");
        String esposa = entrarDev("esposa@ejemplo.com", "Esposa");
        sesion(daniel).jsonPath("$.usuario.email").isEqualTo("daniel@ejemplo.com").jsonPath("$.tieneHogar").isEqualTo(false);
        sesion(esposa).jsonPath("$.usuario.email").isEqualTo("esposa@ejemplo.com").jsonPath("$.usuario.inicial").isEqualTo("E");
        // Entrar de nuevo con el mismo correo es el mismo usuario, como con Google.
        String otraVez = entrarDev("Daniel@Ejemplo.com", "Daniel");
        String id1 = (String) ((Map<?, ?>) sesionMap(daniel).get("usuario")).get("id");
        String id2 = (String) ((Map<?, ?>) sesionMap(otraVez).get("usuario")).get("id");
        if (!id1.equals(id2)) {
            throw new AssertionError("El mismo correo creo dos usuarios");
        }
    }

    @Test
    void correoInvalidoDa400() {
        client.post().uri("/api/auth/dev").contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("email", "no-es-correo", "nombre", "X")).exchange()
                .expectStatus().isBadRequest()
                .expectBody().jsonPath("$.campos.email").isNotEmpty();
    }

    private String entrarDev(String email, String nombre) {
        Map<?, ?> r = client.post().uri("/api/auth/dev").contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("email", email, "nombre", nombre)).exchange()
                .expectStatus().isOk().expectBody(Map.class).returnResult().getResponseBody();
        return (String) r.get("token");
    }

    private org.springframework.test.web.reactive.server.WebTestClient.BodyContentSpec sesion(String token) {
        return client.get().uri("/api/sesion").header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isOk().expectBody();
    }

    private Map<?, ?> sesionMap(String token) {
        return client.get().uri("/api/sesion").header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isOk().expectBody(Map.class).returnResult().getResponseBody();
    }
}
