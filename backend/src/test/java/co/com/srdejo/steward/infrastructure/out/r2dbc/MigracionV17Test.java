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
 * V17 pasa los colores del diseño anterior a los de Libreta clara y conserva los que el hogar eligio (design D3 de
 * color-categorias). Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV17Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v17";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";

    @Test
    void losColoresViejosPasanALibretaClaraYLosElegidosSeQuedan() throws Exception {
        Flyway v16 = flyway("16");
        v16.clean();
        v16.migrate();
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema) VALUES "
                + "('00000000-0000-0000-0000-0000000000c0', " + HOGAR + ", 'Diezmo', '#0F766E', 0, 'DIEZMO', true), "
                + "('00000000-0000-0000-0000-0000000000c1', " + HOGAR + ", 'Gastos fijos', '#e2551b', 1, 'FIJO', true), "
                + "('00000000-0000-0000-0000-0000000000c2', " + HOGAR + ", 'Variables', '#9A4F7E', 2, 'VARIABLE', true), "
                + "('00000000-0000-0000-0000-0000000000c3', " + HOGAR + ", 'Tarjetas', '#7C4DDB', 3, 'TARJETA', true), "
                + "('00000000-0000-0000-0000-0000000000c4', " + HOGAR + ", 'Créditos', '#2E6B45', 4, 'CREDITO', true), "
                + "('00000000-0000-0000-0000-0000000000c5', " + HOGAR + ", 'Educación', '#8D8F88', 5, 'OTRO', false), "
                + "('00000000-0000-0000-0000-0000000000c6', " + HOGAR + ", 'Mascotas', '#123456', 6, 'OTRO', false)");

        flyway("17").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("Diezmo:#2C7A70", "Gastos fijos:#C2603A", "Variables:#9A4F7E", "Tarjetas:#6B5BA8",
                    "Créditos:#6B5BA8", "Educación:#8A8D85", "Mascotas:#123456"),
                    filas(s, "SELECT nombre || ':' || color FROM categoria ORDER BY orden"));
        } finally {
            flyway("17").clean();
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
