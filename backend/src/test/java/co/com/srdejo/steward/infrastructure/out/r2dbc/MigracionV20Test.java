package co.com.srdejo.steward.infrastructure.out.r2dbc;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * V20 agrega el enlace y el codigo de pago de un gasto, opcionales, en el plan del mes y en el mes base (design D1 de
 * gastos-datos-pago). Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV20Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v20";

    @Test
    void losGastosGananEnlaceYCodigoDePagoOpcionales() throws Exception {
        Flyway v19 = flyway("19");
        v19.clean();
        v19.migrate();
        flyway("20").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            ResultSet r = s.executeQuery("SELECT table_name || '.' || column_name || ':' || is_nullable FROM information_schema.columns "
                    + "WHERE table_schema = '" + SCHEMA + "' AND column_name IN ('enlace_pago', 'codigo_pago') ORDER BY 1");
            List<String> columnas = new ArrayList<>();
            while (r.next()) {
                columnas.add(r.getString(1));
            }
            assertEquals(List.of("anual_base_item.codigo_pago:YES", "anual_base_item.enlace_pago:YES",
                    "item_plan.codigo_pago:YES", "item_plan.enlace_pago:YES"), columnas);
        } finally {
            flyway("20").clean();
        }
    }

    private static Flyway flyway(String version) {
        return Flyway.configure().dataSource(URL, "postgres", "postgres").schemas(SCHEMA).cleanDisabled(false)
                .target(version).load();
    }

    private static Connection conexion() throws Exception {
        Connection c = DriverManager.getConnection(URL, "postgres", "postgres");
        c.setSchema(SCHEMA);
        return c;
    }
}
