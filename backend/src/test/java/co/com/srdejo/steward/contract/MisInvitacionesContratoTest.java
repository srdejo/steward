package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.util.List;
import java.util.Map;

/** Spec steward-hogar, "Invitaciones para mi correo": quien entra sin el enlace tambien puede unirse. */
class MisInvitacionesContratoTest extends ContratoBase {

    private String daniel;

    @BeforeEach
    void hogarDeDaniel() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Jimenez Navarro").expectStatus().isCreated();
    }

    @Test
    void entraSinElEnlace() {
        invitar(daniel, "sulbey@ejemplo.com");
        // Entra con el correo invitado, en otras mayusculas, sin abrir el enlace.
        String sulbey = entrar("Sulbey@Ejemplo.com", "Sulbey");
        mias(sulbey)
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].hogar").isEqualTo("Jimenez Navarro")
                .jsonPath("$[0].invitadoPor.nombre").isEqualTo("Daniel")
                .jsonPath("$[0].miembros.length()").isEqualTo(1);
        String id = idDeMia(sulbey);

        aceptarMia(sulbey, id).expectStatus().isOk()
                .expectBody()
                .jsonPath("$.tieneHogar").isEqualTo(true)
                .jsonPath("$.usuario.nombre").isEqualTo("Sulbey");
        client.get().uri("/api/hogar").header("Authorization", "Bearer " + daniel).exchange()
                .expectBody()
                .jsonPath("$.miembros.length()").isEqualTo(2)
                .jsonPath("$.invitaciones.length()").isEqualTo(0);
        // Ya aceptada: no aparece ni se puede aceptar otra vez.
        mias(sulbey).expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void invitacionDeOtroCorreo() {
        invitar(daniel, "sulbey@ejemplo.com");
        String id = idDeMia(entrar("sulbey@ejemplo.com", "Sulbey"));
        String intruso = entrar("intruso@ejemplo.com", "Intruso");
        mias(intruso).expectBody().jsonPath("$.length()").isEqualTo(0);
        aceptarMia(intruso, id).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("INVITACION_NO_VALIDA");
        // Sigue pendiente para Sulbey.
        client.get().uri("/api/hogar").header("Authorization", "Bearer " + daniel).exchange()
                .expectBody().jsonPath("$.invitaciones.length()").isEqualTo(1);
    }

    @Test
    void vencidaNoAparece() throws Exception {
        invitar(daniel, "sulbey@ejemplo.com");
        sql("UPDATE invitacion SET expira_en = now() - interval '1 day'");
        mias(entrar("sulbey@ejemplo.com", "Sulbey")).expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void yaTieneHogarNoConsume() {
        invitar(daniel, "sulbey@ejemplo.com");
        String sulbey = entrar("sulbey@ejemplo.com", "Sulbey");
        String id = idDeMia(sulbey);
        crearHogar(sulbey, "Jimenez").expectStatus().isCreated();
        aceptarMia(sulbey, id).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_TIENE_HOGAR");
        mias(sulbey).expectBody().jsonPath("$.length()").isEqualTo(1);
    }

    @Test
    void sinSesionDa401() {
        client.get().uri("/api/mis-invitaciones").exchange().expectStatus().isUnauthorized();
    }

    private WebTestClient.ResponseSpec mias(String token) {
        return client.get().uri("/api/mis-invitaciones").header("Authorization", "Bearer " + token).exchange();
    }

    private String idDeMia(String token) {
        List<?> lista = mias(token).expectStatus().isOk().expectBody(List.class).returnResult().getResponseBody();
        return (String) ((Map<?, ?>) lista.getFirst()).get("id");
    }

    private WebTestClient.ResponseSpec aceptarMia(String token, String id) {
        return client.post().uri("/api/mis-invitaciones/{id}/aceptar", id).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("nombre", "Sulbey", "diezmoAportes", false))
                .exchange();
    }
}
