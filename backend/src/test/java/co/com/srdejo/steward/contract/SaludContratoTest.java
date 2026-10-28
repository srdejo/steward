package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;

/** Spec steward-backend-plataforma: "Salud" y "Ruta protegida sin sesion". */
class SaludContratoTest extends ContratoBase {

    @Test
    void saludRespondeSoloUp() {
        client.get().uri("/actuator/health").exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"status\":\"UP\"}", org.springframework.test.json.JsonCompareMode.STRICT);
    }

    @Test
    void rutaProtegidaSinSesionDa401Estandar() {
        client.get().uri("/api/hogar").exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.codigo").isEqualTo("NO_AUTENTICADO")
                .jsonPath("$.mensaje").isNotEmpty();
    }
}
