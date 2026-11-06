package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.PlanContratoTest.gasto;

/** app-movil-conectada: spec steward-auth, "Varios clients de Google", "Acceso con Apple" y "Eliminar la cuenta". */
class CuentaUsuarioContratoTest extends ContratoBase {

    private WebTestClient.ResponseSpec loginGoogle(String token) {
        return client.post().uri("/api/auth/google").contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("idToken", token)).exchange();
    }

    private WebTestClient.ResponseSpec loginApple(String token, String nombre) {
        Map<String, Object> cuerpo = new HashMap<>();
        cuerpo.put("identityToken", token);
        cuerpo.put("nombre", nombre);
        return client.post().uri("/api/auth/apple").contentType(MediaType.APPLICATION_JSON).bodyValue(cuerpo).exchange();
    }

    private static String tokenDe(WebTestClient.ResponseSpec r) {
        return valorDe(r.expectStatus().isOk(), "token");
    }

    // --- Varios clients de Google ---

    @Test
    void aceptaElClientIos() {
        loginGoogle(GoogleDePrueba.token("daniel@ejemplo.com", "Daniel", GoogleDePrueba.CLIENT_ID_IOS, "https://accounts.google.com", true, Instant.now()))
                .expectStatus().isOk().expectBody().jsonPath("$.usuario.email").isEqualTo("daniel@ejemplo.com");
        loginGoogle(GoogleDePrueba.token("daniel@ejemplo.com", "Daniel", "otra-app", "https://accounts.google.com", true, Instant.now()))
                .expectStatus().isUnauthorized().expectBody().jsonPath("$.codigo").isEqualTo("GOOGLE_TOKEN_INVALIDO");
    }

    // --- Acceso con Apple ---

    @Test
    void primeraVezConCorreoOcultoYSegundaSinNombre() {
        String correo = "abc123@privaterelay.appleid.com";
        loginApple(GoogleDePrueba.tokenApple("sub-1", correo), "Ana").expectStatus().isOk().expectBody()
                .jsonPath("$.usuario.email").isEqualTo(correo)
                .jsonPath("$.usuario.nombre").isEqualTo("Ana")
                .jsonPath("$.token").isNotEmpty();
        loginApple(GoogleDePrueba.tokenApple("sub-1", null), null).expectStatus().isOk().expectBody()
                .jsonPath("$.usuario.email").isEqualTo(correo)
                .jsonPath("$.usuario.nombre").isEqualTo("Ana");
    }

    @Test
    void conElMismoCorreoEntraALaMismaCuenta() {
        String google = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(google, "Nuestra casa").expectStatus().isCreated();
        loginApple(GoogleDePrueba.tokenApple("sub-2", "daniel@ejemplo.com"), null).expectStatus().isOk().expectBody()
                .jsonPath("$.usuario.nombre").isEqualTo("Daniel")
                .jsonPath("$.tieneHogar").isEqualTo(true);
        // Ya enlazada: entra aunque el token no traiga correo.
        loginApple(GoogleDePrueba.tokenApple("sub-2", null), null).expectStatus().isOk().expectBody()
                .jsonPath("$.usuario.email").isEqualTo("daniel@ejemplo.com");
    }

    @Test
    void tokenInvalido() {
        loginApple(GoogleDePrueba.tokenApple("sub-3", "x@ejemplo.com", "otra.app", "https://appleid.apple.com"), null)
                .expectStatus().isUnauthorized().expectBody().jsonPath("$.codigo").isEqualTo("APPLE_TOKEN_INVALIDO");
        loginApple(GoogleDePrueba.tokenApple("sub-3", "x@ejemplo.com", GoogleDePrueba.APPLE_CLIENT_ID, "https://accounts.google.com"), null)
                .expectStatus().isUnauthorized();
        loginApple("no-es-un-token", null).expectStatus().isUnauthorized();
    }

    // --- Eliminar la cuenta ---

    @Test
    void ultimoMiembroBorraTodo() {
        String ana = entrar("ana@ejemplo.com", "Ana");
        crearHogar(ana, "Casa de Ana").expectStatus().isCreated();
        post(ana, "/api/cuentas", cuenta("Banco", "YO", 1_000)).expectStatus().isCreated();
        post(ana, "/api/cuenta/eliminar", Map.of()).expectStatus().isNoContent();
        get(ana, "/api/sesion").expectStatus().isUnauthorized();
        get(ana, "/api/finanzas").expectStatus().isUnauthorized();
        // El correo queda libre: volver a entrar crea una cuenta nueva y vacia.
        String otra = entrar("ana@ejemplo.com", "Ana de nuevo");
        get(otra, "/api/sesion").expectStatus().isOk().expectBody()
                .jsonPath("$.tieneHogar").isEqualTo(false)
                .jsonPath("$.usuario.nombre").isEqualTo("Ana de nuevo");
    }

    @Test
    void hogarCompartidoConservaLosRegistros() {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        String esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        String idEsposa = valorUsuario(esposa);
        post(esposa, "/api/gastos", gasto(null, 85_000, "Farmacia", idEsposa)).expectStatus().isCreated();

        post(esposa, "/api/cuenta/eliminar", Map.of()).expectStatus().isNoContent();
        get(esposa, "/api/hogar").expectStatus().isUnauthorized();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos.length()").isEqualTo(1)
                .jsonPath("$.movimientos[0].monto").isEqualTo(85_000)
                .jsonPath("$.movimientos[0].usuarioId").isEqualTo(idEsposa);
        get(daniel, "/api/hogar").expectBody().jsonPath("$.miembros.length()").isEqualTo(1);
        // Su correo ya no existe: volver a entrar es otra persona, sin hogar y sin esos registros.
        String nueva = entrar("esposa@ejemplo.com", "Esposa");
        get(nueva, "/api/sesion").expectBody().jsonPath("$.tieneHogar").isEqualTo(false);
        org.junit.jupiter.api.Assertions.assertNotEquals(idEsposa, valorUsuario(nueva));
    }

    @Test
    void sinSesionNoSeElimina() {
        client.post().uri("/api/cuenta/eliminar").contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void conCodigoDeAppleSeEliminaAunqueNoHayaLlave() {
        String t = tokenDe(loginApple(GoogleDePrueba.tokenApple("sub-4", "z@privaterelay.appleid.com"), "Z"));
        post(t, "/api/cuenta/eliminar", Map.of("appleAuthorizationCode", "code")).expectStatus().isNoContent();
        get(t, "/api/sesion").expectStatus().isUnauthorized();
        // El identificador de Apple ya no apunta a nadie: entra una cuenta nueva.
        loginApple(GoogleDePrueba.tokenApple("sub-4", "z@privaterelay.appleid.com"), "Z").expectStatus().isOk();
    }

    private String valorUsuario(String sesion) {
        Map<?, ?> s = get(sesion, "/api/sesion").expectBody(Map.class).returnResult().getResponseBody();
        return (String) ((Map<?, ?>) s.get("usuario")).get("id");
    }
}
