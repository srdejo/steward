package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.itemBody;
import static co.com.srdejo.steward.contract.PlanContratoTest.pago;

/** Spec steward-plan-mes y steward-finanzas: aislamiento del plan y de los registros de Hoy entre dos hogares. */
class PlanAislamientoContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String otro;
    private Map<?, ?> plan;
    private String esc;
    private String internet;
    private String fijosDaniel;

    @BeforeEach
    void dosHogares() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        plan = ayudas.crearPlan(daniel, MES, "CERO");
        esc = escenario(plan);
        fijosDaniel = ayudas.categoria(daniel, "Gastos fijos");
        internet = ayudas.item(daniel, plan, esc, "Internet", 120_000, "FIJO", fijosDaniel, null, null);

        otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
    }

    @Test
    void planDeOtroHogar() {
        String fijosOtro = ayudas.categoria(otro, "Gastos fijos");
        post(otro, "/api/planes/{p}/escenarios/{e}/items", itemBody("Intruso", 1, "FIJO", fijosOtro, null, null), plan.get("id"), esc)
                .expectStatus().isNotFound();
        put(otro, "/api/planes/{p}/escenarios/{e}/items/{i}", itemBody("Intruso", 1, "FIJO", fijosOtro, null, null),
                plan.get("id"), esc, internet).expectStatus().isNotFound();
        delete(otro, "/api/planes/{p}/escenarios/{e}/items/{i}", plan.get("id"), esc, internet).expectStatus().isNotFound();
        post(otro, "/api/planes/{id}/usar", Map.of("escenarioId", esc), plan.get("id")).expectStatus().isNotFound();
        client.patch().uri("/api/categorias/{id}", fijosDaniel).header("Authorization", "Bearer " + otro)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON).bodyValue(Map.of("nombre", "Mia"))
                .exchange().expectStatus().isNotFound();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[0].escenarios[0].items.length()").isEqualTo(1)
                .jsonPath("$.planes[0].escenarioActivoId").doesNotExist()
                .jsonPath("$.categorias[0].nombre").isEqualTo("Gastos fijos");
        get(otro, "/api/finanzas").expectBody().jsonPath("$.planes.length()").isEqualTo(0);
    }

    @Test
    void unaCategoriaAjenaNoSirveEnMiPlan() {
        Map<?, ?> suyo = ayudas.crearPlan(otro, MES, "CERO");
        post(otro, "/api/planes/{p}/escenarios/{e}/items", itemBody("Luz", 1, "FIJO", fijosDaniel, null, null), suyo.get("id"), escenario(suyo))
                .expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("CATEGORIA_NO_ENCONTRADA");
    }

    @Test
    void registrosConIdsAjenos() {
        String yo = ayudas.idDe(otro);
        post(otro, "/api/pagos", pago(internet, 1, yo, "NINGUNO")).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("ITEM_NO_ENCONTRADO");
        // A nombre de alguien de otro hogar.
        ayudas.crearPlan(otro, MES, "CERO");
        post(otro, "/api/aportes", Map.of("usuarioId", ayudas.idDe(daniel), "monto", 1, "mes", Map.of("anio", MES.getYear(), "mes", MES.getMonthValue()),
                "aplicaDiezmo", false)).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("MIEMBRO_NO_ENCONTRADO");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(0);
    }

    @Test
    void sinSesionTodoDa401() {
        client.post().uri("/api/categorias").bodyValue(Map.of("nombre", "x")).exchange().expectStatus().isUnauthorized();
        client.patch().uri("/api/categorias/{id}", fijosDaniel).bodyValue(Map.of("nombre", "x")).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/planes").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/planes/{id}/usar", plan.get("id")).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/planes/{p}/escenarios/{e}/items", plan.get("id"), esc).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/planes/{p}/escenarios/{e}/items/{i}", plan.get("id"), esc, internet).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/planes/{p}/escenarios/{e}/items/{i}", plan.get("id"), esc, internet).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/pagos").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/gastos").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/aportes").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
    }
}
