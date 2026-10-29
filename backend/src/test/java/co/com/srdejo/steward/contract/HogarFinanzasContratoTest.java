package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.regla;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-hogar con finanzas: "Aceptar una invitacion" (la preferencia de diezmo queda en la regla) y "Salir del
 * hogar" (que pasa con sus ingresos y cuentas).
 */
class HogarFinanzasContratoTest extends ContratoBase {

    private String daniel;

    @BeforeEach
    void hogar() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
    }

    @Test
    void diezmarDeMisAportes() {
        String token = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        String esposa = entrar("esposa@ejemplo.com", "Esposa");
        post(esposa, "/api/invitaciones/{t}/aceptar", Map.of("nombre", "Esposa", "diezmoAportes", true), token)
                .expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.reglas.length()").isEqualTo(1)
                .jsonPath("$.reglas[0].activa").isEqualTo(true)
                .jsonPath("$.reglas[0].porcentaje").isEqualTo(10)
                .jsonPath("$.reglas[0].base").isEqualTo("BRUTO")
                .jsonPath("$.reglas[0].aplicaAportes").isEqualTo(true);
    }

    @Test
    void sinDiezmoYSinReglaNoSeCreaRegla() {
        unirA(daniel, "esposa@ejemplo.com", "Esposa");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.reglas.length()").isEqualTo(0);
    }

    @Test
    void porMisInvitacionesConReglaPreviaSoloCambiaLosAportes() {
        invitar(daniel, "esposa@ejemplo.com");
        String esposa = entrar("esposa@ejemplo.com", "Esposa");
        put(esposa, "/api/regla-diezmo", regla(true, 5, "NETO", false)).expectStatus().isOk();
        List<?> mias = get(esposa, "/api/mis-invitaciones").expectBody(List.class).returnResult().getResponseBody();
        String id = (String) ((Map<?, ?>) mias.getFirst()).get("id");
        post(esposa, "/api/mis-invitaciones/{id}/aceptar", Map.of("nombre", "Esposa", "diezmoAportes", true), id)
                .expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.reglas[0].porcentaje").isEqualTo(5)
                .jsonPath("$.reglas[0].base").isEqualTo("NETO")
                .jsonPath("$.reglas[0].aplicaAportes").isEqualTo(true);
    }

    @Test
    void susIngresosYCuentas() {
        String esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        put(esposa, "/api/regla-diezmo", regla(true, 10, "BRUTO", true)).expectStatus().isOk();
        java.util.Map<String, Object> suyo = salario(3_000_000, 3_000_000);
        suyo.put("nombre", "Salario Esposa");
        post(esposa, "/api/ingresos-fijos", suyo).expectStatus().isCreated();
        post(esposa, "/api/cuentas", cuenta("Ahorros Esposa", "YO", 1_000_000)).expectStatus().isCreated();
        post(esposa, "/api/cuentas", cuenta("Efectivo", "CONJUNTA", 200_000)).expectStatus().isCreated();

        delete(esposa, "/api/hogar/miembros/yo").expectStatus().isNoContent();

        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.ingresosFijos.length()").isEqualTo(0)
                .jsonPath("$.cuentas.length()").isEqualTo(1)
                .jsonPath("$.cuentas[0].nombre").isEqualTo("Efectivo");
        // Su regla es suya: la conserva para su proximo hogar.
        crearHogar(esposa, "Casa Esposa").expectStatus().isCreated();
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.reglas[0].aplicaAportes").isEqualTo(true)
                .jsonPath("$.ingresosFijos.length()").isEqualTo(0);
    }

    @Test
    void elUltimoQueSaleNoDejaNada() throws Exception {
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        post(daniel, "/api/cuentas", cuenta("Efectivo", "CONJUNTA", 200_000)).expectStatus().isCreated();
        String id = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), id).expectStatus().isCreated();
        List<?> pendientes = get(daniel, "/api/diezmo/pendientes").expectBody(List.class).returnResult().getResponseBody();
        post(daniel, "/api/diezmo/entregas", Map.of("obligaciones", List.of(((Map<?, ?>) pendientes.getFirst()).get("id"))))
                .expectStatus().isCreated();

        delete(daniel, "/api/hogar/miembros/yo").expectStatus().isNoContent();

        assertEquals(0, contar("hogar"));
        assertEquals(0, contar("ingreso_fijo"));
        assertEquals(0, contar("cuenta"));
        assertEquals(0, contar("movimiento"));
        assertEquals(0, contar("diezmo_cubierto"));
        assertEquals(1, contar("regla_diezmo"));
    }

    private static long contar(String tabla) throws Exception {
        try (Connection c = DriverManager.getConnection(DB_URL, "postgres", "postgres");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery("SELECT count(*) FROM " + tabla)) {
            r.next();
            return r.getLong(1);
        }
    }
}
