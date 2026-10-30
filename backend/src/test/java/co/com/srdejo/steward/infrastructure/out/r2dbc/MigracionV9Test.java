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
 * V9 (design D8 de usabilidad-plan): cada linea gana su bruto y cada diezmo se enlaza a su linea (FIJO por su ingreso, EXTRA por
 * su nombre), con "ajustado a mano" cuando ya no coincide con la regla. Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV9Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v9";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";
    private static final String SALARIO = "'00000000-0000-0000-0000-0000000000f1'";
    private static final String ESC = "'00000000-0000-0000-0000-0000000000e1'";

    @Test
    void lasLineasGananSuBrutoYLosDiezmosSuLinea() throws Exception {
        Flyway v8 = flyway("8");
        v8.clean();
        v8.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO regla_diezmo (usuario_id, activa, porcentaje, base, aplica_aportes) VALUES (" + DANIEL + ", true, 10, 'BRUTO', true)");
        sql("INSERT INTO ingreso_fijo (id, hogar_id, usuario_id, nombre, bruto, neto, dia_pago) VALUES (" + SALARIO + ", " + HOGAR + ", "
                + DANIEL + ", 'Salario', 5100000, 4800000, 25)");
        sql("INSERT INTO plan_mes (id, hogar_id, ref_anio, ref_mes, estado) VALUES ('00000000-0000-0000-0000-0000000000b1', " + HOGAR
                + ", 2099, 6, 'BORRADOR')");
        sql("INSERT INTO escenario (id, plan_id, letra, creado_por) VALUES (" + ESC + ", '00000000-0000-0000-0000-0000000000b1', 'A', " + DANIEL + ")");
        sql("INSERT INTO ingreso_plan (id, escenario_id, nombre, monto, usuario_id, tipo, ingreso_fijo_id, orden) VALUES "
                + "('00000000-0000-0000-0000-0000000000a1', " + ESC + ", 'Salario', 4800000, " + DANIEL + ", 'FIJO', " + SALARIO + ", 1), "
                + "('00000000-0000-0000-0000-0000000000a2', " + ESC + ", 'Prima', 3000000, " + DANIEL + ", 'EXTRA', NULL, 2)");
        sql("INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema) VALUES ('00000000-0000-0000-0000-0000000000d0', " + HOGAR
                + ", 'Diezmo', '#0F766E', 0, 'DIEZMO', true)");
        String diezmo = "'00000000-0000-0000-0000-0000000000d0'";
        sql("INSERT INTO item_plan (id, escenario_id, categoria_id, nombre, monto, tipo, orden, ingreso_fijo_id) VALUES "
                + "('00000000-0000-0000-0000-0000000000c1', " + ESC + ", " + diezmo + ", 'Diezmo · Salario', 510000, 'DIEZMO', 1, " + SALARIO + "), "
                + "('00000000-0000-0000-0000-0000000000c2', " + ESC + ", " + diezmo + ", 'Diezmo · Prima', 350000, 'DIEZMO', 2, NULL)");

        flyway("9").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("Salario 5100000", "Prima 3000000"),
                    filas(s, "SELECT nombre || ' ' || bruto FROM ingreso_plan ORDER BY orden"));
            // El del salario coincide con su regla (10 % de $5.100.000); el de la prima se habia cambiado a $350.000.
            assertEquals(List.of("Diezmo · Salario a1 false", "Diezmo · Prima a2 true"),
                    filas(s, "SELECT nombre || ' ' || right(ingreso_plan_id::text, 2) || ' ' || ajustado_a_mano FROM item_plan ORDER BY orden"));
            assertEquals(List.of("1"), filas(s, "SELECT count(*) FROM information_schema.columns WHERE table_schema = '" + SCHEMA
                    + "' AND table_name = 'movimiento' AND column_name = 'capital'"));
        } finally {
            flyway("9").clean();
        }
    }

    private static List<String> filas(Statement s, String consulta) throws Exception {
        ResultSet r = s.executeQuery(consulta);
        List<String> filas = new ArrayList<>();
        while (r.next()) {
            filas.add(r.getString(1));
        }
        return filas;
    }

    private static Flyway flyway(String version) {
        return Flyway.configure().dataSource(URL, "postgres", "postgres").schemas(SCHEMA).cleanDisabled(false)
                .target(version).load();
    }

    private static void sql(String sentencia) throws Exception {
        try (Connection c = conexion(); Statement st = c.createStatement()) {
            st.execute(sentencia);
        }
    }

    private static Connection conexion() throws Exception {
        Connection c = DriverManager.getConnection(URL, "postgres", "postgres");
        c.setSchema(SCHEMA);
        return c;
    }
}
