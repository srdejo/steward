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
                        .profiles("contract")
                        .run("--server.port=0");
                baseUrl = "http://localhost:" + app.getEnvironment().getProperty("local.server.port");
            }
        }
        return baseUrl;
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
