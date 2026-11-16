package co.com.srdejo.steward.infrastructure.out.r2dbc;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * V16 cambia "en adelante" por el mes {@code hasta} del evento (anual-evento-rango): los "en adelante" quedan hasta
 * diciembre y los demas en su mes. Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV16Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v16";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";
    private static final String ANUAL = "'00000000-0000-0000-0000-0000000000a7'";
    private static final String OPCION = "'00000000-0000-0000-0000-0000000000b1'";

    @Test
    void enAdelantePasaADiciembre() throws Exception {
        Flyway v15 = flyway("15");
        v15.clean();
        v15.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO plan_anual (id, hogar_id, anio, estado) VALUES (" + ANUAL + ", " + HOGAR + ", 2027, 'BORRADOR')");
        sql("INSERT INTO anual_opcion (id, anual_id, letra, creado_por) VALUES (" + OPCION + ", " + ANUAL + ", 'A', " + DANIEL + ")");
        sql("INSERT INTO anual_evento (id, anual_id, opcion_id, nombre, mes, monto, tipo, en_adelante) VALUES "
                + "('00000000-0000-0000-0000-0000000000e1', " + ANUAL + ", " + OPCION + ", 'Aumento', 7, 300000, 'INGRESO', true), "
                + "('00000000-0000-0000-0000-0000000000e2', " + ANUAL + ", " + OPCION + ", 'SOAT', 3, 900000, 'GASTO', false)");

        flyway("16").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("Aumento:7-12", "SOAT:3-3"), filas(s, "SELECT nombre || ':' || mes || '-' || hasta FROM anual_evento ORDER BY nombre"));
            assertThrows(SQLException.class, () -> s.execute("UPDATE anual_evento SET hasta = 2 WHERE nombre = 'SOAT'"));
        } finally {
            flyway("16").clean();
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
