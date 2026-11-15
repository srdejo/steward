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
 * V12 une "Tarjetas y cuotas" con Creditos sin perder montos y convierte las compras a cuotas en creditos con plan de pagos
 * (design D5 de tarjetas-y-creditos). Corre en un schema propio para no tocar el de steward_test.
 */
class MigracionV12Test {

    private static final String URL = "jdbc:postgresql://localhost:5433/steward_test";
    private static final String SCHEMA = "migracion_v12";
    private static final String HOGAR = "'00000000-0000-0000-0000-0000000000aa'";
    private static final String DANIEL = "'00000000-0000-0000-0000-000000000001'";
    private static final String TARJETAS = "'00000000-0000-0000-0000-0000000000c2'";
    private static final String CREDITOS = "'00000000-0000-0000-0000-0000000000c4'";

    @Test
    void creditosSumaTarjetasYLasCuotasSonUnCredito() throws Exception {
        Flyway v11 = flyway("11");
        v11.clean();
        v11.migrate();
        sql("INSERT INTO usuario (id, email, nombre) VALUES (" + DANIEL + ", 'daniel@ejemplo.com', 'Daniel')");
        sql("INSERT INTO hogar (id, nombre) VALUES (" + HOGAR + ", 'Nuestra casa')");
        sql("INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema) VALUES "
                + "('00000000-0000-0000-0000-0000000000c1', " + HOGAR + ", 'Gastos fijos', '#E2551B', 1, 'FIJO', true), "
                + "(" + TARJETAS + ", " + HOGAR + ", 'Tarjetas y cuotas', '#7C4DDB', 2, 'TARJETA', true), "
                + "('00000000-0000-0000-0000-0000000000c3', " + HOGAR + ", 'Variables', '#8D8F88', 3, 'VARIABLE', true), "
                + "(" + CREDITOS + ", " + HOGAR + ", 'Créditos', '#2E6B45', 4, 'CREDITO', true)");
        // Septiembre (cerrado, con la cuota 3 pagada) y octubre (la cuota 4 sin pagar).
        mes("e9", "b9", 9, "CERRADO");
        mes("ea", "ba", 10, "ACTIVO");
        item("0001", "e9", TARJETAS, "Tarjeta Mastercard", 1_500_000, "FIJO", "NULL", "NULL");
        item("0002", "e9", TARJETAS, "Compra a cuotas", 375_000, "CUOTA", "3", "12");
        item("0003", "e9", CREDITOS, "Cuota libre inversión", 500_000, "CREDITO", "NULL", "NULL");
        item("0004", "ea", TARJETAS, "Tarjeta Mastercard", 1_500_000, "FIJO", "NULL", "NULL");
        item("0005", "ea", TARJETAS, "Compra a cuotas", 375_000, "CUOTA", "4", "12");
        item("0006", "ea", CREDITOS, "Cuota libre inversión", 500_000, "CREDITO", "NULL", "NULL");
        sql("INSERT INTO movimiento (id, hogar_id, tipo, ref_anio, ref_mes, monto, fecha, usuario_id, creado_por, item_id) VALUES "
                + "('00000000-0000-0000-0000-000000000d01', " + HOGAR + ", 'PAGO', 2026, 9, 375000, '2026-09-20', " + DANIEL + ", "
                + DANIEL + ", '00000000-0000-0000-0000-000000000002')");
        sql("INSERT INTO plan_anual (id, hogar_id, anio) VALUES ('00000000-0000-0000-0000-0000000000f1', " + HOGAR + ", 2027)");
        sql("INSERT INTO anual_celda (anual_id, categoria_id, mes, monto) VALUES "
                + "('00000000-0000-0000-0000-0000000000f1', " + TARJETAS + ", 1, 2675000), "
                + "('00000000-0000-0000-0000-0000000000f1', " + CREDITOS + ", 1, 500000), "
                + "('00000000-0000-0000-0000-0000000000f1', " + TARJETAS + ", 2, 2675000)");

        flyway("12").migrate();

        try (Connection c = conexion(); Statement s = c.createStatement()) {
            assertEquals(List.of("Gastos fijos:FIJO:1", "Variables:VARIABLE:2", "Créditos:CREDITO:3:#7C4DDB"),
                    filas(s, "SELECT nombre || ':' || tipo || ':' || orden || CASE WHEN tipo = 'CREDITO' THEN ':' || color ELSE '' END "
                            + "FROM categoria ORDER BY orden"));
            // El total de cada mes no cambia: todo quedo en Creditos.
            assertEquals(List.of("9:2375000", "10:2375000"), filas(s, "SELECT p.ref_mes || ':' || sum(i.monto) FROM item_plan i "
                    + "JOIN escenario e ON e.id = i.escenario_id JOIN plan_mes p ON p.id = e.plan_id "
                    + "WHERE i.categoria_id = " + CREDITOS + " GROUP BY p.ref_mes ORDER BY p.ref_mes"));
            assertEquals(List.of("1:3175000", "2:2675000"), filas(s, "SELECT mes || ':' || monto FROM anual_celda ORDER BY mes"));
            // La compra a cuotas: un credito PLAN con la cuota 3 pagada, enlazado a sus dos items.
            assertEquals(List.of("Compra a cuotas:PLAN:12:3:3375000:375000:4500000"), filas(s,
                    "SELECT nombre || ':' || metodo || ':' || numero_cuotas || ':' || cuotas_pagadas || ':' || saldo || ':' || cuota "
                            + "|| ':' || valor_financiado FROM credito"));
            assertEquals(List.of("CREDITO:true", "CREDITO:true"), filas(s, "SELECT tipo || ':' || (credito_id IS NOT NULL AND cuota_actual IS NULL) "
                    + "FROM item_plan WHERE nombre = 'Compra a cuotas'"));
        } finally {
            flyway("12").clean();
        }
    }

    private static void mes(String escenario, String plan, int mes, String estado) throws Exception {
        String p = "'00000000-0000-0000-0000-0000000000" + plan + "'";
        sql("INSERT INTO plan_mes (id, hogar_id, ref_anio, ref_mes, estado) VALUES (" + p + ", " + HOGAR + ", 2026, " + mes + ", '" + estado + "')");
        sql("INSERT INTO escenario (id, plan_id, letra, creado_por) VALUES ('00000000-0000-0000-0000-0000000000" + escenario + "', "
                + p + ", 'A', " + DANIEL + ")");
    }

    private static void item(String id, String escenario, String categoria, String nombre, long monto, String tipo, String actual,
                             String total) throws Exception {
        sql("INSERT INTO item_plan (id, escenario_id, categoria_id, nombre, monto, dia_vence, tipo, cuota_actual, cuota_total, orden) "
                + "VALUES ('00000000-0000-0000-0000-00000000" + id + "', '00000000-0000-0000-0000-0000000000" + escenario + "', "
                + categoria + ", '" + nombre + "', " + monto + ", 20, '" + tipo + "', " + actual + ", " + total + ", 1)");
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
