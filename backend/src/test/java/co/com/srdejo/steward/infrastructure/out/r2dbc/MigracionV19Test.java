package co.com.srdejo.steward.infrastructure.out.r2dbc;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * V19 agrega la primera cuota de un credito, vacia en los que ya existen (design D1 de credito-primera-cuota). Corre en un
 * schema propio para no tocar el de steward_test.
 */
class MigracionV19Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v19";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";

    @Test
    void losCreditosQueYaExistenQuedanSinPrimeraCuota() throws Exception {
        Flyway v18 = flyway("18");
        v18.clean();
        v18.migrate();
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO credito (id, hogar_id, nombre, entidad, saldo, saldo_actualizado_en, cuota, tasa_em, dia_pago, "
                + "total_original) VALUES ('00000000-0000-0000-0000-0000000000c1', " + HOGAR + ", 'Johana', 'Johana', "
                + "192000000, '2026-11-03', 2000000, 0, 1, 192000000)");

        flyway("19").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            ResultSet r = s.executeQuery("SELECT primera_cuota FROM credito");
            assertTrue(r.next());
            assertNull(r.getDate(1));
            s.execute("UPDATE credito SET primera_cuota = '2026-12-01'");
        } finally {
            flyway("19").clean();
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
