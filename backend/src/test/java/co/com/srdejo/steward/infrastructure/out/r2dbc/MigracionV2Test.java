package co.com.srdejo.steward.infrastructure.out.r2dbc;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * V2 pasa la eleccion del invitado ({@code miembro.diezmo_aportes}) a su regla de diezmo (design D2). Corre en un schema
 * propio para no tocar el de steward_test.
 */
class MigracionV2Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v2";

    @Test
    void elInvitadoQueDiezmabaSusAportesQuedaConRegla() throws Exception {
        Flyway v1 = flyway("1");
        v1.clean();
        v1.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES "
                + "('00000000-0000-0000-0000-000000000001', 'daniel@ejemplo.com', 'Daniel'), "
                + "('00000000-0000-0000-0000-000000000002', 'esposa@ejemplo.com', 'Esposa')");
        sql("INSERT INTO hogar (id, nombre) VALUES ('00000000-0000-0000-0000-0000000000aa', 'Nuestra casa')");
        sql("INSERT INTO miembro (hogar_id, usuario_id, unido_en, diezmo_aportes) VALUES "
                + "('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', '2026-10-01', false), "
                + "('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000002', '2026-10-27', true)");

        flyway("2").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            ResultSet r = s.executeQuery("SELECT usuario_id::text, activa, porcentaje, base, aplica_aportes FROM regla_diezmo");
            assertTrue(r.next());
            assertEquals("00000000-0000-0000-0000-000000000002", r.getString(1));
            assertTrue(r.getBoolean(2));
            assertEquals(0, r.getBigDecimal(3).compareTo(java.math.BigDecimal.TEN));
            assertEquals("BRUTO", r.getString(4));
            assertTrue(r.getBoolean(5));
            assertFalse(r.next(), "Daniel no elegia diezmar sus aportes: no tiene regla");
            ResultSet columnas = s.executeQuery("SELECT 1 FROM information_schema.columns WHERE table_schema = '" + SCHEMA
                    + "' AND table_name = 'miembro' AND column_name = 'diezmo_aportes'");
            assertFalse(columnas.next(), "la columna se elimina despues de migrarla");
        } finally {
            flyway("2").clean();
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
