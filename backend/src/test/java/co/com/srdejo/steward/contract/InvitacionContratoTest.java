package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/** Spec steward-hogar: invitar, reenviar, copiar enlace, consultar y aceptar. */
class InvitacionContratoTest extends ContratoBase {

    private String daniel;

    @BeforeEach
    void hogarDeDaniel() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
    }

    @Test
    void invitacionPendiente() {
        invitarA(daniel, "esposa@ejemplo.com").expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.correoEnviado").isEqualTo(true)
                .jsonPath("$.enlace").value(e -> {
                    if (!String.valueOf(e).startsWith("http://steward.test/invitacion/")) {
                        throw new AssertionError("Enlace inesperado: " + e);
                    }
                })
                .jsonPath("$.invitacion.estado").isEqualTo("PENDIENTE")
                .jsonPath("$.invitacion.expiraEn").value(v -> cercaDe(Instant.parse(String.valueOf(v)), Duration.ofDays(7)));
        client.get().uri("/api/hogar").header("Authorization", "Bearer " + daniel).exchange()
                .expectBody()
                .jsonPath("$.invitaciones.length()").isEqualTo(1)
                .jsonPath("$.invitaciones[0].email").isEqualTo("esposa@ejemplo.com");
    }

    @Test
    void correoCaidoDejaLaInvitacionYElEnlace() {
        // El perfil contract simula contact caido para @correo-caido.test (LoggingMailAdapter).
        invitarA(daniel, "esposa@correo-caido.test").expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.correoEnviado").isEqualTo(false)
                .jsonPath("$.enlace").isNotEmpty()
                .jsonPath("$.invitacion.estado").isEqualTo("PENDIENTE");
        client.get().uri("/api/hogar").header("Authorization", "Bearer " + daniel).exchange()
                .expectBody().jsonPath("$.invitaciones.length()").isEqualTo(1);
    }

    @Test
    void invitarDeNuevoReenviaLaMismaSinDuplicar() {
        invitarA(daniel, "esposa@ejemplo.com").expectStatus().isCreated();
        invitarA(daniel, "ESPOSA@ejemplo.com").expectStatus().isOk();
        client.get().uri("/api/hogar").header("Authorization", "Bearer " + daniel).exchange()
                .expectBody().jsonPath("$.invitaciones.length()").isEqualTo(1);
    }

    @Test
    void yaEsMiembroDa409() {
        unirA(daniel, "esposa@ejemplo.com", "Esposa");
        invitarA(daniel, "esposa@ejemplo.com").expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_ES_MIEMBRO");
    }

    @Test
    void correoInvalidoDa400() {
        invitarA(daniel, "no-es-correo").expectStatus().isBadRequest()
                .expectBody().jsonPath("$.campos.email").isNotEmpty();
    }

    @Test
    void reenviarExtiendeYCambiaElEnlace() throws Exception {
        String viejo = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        // Seis dias despues.
        sql("UPDATE invitacion SET enviada_en = now() - interval '6 days', expira_en = now() + interval '1 day'");
        String id = idDeLaInvitacion();
        Map<?, ?> r = client.post().uri("/api/hogar/invitaciones/{id}/reenviar", id).header("Authorization", "Bearer " + daniel)
                .exchange().expectStatus().isOk().expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> inv = (Map<?, ?>) r.get("invitacion");
        cercaDe(Instant.parse((String) inv.get("expiraEn")), Duration.ofDays(7));
        String nuevo = tokenDe((String) r.get("enlace"));
        consultar(viejo).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("INVITACION_NO_VALIDA");
        consultar(nuevo).expectStatus().isOk();
    }

    @Test
    void copiarEnlaceTambienRota() {
        String viejo = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        String enlace = (String) client.post().uri("/api/hogar/invitaciones/{id}/enlace", idDeLaInvitacion())
                .header("Authorization", "Bearer " + daniel).exchange()
                .expectStatus().isOk().expectBody(Map.class).returnResult().getResponseBody().get("enlace");
        consultar(viejo).expectStatus().isNotFound();
        consultar(tokenDe(enlace)).expectStatus().isOk();
    }

    @Test
    void consultarSinSesion() {
        unirA(daniel, "primo@ejemplo.com", "Primo");
        String token = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        consultar(token).expectStatus().isOk()
                .expectBody()
                .jsonPath("$.hogar").isEqualTo("Nuestra casa")
                .jsonPath("$.invitadoPor.nombre").isEqualTo("Daniel")
                .jsonPath("$.miembros.length()").isEqualTo(2)
                .jsonPath("$.email").isEqualTo("esposa@ejemplo.com");
    }

    @Test
    void enlaceVencido() throws Exception {
        String token = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        String id = idDeLaInvitacion();
        sql("UPDATE invitacion SET enviada_en = now() - interval '8 days', expira_en = now() - interval '1 day'");
        consultar(token).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("INVITACION_NO_VALIDA");
        // Vencida: ya no aparece en el hogar ni se puede reenviar.
        client.get().uri("/api/hogar").header("Authorization", "Bearer " + daniel).exchange()
                .expectBody().jsonPath("$.invitaciones.length()").isEqualTo(0);
        client.post().uri("/api/hogar/invitaciones/{id}/reenviar", id)
                .header("Authorization", "Bearer " + daniel).exchange().expectStatus().isNotFound();
    }

    @Test
    void tokenInventadoDa404Igual() {
        consultar("no-existe-este-token").expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("INVITACION_NO_VALIDA");
    }

    @Test
    void unirse() {
        String token = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        String esposa = entrar("esposa.google@ejemplo.com", "Cuenta de Google");
        aceptar(esposa, token, "Esposa").expectStatus().isOk()
                .expectBody()
                .jsonPath("$.tieneHogar").isEqualTo(true)
                .jsonPath("$.usuario.nombre").isEqualTo("Esposa");
        client.get().uri("/api/hogar").header("Authorization", "Bearer " + esposa).exchange()
                .expectBody()
                .jsonPath("$.nombre").isEqualTo("Nuestra casa")
                .jsonPath("$.miembros.length()").isEqualTo(2)
                .jsonPath("$.invitaciones.length()").isEqualTo(0);
        // Un solo uso.
        consultar(token).expectStatus().isNotFound();
        String otra = entrar("otra@ejemplo.com", "Otra");
        aceptar(otra, token, "Otra").expectStatus().isNotFound();
    }

    @Test
    void yaTieneHogarNoConsumeLaInvitacion() {
        String token = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        String otroAnfitrion = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otroAnfitrion, "Otra casa").expectStatus().isCreated();
        aceptar(otroAnfitrion, token, "Otro").expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_TIENE_HOGAR");
        consultar(token).expectStatus().isOk();
    }

    @Test
    void aceptarSinSesionDa401() {
        String token = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        client.post().uri("/api/invitaciones/{t}/aceptar", token).contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("nombre", "Esposa", "diezmoAportes", false)).exchange()
                .expectStatus().isUnauthorized();
    }

    // --- ayudas ---

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec consultar(String token) {
        return client.get().uri("/api/invitaciones/{t}", token).exchange();
    }

    private String idDeLaInvitacion() {
        Map<?, ?> hogar = client.get().uri("/api/hogar").header("Authorization", "Bearer " + daniel).exchange()
                .expectBody(Map.class).returnResult().getResponseBody();
        return (String) ((Map<?, ?>) ((java.util.List<?>) hogar.get("invitaciones")).getFirst()).get("id");
    }

    private static void cercaDe(Instant valor, Duration desdeAhora) {
        Instant esperado = Instant.now().plus(desdeAhora);
        if (Duration.between(valor, esperado).abs().compareTo(Duration.ofMinutes(5)) > 0) {
            throw new AssertionError("Esperaba ~" + esperado + " y llego " + valor);
        }
    }
}
