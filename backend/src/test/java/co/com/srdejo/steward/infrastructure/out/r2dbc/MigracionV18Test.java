package co.com.srdejo.steward.infrastructure.out.r2dbc;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * V18 crea las tablas de avisos sin tocar lo existente (avisos-pagos): un aviso no se guarda dos veces para la misma
 * persona, clave, momento y fecha, y todo lo de una persona se va con ella. Corre en un schema propio.
 */
class MigracionV18Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v18";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";

    @Test
    void avisoSinRepetirYTodoSeVaConLaPersona() throws Exception {
        Flyway v17 = flyway("17");
        v17.clean();
        v17.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel')");

        flyway("18").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            s.execute("INSERT INTO dispositivo_aviso (id, usuario_id, tipo, token) VALUES (gen_random_uuid(), " + DANIEL + ", 'EXPO', 'ExponentPushToken[a]')");
            // Una suscripcion web necesita sus llaves.
            assertThrows(SQLException.class, () -> s.execute("INSERT INTO dispositivo_aviso (id, usuario_id, tipo, token) VALUES (gen_random_uuid(), " + DANIEL + ", 'WEB', 'https://push/1')"));
            s.execute("INSERT INTO preferencia_aviso (usuario_id) VALUES (" + DANIEL + ")");
            s.execute("INSERT INTO aviso_enviado (id, usuario_id, clave, momento, fecha) VALUES (gen_random_uuid(), " + DANIEL + ", 'TARJETA:x:2026-10', 'ANTES', '2026-10-29')");
            assertThrows(SQLException.class, () -> s.execute("INSERT INTO aviso_enviado (id, usuario_id, clave, momento, fecha) VALUES (gen_random_uuid(), " + DANIEL + ", 'TARJETA:x:2026-10', 'ANTES', '2026-10-29')"));
            s.execute("DELETE FROM usuario WHERE id = " + DANIEL);
            var r = s.executeQuery("SELECT (SELECT count(*) FROM dispositivo_aviso) + (SELECT count(*) FROM preferencia_aviso) + (SELECT count(*) FROM aviso_enviado)");
            r.next();
            assertEquals(0, r.getInt(1));
        } finally {
            flyway("18").clean();
        }
    }

    private static Flyway flyway(String version) {
        return Flyway.configure().dataSource(URL, "postgres", "postgres").schemas(SCHEMA).cleanDisabled(false)
                .target(version).load();
    }

    private static void sql(String sentencia) throws Exception {
        try (Connection c = conexion(); Statement s = c.createStatement()) {
            s.execute(sentencia);
        }
    }

    private static Connection conexion() throws Exception {
        Connection c = DriverManager.getConnection(URL, "postgres", "postgres");
        c.setSchema(SCHEMA);
        return c;
    }
}
