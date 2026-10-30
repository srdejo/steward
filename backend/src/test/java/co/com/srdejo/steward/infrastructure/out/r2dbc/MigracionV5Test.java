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
 * V5 numera lo ya registrado en el orden en que se registro, y las cuentas que ya existen siguen sumando todo desde su
 * saldo inicial (design D1 de backend-cuentas-creditos). Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV5Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v5";

    @Test
    void loRegistradoQuedaEnOrdenYLasCuentasSumanTodo() throws Exception {
        Flyway v4 = flyway("4");
        v4.clean();
        v4.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES ('00000000-0000-0000-0000-000000000001', 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES ('00000000-0000-0000-0000-0000000000aa', 'Nuestra casa')");
        sql("INSERT INTO cuenta (id, hogar_id, nombre, saldo_cuadre, fecha_cuadre) VALUES "
                + "('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000aa', 'Davivienda', 0, '2026-10-01')");
        // El id menor se registro despues: el orden sale de creado_en.
        movimiento("00000000-0000-0000-0000-000000000d01", "2026-10-20 10:00");
        movimiento("00000000-0000-0000-0000-000000000d02", "2026-10-02 10:00");

        flyway("5").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            ResultSet r = s.executeQuery("SELECT id::text FROM movimiento ORDER BY seq");
            List<String> orden = new ArrayList<>();
            while (r.next()) {
                orden.add(r.getString(1).substring(32));
            }
            assertEquals(List.of("0d02", "0d01"), orden);
            movimiento("00000000-0000-0000-0000-000000000d03", "2026-10-21 10:00");
            ResultSet n = s.executeQuery("SELECT seq FROM movimiento WHERE id = '00000000-0000-0000-0000-000000000d03'");
            n.next();
            assertEquals(3, n.getLong(1));
            ResultSet cuenta = s.executeQuery("SELECT seq_cuadre FROM cuenta");
            cuenta.next();
            assertEquals(0, cuenta.getLong(1));
        } finally {
            flyway("5").clean();
        }
    }

    private static void movimiento(String id, String creadoEn) throws Exception {
        sql("INSERT INTO movimiento (id, hogar_id, tipo, ref_anio, ref_mes, monto, fecha, usuario_id, creado_por, creado_en) VALUES ('"
                + id + "', '00000000-0000-0000-0000-0000000000aa', 'GASTO', 2026, 10, 10, '2026-10-02', "
                + "'00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '" + creadoEn + "')");
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
