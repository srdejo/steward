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
 * V13 crea la categoria Tarjetas en cada hogar y le pasa las lineas de las tarjetas; lo demas de Creditos se queda
 * (tarjetas-y-creditos). Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV13Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v13";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";
    private static final String CREDITOS = "'00000000-0000-0000-0000-0000000000c4'";
    private static final String TARJETA = "'00000000-0000-0000-0000-0000000000f1'";
    private static final String ESCENARIO = "'00000000-0000-0000-0000-0000000000ea'";

    @Test
    void lasLineasDeTarjetaPasanATarjetas() throws Exception {
        Flyway v12 = flyway("12");
        v12.clean();
        v12.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema) VALUES "
                + "('00000000-0000-0000-0000-0000000000c3', " + HOGAR + ", 'Variables', '#8D8F88', 2, 'VARIABLE', true), "
                + "(" + CREDITOS + ", " + HOGAR + ", 'Créditos', '#7C4DDB', 3, 'CREDITO', true)");
        sql("INSERT INTO plan_mes (id, hogar_id, ref_anio, ref_mes, estado) VALUES ('00000000-0000-0000-0000-0000000000ba', " + HOGAR
                + ", 2026, 11, 'ACTIVO')");
        sql("INSERT INTO escenario (id, plan_id, letra, creado_por) VALUES (" + ESCENARIO + ", '00000000-0000-0000-0000-0000000000ba', 'A', "
                + DANIEL + ")");
        sql("INSERT INTO tarjeta (id, hogar_id, nombre, dia_corte, dia_pago, uso, pago_tipo, pago_monto) VALUES (" + TARJETA + ", "
                + HOGAR + ", 'Nu', 11, 1, 'Mercado', 'COMPLETA', 1500000)");
        sql("INSERT INTO item_plan (id, escenario_id, categoria_id, nombre, monto, dia_vence, tipo, orden, tarjeta_id) VALUES "
                + "('00000000-0000-0000-0000-000000000001', " + ESCENARIO + ", " + CREDITOS + ", 'Tarjeta Nu · Mercado', 1500000, 1, 'FIJO', 1, " + TARJETA + "), "
                + "('00000000-0000-0000-0000-000000000002', " + ESCENARIO + ", " + CREDITOS + ", 'Cuota libre inversión', 500000, 15, 'CREDITO', 2, NULL)");

        flyway("13").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("Variables:VARIABLE:2:#8D8F88", "Tarjetas:TARJETA:3:#7C4DDB", "Créditos:CREDITO:4:#2E6B45"),
                    filas(s, "SELECT nombre || ':' || tipo || ':' || orden || ':' || color FROM categoria ORDER BY orden"));
            assertEquals(List.of("Tarjeta Nu · Mercado:TARJETA", "Cuota libre inversión:CREDITO"), filas(s,
                    "SELECT i.nombre || ':' || c.tipo FROM item_plan i JOIN categoria c ON c.id = i.categoria_id ORDER BY i.orden"));
        } finally {
            flyway("13").clean();
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
