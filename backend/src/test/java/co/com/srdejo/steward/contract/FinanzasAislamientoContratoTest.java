package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.regla;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;

/** Spec steward-finanzas, "Aislamiento de las finanzas": dos hogares que no se ven. */
class FinanzasAislamientoContratoTest extends ContratoBase {

    private String daniel;
    private String otro;
    private String salarioDaniel;

    @BeforeEach
    void dosHogares() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        salarioDaniel = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");

        otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
    }

    @Test
    void ingresoDeOtroHogar() {
        post(otro, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioDaniel).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("INGRESO_NO_ENCONTRADO");
        put(otro, "/api/ingresos-fijos/{id}", salario(1, 1), salarioDaniel).expectStatus().isNotFound();
        delete(otro, "/api/ingresos-fijos/{id}", salarioDaniel).expectStatus().isNotFound();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos.length()").isEqualTo(0)
                .jsonPath("$.ingresosFijos[0].neto").isEqualTo(6_288_000);
        get(otro, "/api/finanzas").expectBody()
                .jsonPath("$.ingresosFijos.length()").isEqualTo(0)
                .jsonPath("$.reglas.length()").isEqualTo(0);
    }

    @Test
    void entregarDiezmoAjeno() {
        // El diezmo es un item del plan: otro hogar no lo puede marcar pagado (diezmo-como-gasto).
        java.time.YearMonth mes = java.time.YearMonth.now(java.time.ZoneId.of("America/Bogota"));
        Map<?, ?> plan = post(daniel, "/api/planes", Map.of("anio", mes.getYear(), "mes", mes.getMonthValue(), "modo", "CERO"))
                .expectStatus().isCreated().expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> esc = (Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst();
        String diezmo = (String) ((Map<?, ?>) ((List<?>) esc.get("items")).getFirst()).get("id");
        String linea = (String) ((Map<?, ?>) ((List<?>) esc.get("ingresos")).getFirst()).get("id");
        Map<String, Object> pago = new HashMap<>();
        pago.put("itemId", diezmo);
        pago.put("monto", 700_000);
        pago.put("usuarioId", null);
        pago.put("origen", Map.of("tipo", "NINGUNO"));
        post(otro, "/api/pagos", pago).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("ITEM_NO_ENCONTRADO");
        post(otro, "/api/planes/{p}/escenarios/{e}/ingresos/{l}/recibido", Map.of(), plan.get("id"), esc.get("id"), linea)
                .expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("INGRESO_NO_ENCONTRADO");
        post(otro, "/api/planes/{p}/escenarios/{e}/ingresos", Map.of("nombre", "Intruso", "monto", 1), plan.get("id"), esc.get("id"))
                .expectStatus().isNotFound();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos").isEmpty()
                .jsonPath("$.planes[0].escenarios[0].ingresos.length()").isEqualTo(1);
    }

    @Test
    void cuentaDeOtroHogarComoCuentaDelIngreso() {
        String cuentaDaniel = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)), "id");
        Map<String, Object> conCuentaAjena = salario(2_000_000, 2_000_000);
        conCuentaAjena.put("cuentaId", cuentaDaniel);
        post(otro, "/api/ingresos-fijos", conCuentaAjena).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("CUENTA_NO_ENCONTRADA");
        get(otro, "/api/finanzas").expectBody()
                .jsonPath("$.cuentas.length()").isEqualTo(0)
                .jsonPath("$.ingresosFijos.length()").isEqualTo(0);
    }

    @Test
    void sinSesionTodoDa401() {
        String id = salarioDaniel;
        client.get().uri("/api/finanzas").exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/regla-diezmo").bodyValue(regla(true, 10, "BRUTO", false)).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/ingresos-fijos").bodyValue(salario(1, 1)).exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/ingresos-fijos/{id}", id).bodyValue(salario(1, 1)).exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/ingresos-fijos/{id}", id).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/ingresos-fijos/{id}/recibido", id).exchange().expectStatus().isUnauthorized();
        String p = java.util.UUID.randomUUID().toString();
        client.post().uri("/api/planes/{p}/escenarios/{e}/ingresos", p, p).bodyValue(Map.of("nombre", "x", "monto", 1)).exchange()
                .expectStatus().isUnauthorized();
        client.post().uri("/api/planes/{p}/escenarios/{e}/ingresos/{l}/recibido", p, p, p).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/cuentas").bodyValue(cuenta("Nu", "YO", 1)).exchange().expectStatus().isUnauthorized();
    }
}
