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
 * V3 da las categorias del sistema a los hogares que ya existen y marca el origen de lo ya registrado (design D2). Corre
 * en un schema propio para no tocar el de steward_test.
 */
class MigracionV3Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v3";

    @Test
    void hogaresExistentesRecibenCategoriasYLoRegistradoSuOrigen() throws Exception {
        Flyway v2 = flyway("2");
        v2.clean();
        v2.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES ('00000000-0000-0000-0000-000000000001', 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES ('00000000-0000-0000-0000-0000000000aa', 'Nuestra casa')");
        sql("INSERT INTO cuenta (id, hogar_id, nombre, saldo_cuadre, fecha_cuadre) VALUES "
                + "('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000aa', 'Davivienda', 0, '2026-10-01')");
        sql("INSERT INTO ingreso_fijo (id, hogar_id, usuario_id, nombre, bruto, neto, dia_pago) VALUES "
                + "('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000aa', "
                + "'00000000-0000-0000-0000-000000000001', 'Salario', 10, 10, 25)");
        sql("INSERT INTO movimiento (id, hogar_id, tipo, ref_anio, ref_mes, monto, fecha, usuario_id, creado_por, cuenta_id, ingreso_fijo_id) VALUES "
                + "('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-0000000000aa', 'INGRESO_FIJO', 2026, 10, 10, "
                + "'2026-10-25', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', "
                + "'00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1')");

        flyway("3").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            ResultSet r = s.executeQuery("SELECT nombre, tipo, sistema FROM categoria ORDER BY orden");
            List<String> categorias = new ArrayList<>();
            while (r.next()) {
                categorias.add(r.getString(1) + ":" + r.getString(2) + ":" + r.getBoolean(3));
            }
            assertEquals(List.of("Gastos fijos:FIJO:true", "Tarjetas y cuotas:TARJETA:true", "Variables:VARIABLE:true",
                    "Créditos:CREDITO:true"), categorias);
            ResultSet m = s.executeQuery("SELECT origen, nota FROM movimiento");
            m.next();
            assertEquals("CUENTA", m.getString(1));
            assertEquals("", m.getString(2));
        } finally {
            flyway("3").clean();
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
