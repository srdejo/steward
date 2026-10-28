package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Escenarios de la spec steward-auth, por HTTP. */
class AuthContratoTest extends ContratoBase {

    @Test
    void configPublicaTraeElClientId() {
        client.get().uri("/api/auth/config").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.googleClientId").isEqualTo(GoogleDePrueba.CLIENT_ID);
    }

    @Test
    void primeraVezCreaElUsuarioSinHogar() {
        login("daniel@ejemplo.com", "Daniel Jiménez")
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.token").isNotEmpty()
                .jsonPath("$.usuario.email").isEqualTo("daniel@ejemplo.com")
                .jsonPath("$.usuario.nombre").isEqualTo("Daniel Jiménez")
                .jsonPath("$.usuario.inicial").isEqualTo("D")
                .jsonPath("$.tieneHogar").isEqualTo(false)
                .jsonPath("$.hogarConfigurado").isEqualTo(false);
    }

    @Test
    void tokenDeOtraAppDa401YNoCreaNada() {
        String deOtraApp = GoogleDePrueba.token("intruso@ejemplo.com", "X", "otro-client-id",
                "https://accounts.google.com", true, Instant.now());
        client.post().uri("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("idToken", deOtraApp)).exchange()
                .expectStatus().isUnauthorized()
                .expectBody().jsonPath("$.codigo").isEqualTo("GOOGLE_TOKEN_INVALIDO");
        // Entrar despues con un token valido confirma que el correo no quedo creado: es "primera vez" otra vez.
        login("intruso@ejemplo.com", "Ahora si").expectStatus().isOk()
                .expectBody().jsonPath("$.usuario.nombre").isEqualTo("Ahora si");
    }

    @Test
    void mayusculasDevuelvenElMismoUsuario() {
        String id = idDe(login("daniel@ejemplo.com", "Daniel"));
        String otraVez = idDe(login("Daniel@Ejemplo.com", "Daniel"));
        if (!id.equals(otraVez)) {
            throw new AssertionError("Se duplico el usuario: " + id + " vs " + otraVez);
        }
    }

    @Test
    void sesionActualConToken() {
        String token = tokenDe(login("d@ejemplo.com", "Daniel"));
        client.get().uri("/api/sesion").header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.token").doesNotExist()
                .jsonPath("$.usuario.email").isEqualTo("d@ejemplo.com")
                .jsonPath("$.tieneHogar").isEqualTo(false);
    }

    @Test
    void hogarSinTerminar() throws Exception {
        WebTestClient.ResponseSpec r = login("d@ejemplo.com", "Daniel");
        String token = tokenDe(r);
        // Hasta la tarea 4.1 no hay API para crear el hogar: se arma directo en la base.
        crearHogarSinTerminar(UUID.fromString(idDeToken(token)));
        client.get().uri("/api/sesion").header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.tieneHogar").isEqualTo(true)
                .jsonPath("$.hogarConfigurado").isEqualTo(false);
    }

    @Test
    void tokenVencidoDa401EnLaSesion() {
        String token = TokensDePrueba.sesion(UUID.randomUUID(), Instant.now().minus(Duration.ofDays(8)));
        client.get().uri("/api/sesion").header("Authorization", "Bearer " + token).exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void cambioDeNombre() {
        String token = tokenDe(login("d@ejemplo.com", "Daniel"));
        client.patch().uri("/api/perfil").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("nombre", "dani")).exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.nombre").isEqualTo("dani")
                .jsonPath("$.inicial").isEqualTo("D")
                .jsonPath("$.email").isEqualTo("d@ejemplo.com");
    }

    @Test
    void nombreVacioOLargoDa400() {
        String token = tokenDe(login("d@ejemplo.com", "Daniel"));
        for (String malo : new String[]{"", "x".repeat(61)}) {
            client.patch().uri("/api/perfil").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("nombre", malo)).exchange()
                    .expectStatus().isBadRequest()
                    .expectBody().jsonPath("$.campos.nombre").isNotEmpty();
        }
    }

    private WebTestClient.ResponseSpec login(String email, String nombre) {
        return client.post().uri("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("idToken", GoogleDePrueba.token(email, nombre))).exchange();
    }

    private static String tokenDe(WebTestClient.ResponseSpec r) {
        return campo(r, "token");
    }

    private static String idDe(WebTestClient.ResponseSpec r) {
        Map<?, ?> usuario = (Map<?, ?>) r.expectStatus().isOk().expectBody(Map.class).returnResult().getResponseBody().get("usuario");
        return (String) usuario.get("id");
    }

    private static String campo(WebTestClient.ResponseSpec r, String nombre) {
        return (String) r.expectStatus().isOk().expectBody(Map.class).returnResult().getResponseBody().get(nombre);
    }

    private static String idDeToken(String jwt) {
        String payload = new String(java.util.Base64.getUrlDecoder().decode(jwt.split("\\.")[1]));
        return payload.replaceAll(".*\"sub\":\"([^\"]+)\".*", "$1");
    }

    private static void crearHogarSinTerminar(UUID usuarioId) throws Exception {
        try (Connection c = DriverManager.getConnection(DB_URL, "postgres", "postgres")) {
            UUID hogar = UUID.randomUUID();
            try (PreparedStatement h = c.prepareStatement("INSERT INTO hogar (id, nombre) VALUES (?, 'Nuestra casa')")) {
                h.setObject(1, hogar);
                h.executeUpdate();
            }
            try (PreparedStatement m = c.prepareStatement("INSERT INTO miembro (hogar_id, usuario_id, unido_en) VALUES (?, ?, current_date)")) {
                m.setObject(1, hogar);
                m.setObject(2, usuarioId);
                m.executeUpdate();
            }
        }
    }
}
