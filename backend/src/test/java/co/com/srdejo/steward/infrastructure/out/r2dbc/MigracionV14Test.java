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
 * V14 le da a cada plan anual su Opcion A con sus celdas, eventos y mes base; un año ya Creado queda con la A en uso
 * (anual-opciones-y-meses). Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV14Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v14";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";
    private static final String FIJOS = "'00000000-0000-0000-0000-0000000000c1'";
    private static final String ANUAL = "'00000000-0000-0000-0000-0000000000a7'";

    @Test
    void cadaAnualGanaSuOpcionA() throws Exception {
        Flyway v13 = flyway("13");
        v13.clean();
        v13.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO miembro (hogar_id, usuario_id, unido_en) VALUES (" + HOGAR + ", " + DANIEL + ", '2026-10-01')");
        sql("INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema) VALUES (" + FIJOS + ", " + HOGAR
                + ", 'Gastos fijos', '#E2551B', 1, 'FIJO', true)");
        sql("INSERT INTO plan_anual (id, hogar_id, anio, estado, base_anio, base_mes) VALUES (" + ANUAL + ", " + HOGAR
                + ", 2027, 'CREADO', 2026, 12)");
        sql("INSERT INTO anual_celda (anual_id, categoria_id, mes, monto) VALUES (" + ANUAL + ", " + FIJOS + ", 1, 1602000), ("
                + ANUAL + ", " + FIJOS + ", 2, 1602000)");
        sql("INSERT INTO anual_evento (id, anual_id, nombre, mes, monto, tipo) VALUES ('00000000-0000-0000-0000-0000000000e1', "
                + ANUAL + ", 'SOAT carro', 4, 1000000, 'GASTO')");

        flyway("14").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("A:" + DANIEL.replace("'", "") + ":2026:12"),
                    filas(s, "SELECT letra || ':' || creado_por || ':' || base_anio || ':' || base_mes FROM anual_opcion"));
            assertEquals(List.of("true"), filas(s, "SELECT (a.opcion_en_uso_id = o.id)::text FROM plan_anual a JOIN anual_opcion o ON o.anual_id = a.id"));
            assertEquals(List.of("2"), filas(s, "SELECT count(*)::text FROM anual_celda c JOIN anual_opcion o ON o.id = c.opcion_id AND o.letra = 'A'"));
            assertEquals(List.of("SOAT carro"), filas(s, "SELECT e.nombre FROM anual_evento e JOIN anual_opcion o ON o.id = e.opcion_id"));
        } finally {
            flyway("14").clean();
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
