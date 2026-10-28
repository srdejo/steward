package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

/** Spec steward-hogar: crear, ver, nombrar, terminar onboarding y salir. */
class HogarContratoTest extends ContratoBase {

    @Test
    void crear() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.nombre").isEqualTo("Nuestra casa")
                .jsonPath("$.configurado").isEqualTo(false)
                .jsonPath("$.miembros.length()").isEqualTo(1)
                .jsonPath("$.miembros[0].esActual").isEqualTo(true)
                .jsonPath("$.miembros[0].usuario.nombre").isEqualTo("Daniel");
        sesion(daniel).jsonPath("$.tieneHogar").isEqualTo(true).jsonPath("$.hogarConfigurado").isEqualTo(false);
    }

    @Test
    void segundoHogarDa409() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        crearHogar(daniel, "Otra casa").expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_TIENE_HOGAR");
        obtener(daniel).expectBody().jsonPath("$.nombre").isEqualTo("Nuestra casa");
    }

    @Test
    void sinHogarDa404() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        obtener(daniel).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("SIN_HOGAR");
    }

    @Test
    void nombreVacioDa400() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "  ").expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS").jsonPath("$.campos.nombre").isNotEmpty();
    }

    @Test
    void dosMiembros() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        unirA(daniel, "esposa@ejemplo.com", "Esposa");
        obtener(daniel).expectStatus().isOk()
                .expectBody()
                .jsonPath("$.miembros.length()").isEqualTo(2)
                .jsonPath("$.miembros[?(@.usuario.nombre == 'Daniel')].esActual").isEqualTo(List.of(true))
                .jsonPath("$.miembros[?(@.usuario.nombre == 'Esposa')].esActual").isEqualTo(List.of(false))
                .jsonPath("$.miembros[?(@.usuario.nombre == 'Esposa')].unidoEn").isNotEmpty();
    }

    @Test
    void renombrar() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        client.patch().uri("/api/hogar").header("Authorization", "Bearer " + daniel)
                .contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("nombre", "Casa Jiménez")).exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.nombre").isEqualTo("Casa Jiménez");
    }

    @Test
    void terminarOnboardingLoVenTodos() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        String esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        client.post().uri("/api/hogar/onboarding-completo").header("Authorization", "Bearer " + daniel).exchange()
                .expectStatus().isNoContent();
        sesion(daniel).jsonPath("$.hogarConfigurado").isEqualTo(true);
        sesion(esposa).jsonPath("$.hogarConfigurado").isEqualTo(true);
    }

    @Test
    void saleUnoDeDos() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        String esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        salir(esposa);
        obtener(daniel).expectBody().jsonPath("$.miembros.length()").isEqualTo(1);
        sesion(esposa).jsonPath("$.tieneHogar").isEqualTo(false);
    }

    @Test
    void elUltimoEnSalirBorraElHogarYSusInvitaciones() throws Exception {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        invitar(daniel, "alguien@ejemplo.com");
        salir(daniel);
        sesion(daniel).jsonPath("$.tieneHogar").isEqualTo(false);
        // Puede crear otro hogar despues de salir.
        crearHogar(daniel, "Casa nueva").expectStatus().isCreated()
                .expectBody().jsonPath("$.invitaciones.length()").isEqualTo(0);
    }

    // --- ayudas ---

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec obtener(String token) {
        return client.get().uri("/api/hogar").header("Authorization", "Bearer " + token).exchange();
    }

    private org.springframework.test.web.reactive.server.WebTestClient.BodyContentSpec sesion(String token) {
        return client.get().uri("/api/sesion").header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isOk().expectBody();
    }

    private void salir(String token) {
        client.delete().uri("/api/hogar/miembros/yo").header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isNoContent();
    }
}
