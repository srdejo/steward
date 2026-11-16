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
 * V15 agrega el mes base editable: las opciones que ya existian quedan sin mes base, y sus gastos se guardan en
 * anual_base_item (anual-mes-base-editable). Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV15Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v15";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";
    private static final String FIJOS = "'00000000-0000-0000-0000-0000000000c1'";
    private static final String ANUAL = "'00000000-0000-0000-0000-0000000000a7'";
    private static final String OPCION = "'00000000-0000-0000-0000-0000000000b1'";

    @Test
    void lasOpcionesQuedanSinMesBase() throws Exception {
        Flyway v14 = flyway("14");
        v14.clean();
        v14.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema) VALUES (" + FIJOS + ", " + HOGAR
                + ", 'Gastos fijos', '#E2551B', 1, 'FIJO', true)");
        sql("INSERT INTO plan_anual (id, hogar_id, anio, estado) VALUES (" + ANUAL + ", " + HOGAR + ", 2027, 'BORRADOR')");
        sql("INSERT INTO anual_opcion (id, anual_id, letra, creado_por) VALUES (" + OPCION + ", " + ANUAL + ", 'A', " + DANIEL + ")");

        flyway("15").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("false"), filas(s, "SELECT con_mes_base::text FROM anual_opcion"));
            s.execute("INSERT INTO anual_base_item (id, opcion_id, categoria_id, nombre, monto, tipo) VALUES "
                    + "('00000000-0000-0000-0000-0000000000d1', " + OPCION + ", " + FIJOS + ", 'Internet', 120000, 'FIJO')");
            assertEquals(List.of("Internet:120000"), filas(s, "SELECT nombre || ':' || monto FROM anual_base_item"));
            // Quitar la opcion se lleva su mes base.
            s.execute("DELETE FROM anual_opcion WHERE id = " + OPCION);
            assertEquals(List.of("0"), filas(s, "SELECT count(*)::text FROM anual_base_item"));
        } finally {
            flyway("15").clean();
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
