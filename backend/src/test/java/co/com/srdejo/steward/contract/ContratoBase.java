package co.com.srdejo.steward.contract;

import co.com.srdejo.steward.StewardApplication;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Duration;

/**
 * Base de los tests de contrato, caja negra por HTTP (design D8). Sin {@code -Dcontract.baseUrl} levanta la app una vez
 * por JVM con el perfil {@code contract}; con {@code -Dcontract.baseUrl=http://localhost:18099} prueba un proceso
 * externo, como el binario nativo levantado con {@code native-build.ps1 -Run -Profile contract -DbName steward_test}.
 * En los dos casos la base {@code steward_test} se limpia antes de cada test.
 */
public abstract class ContratoBase {

    static final String DB_URL = "jdbc:postgresql://localhost:5433/steward_test";

    private static String baseUrl;
    @SuppressWarnings("unused")
    private static ConfigurableApplicationContext app;

    protected WebTestClient client;

    @BeforeEach
    void prepararContrato() throws Exception {
        client = WebTestClient.bindToServer()
                .baseUrl(baseUrl())
                .responseTimeout(Duration.ofSeconds(15))
                .build();
        limpiarBase();
    }

    protected static synchronized String baseUrl() {
        if (baseUrl == null) {
            String externa = System.getProperty("contract.baseUrl", "");
            if (!externa.isBlank()) {
                baseUrl = externa;
            } else {
                app = new SpringApplicationBuilder(StewardApplication.class)
                        // En modo AOT, Spring busca el inicializador generado de la clase main: no la deduce del stack.
                        .main(StewardApplication.class)
                        .profiles("contract")
                        .run("--server.port=0");
                baseUrl = "http://localhost:" + app.getEnvironment().getProperty("local.server.port");
            }
        }
        return baseUrl;
    }

    /** Entra con Google (de prueba) y devuelve el token de sesion. */
    protected String entrar(String email, String nombre) {
        java.util.Map<?, ?> sesion = client.post().uri("/api/auth/google")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyValue(java.util.Map.of("idToken", GoogleDePrueba.token(email, nombre)))
                .exchange()
                .expectStatus().isOk()
                .expectBody(java.util.Map.class).returnResult().getResponseBody();
        return (String) sesion.get("token");
    }

    protected WebTestClient.ResponseSpec crearHogar(String token, String nombre) {
        return client.post().uri("/api/hogar").header("Authorization", "Bearer " + token)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyValue(java.util.Map.of("nombre", nombre)).exchange();
    }

    protected WebTestClient.ResponseSpec invitarA(String token, String email) {
        return client.post().uri("/api/hogar/invitaciones").header("Authorization", "Bearer " + token)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyValue(java.util.Map.of("email", email)).exchange();
    }

    /** Invita y devuelve el enlace de la respuesta. */
    protected String invitar(String token, String email) {
        java.util.Map<?, ?> r = invitarA(token, email).expectStatus().is2xxSuccessful()
                .expectBody(java.util.Map.class).returnResult().getResponseBody();
        return (String) r.get("enlace");
    }

    protected static String tokenDe(String enlace) {
        return enlace.substring(enlace.lastIndexOf('/') + 1);
    }

    protected WebTestClient.ResponseSpec aceptar(String sesion, String tokenInvitacion, String nombre) {
        return client.post().uri("/api/invitaciones/{t}/aceptar", tokenInvitacion)
                .header("Authorization", "Bearer " + sesion)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .bodyValue(java.util.Map.of("nombre", nombre, "diezmoAportes", false)).exchange();
    }

    /** Invita a {@code email}, entra con esa cuenta y acepta; devuelve la sesion del invitado. */
    protected String unirA(String anfitrion, String email, String nombre) {
        String token = tokenDe(invitar(anfitrion, email));
        String invitado = entrar(email, nombre);
        aceptar(invitado, token, nombre).expectStatus().isOk();
        return invitado;
    }

    /** Ejecuta SQL directo en steward_test, para preparar casos que la API no permite (fechas pasadas). */
    protected static void sql(String sentencia) throws Exception {
        try (Connection c = DriverManager.getConnection(DB_URL, "postgres", "postgres");
             Statement s = c.createStatement()) {
            s.execute(sentencia);
        }
    }

    private static void limpiarBase() throws Exception {
        try (Connection c = DriverManager.getConnection(DB_URL, "postgres", "postgres");
             Statement s = c.createStatement()) {
            // Puede correr antes de que la app aplique Flyway (modo externo con la base vacia).
            s.execute("DO $$ BEGIN IF to_regclass('public.usuario') IS NOT NULL THEN "
                    + "TRUNCATE invitacion, miembro, hogar, usuario CASCADE; END IF; END $$");
        }
    }
}
