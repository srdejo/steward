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
 * V8 (design D5 y D8 de diezmo-como-gasto): un plan abierto gana sus lineas de ingreso y sus items de diezmo, sin el del
 * ingreso ya recibido y entregado; uno cerrado no cambia. Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV8Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v8";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";
    private static final String ESPOSA = "'00000000-0000-0000-0000-000000000002'";
    private static final String SALARIO = "'00000000-0000-0000-0000-0000000000f1'";
    private static final String SALARIO_ESPOSA = "'00000000-0000-0000-0000-0000000000f2'";
    // Un mes futuro (abierto) y uno pasado cerrado: la migracion compara con el mes en curso real.
    private static final int ANIO = 2099;

    @Test
    void losPlanesAbiertosGananSusLineasYSusDiezmos() throws Exception {
        Flyway v7 = flyway("7");
        v7.clean();
        v7.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel'), ("
                + ESPOSA + ", 'esposa@ejemplo.com', 'Esposa')");
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO regla_diezmo (usuario_id, activa, porcentaje, base, aplica_aportes) VALUES (" + DANIEL + ", true, 10, 'BRUTO', true), ("
                + ESPOSA + ", true, 10, 'NETO', false)");
        sql("INSERT INTO ingreso_fijo (id, hogar_id, usuario_id, nombre, bruto, neto, dia_pago) VALUES (" + SALARIO + ", " + HOGAR + ", "
                + DANIEL + ", 'Salario Daniel', 7000000, 6288000, 25), (" + SALARIO_ESPOSA + ", " + HOGAR + ", " + ESPOSA
                + ", 'Salario Esposa', 3500000, 3000005, 30)");
        sql("INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema) VALUES "
                + "('00000000-0000-0000-0000-0000000000c1', " + HOGAR + ", 'Gastos fijos', '#E2551B', 1, 'FIJO', true)");
        plan("'00000000-0000-0000-0000-0000000000b1'", "'00000000-0000-0000-0000-0000000000e1'", 6, "BORRADOR");
        plan("'00000000-0000-0000-0000-0000000000b2'", "'00000000-0000-0000-0000-0000000000e2'", 5, "CERRADO");
        sql("INSERT INTO item_plan (id, escenario_id, categoria_id, nombre, monto, tipo, orden) VALUES (gen_random_uuid(), "
                + "'00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Internet', 120000, 'FIJO', 1)");
        // Junio: la prima de Daniel en el anual.
        sql("INSERT INTO plan_anual (id, hogar_id, anio) VALUES ('00000000-0000-0000-0000-0000000000a1', " + HOGAR + ", " + ANIO + ")");
        sql("INSERT INTO anual_evento (id, anual_id, nombre, mes, monto, tipo, usuario_id) VALUES (gen_random_uuid(), "
                + "'00000000-0000-0000-0000-0000000000a1', 'Prima', 6, 3000000, 'INGRESO', " + DANIEL + ")");
        // Junio: el salario de Esposa recibido y su diezmo entregado (no se duplica); el de Daniel recibido sin entregar.
        movimiento("'00000000-0000-0000-0000-000000000d01'", "INGRESO_FIJO", 3000005, ESPOSA, SALARIO_ESPOSA, false);
        movimiento("'00000000-0000-0000-0000-000000000d02'", "DIEZMO_ENTREGADO", 300001, ESPOSA, "NULL", false);
        sql("INSERT INTO diezmo_cubierto (movimiento_id, entrega_id) VALUES ('00000000-0000-0000-0000-000000000d01', "
                + "'00000000-0000-0000-0000-000000000d02')");
        movimiento("'00000000-0000-0000-0000-000000000d03'", "INGRESO_FIJO", 6288000, DANIEL, SALARIO, true);
        // Un aporte con diezmo (sin entregar), del 26 de junio.
        movimiento("'00000000-0000-0000-0000-000000000d04'", "APORTE", 1000000, DANIEL, "NULL", true);

        flyway("8").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("Diezmo:0:DIEZMO", "Gastos fijos:1:FIJO"),
                    filas(s, "SELECT nombre || ':' || orden || ':' || tipo FROM categoria ORDER BY orden"));
            assertEquals(List.of("Internet:120000", "Diezmo · Salario Daniel:700000", "Diezmo · Prima:300000",
                            "Diezmo · aporte 26 jun:100000"),
                    filas(s, "SELECT nombre || ':' || monto FROM item_plan WHERE escenario_id = '00000000-0000-0000-0000-0000000000e1' ORDER BY orden"));
            assertEquals(List.of("ing:" + SALARIO.replace("'", ""), "apo:00000000-0000-0000-0000-000000000d04"),
                    filas(s, "SELECT coalesce('ing:' || ingreso_fijo_id, 'apo:' || aporte_id) FROM item_plan "
                            + "WHERE tipo = 'DIEZMO' AND (ingreso_fijo_id IS NOT NULL OR aporte_id IS NOT NULL) ORDER BY orden"));
            assertEquals(List.of("Salario Daniel:6288000:FIJO", "Salario Esposa:3000005:FIJO", "Prima:3000000:EXTRA"),
                    filas(s, "SELECT nombre || ':' || monto || ':' || tipo FROM ingreso_plan WHERE escenario_id = '00000000-0000-0000-0000-0000000000e1' ORDER BY orden"));
            // El plan cerrado no cambia.
            assertEquals(List.of("0"), filas(s, "SELECT count(*) FROM item_plan WHERE escenario_id = '00000000-0000-0000-0000-0000000000e2'"));
            assertEquals(List.of("0"), filas(s, "SELECT count(*) FROM ingreso_plan WHERE escenario_id = '00000000-0000-0000-0000-0000000000e2'"));
            assertEquals(List.of("0"), filas(s, "SELECT count(*) FROM information_schema.columns WHERE table_schema = '" + SCHEMA
                    + "' AND table_name = 'hogar' AND column_name = 'diezmo_en_hoy'"));
        } finally {
            flyway("8").clean();
        }
    }

    private static void plan(String id, String escenario, int mes, String estado) throws Exception {
        sql("INSERT INTO plan_mes (id, hogar_id, ref_anio, ref_mes, estado) VALUES (" + id + ", " + HOGAR + ", " + ANIO + ", " + mes
                + ", '" + estado + "')");
        sql("INSERT INTO escenario (id, plan_id, letra, creado_por) VALUES (" + escenario + ", " + id + ", 'A', " + DANIEL + ")");
    }

    private static void movimiento(String id, String tipo, long monto, String usuario, String ingreso, boolean aplica) throws Exception {
        sql("INSERT INTO movimiento (id, hogar_id, tipo, ref_anio, ref_mes, monto, fecha, usuario_id, creado_por, ingreso_fijo_id, aplica_diezmo) "
                + "VALUES (" + id + ", " + HOGAR + ", '" + tipo + "', " + ANIO + ", 6, " + monto + ", '" + ANIO + "-06-26', " + usuario + ", "
                + usuario + ", " + ingreso + ", " + aplica + ")");
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
