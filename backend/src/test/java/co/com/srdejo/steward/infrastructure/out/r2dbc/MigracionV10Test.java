package co.com.srdejo.steward.infrastructure.out.r2dbc;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** V10 (design D4 de app-movil-conectada): los usuarios siguen igual, sin Apple, y un identificador de Apple es unico. */
class MigracionV10Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v10";

    @Test
    void losUsuariosSiguenIgualYElIdentificadorEsUnico() throws Exception {
        Flyway v9 = flyway("9");
        v9.clean();
        v9.migrate();
        try (Connection c = conexion(); Statement s = c.createStatement()) {
            s.execute("INSERT INTO usuario (id, email, nombre) VALUES ('00000000-0000-0000-0000-000000000001', 'daniel@ejemplo.com', 'Daniel'), "
                    + "('00000000-0000-0000-0000-000000000002', 'esposa@ejemplo.com', 'Esposa')");
        }
        flyway("10").migrate();
        try (Connection c = conexion(); Statement s = c.createStatement()) {
            ResultSet r = s.executeQuery("SELECT count(*) FROM usuario WHERE apple_sub IS NULL AND eliminado_en IS NULL");
            r.next();
            assertEquals(2, r.getInt(1));
            s.execute("UPDATE usuario SET apple_sub = 'sub-1' WHERE nombre = 'Daniel'");
            assertThrows(SQLException.class, () -> s.execute("UPDATE usuario SET apple_sub = 'sub-1' WHERE nombre = 'Esposa'"));
        } finally {
            flyway("10").clean();
        }
    }

    private static Flyway flyway(String version) {
        return Flyway.configure().dataSource(URL, "postgres", "postgres").schemas(SCHEMA).cleanDisabled(false).target(version).load();
    }

    private static Connection conexion() throws Exception {
        Connection c = DriverManager.getConnection(URL, "postgres", "postgres");
        c.setSchema(SCHEMA);
        return c;
    }
}
