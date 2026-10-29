package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

import static co.com.srdejo.steward.contract.CreditosContratoTest.libreInversion;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.pago;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-plan-mes: "Duplicar una opción", "Quitar una opción", "Probar un abono como opción" y "Usar la opción y
 * estados del mes" con varias opciones (backend-opciones-mes). Noviembre (MES + 1) esta en Borrador; el mes en curso con
 * opcion elegida, Activo.
 */
class OpcionesContratoTest extends ContratoBase {

    private static final YearMonth SIGUIENTE = MES.plusMonths(1);

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idDaniel;
    private String idEsposa;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idDaniel = ayudas.idDe(daniel);
        idEsposa = ayudas.idDe(esposa);
    }

    // --- Duplicar una opción ---

    @Test
    void duplicarLaOpcionA() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        ayudas.item(daniel, plan, escenario(plan), "Compra a cuotas", 375_000, "CUOTA", ayudas.categoria(daniel, "Tarjetas y cuotas"), 4, 12);
        duplicar(esposa, plan, escenario(plan)).expectStatus().isCreated().expectBody()
                .jsonPath("$.escenarios.length()").isEqualTo(2)
                .jsonPath("$.escenarios[1].letra").isEqualTo("B")
                .jsonPath("$.escenarios[1].creadoPor").isEqualTo(idEsposa)
                .jsonPath("$.escenarios[1].items[?(@.nombre == 'Compra a cuotas')].cuota.actual").isEqualTo(List.of(4))
                .jsonPath("$.escenarios[1].items[?(@.nombre == 'Cuota libre inversión')].creditoId").isEqualTo(List.of(idCredito()));
    }

    @Test
    void mesActivo() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        usar(daniel, plan, escenario(plan)).expectStatus().isOk();
        duplicar(daniel, plan, escenario(plan)).expectStatus().isEqualTo(409).expectBody()
                .jsonPath("$.codigo").isEqualTo("MES_NO_BORRADOR")
                .jsonPath("$.mensaje").isEqualTo(capital(MES) + " ya está en curso; su plan no gana opciones");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios.length()").isEqualTo(1);
    }

    @Test
    void dosDuplicadosALaVezDejanBYC() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() -> estado(duplicar(daniel, plan, escenario(plan))));
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() -> estado(duplicar(esposa, plan, escenario(plan))));
        assertEquals(List.of(201, 201), Stream.of(a.join(), b.join()).toList());
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios[*].letra").isEqualTo(List.of("A", "B", "C"));
    }

    // --- Quitar una opción ---

    @Test
    void quitarLaOpcionCYVolverACrearla() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        duplicar(daniel, plan, escenario(plan)).expectStatus().isCreated();
        String c = idLetra(duplicar(daniel, plan, escenario(plan)).expectStatus().isCreated(), "C");
        delete(esposa, "/api/planes/{p}/escenarios/{e}", plan.get("id"), c).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios[*].letra").isEqualTo(List.of("A", "B"));
        duplicar(esposa, plan, escenario(plan)).expectStatus().isCreated().expectBody()
                .jsonPath("$.escenarios[*].letra").isEqualTo(List.of("A", "B", "C"));
    }

    @Test
    void laUltimaYLaEnUsoNoSeQuitan() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        delete(daniel, "/api/planes/{p}/escenarios/{e}", plan.get("id"), escenario(plan)).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("ULTIMA_OPCION");
        String b = idLetra(duplicar(daniel, plan, escenario(plan)).expectStatus().isCreated(), "B");
        usar(daniel, plan, b).expectStatus().isOk();
        delete(daniel, "/api/planes/{p}/escenarios/{e}", plan.get("id"), b).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("OPCION_EN_USO");
    }

    @Test
    void conPagosOMesActivoNoSeQuita() {
        // El mes en curso sin opcion elegida sigue en Borrador, y ya se puede pagar su principal.
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        String luz = ayudas.item(daniel, plan, escenario(plan), "Recibo Luz", 50_000, "FIJO", ayudas.categoria(daniel, "Gastos fijos"), null, null);
        post(daniel, "/api/pagos", pago(luz, 50_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        String b = idLetra(duplicar(daniel, plan, escenario(plan)).expectStatus().isCreated(), "B");
        delete(daniel, "/api/planes/{p}/escenarios/{e}", plan.get("id"), escenario(plan)).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("OPCION_CON_PAGOS");
        // Usar la A (la de los pagos) deja el mes Activo: la B ya no se quita.
        usar(daniel, plan, escenario(plan)).expectStatus().isOk();
        delete(daniel, "/api/planes/{p}/escenarios/{e}", plan.get("id"), b).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("MES_NO_BORRADOR");
    }

    // --- Probar un abono como opción ---

    @Test
    void probarloComoOpcionDeNoviembre() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        Map<?, ?> r = probar(esposa, idCredito(), SIGUIENTE, 2_000_000).expectStatus().isCreated()
                .expectBody(Map.class).returnResult().getResponseBody();
        assertEquals(plan.get("id"), r.get("planId"));
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[0].escenarios[1].id").isEqualTo(r.get("escenarioId"))
                .jsonPath("$.planes[0].escenarios[1].letra").isEqualTo("B")
                .jsonPath("$.planes[0].escenarios[1].nota").isEqualTo("abono a crédito")
                .jsonPath("$.planes[0].escenarios[1].creadoPor").isEqualTo(idEsposa)
                .jsonPath("$.planes[0].escenarios[1].items[?(@.nombre == 'Abono extra libre inversión')].monto").isEqualTo(List.of(2_000_000))
                .jsonPath("$.planes[0].escenarios[1].items[?(@.nombre == 'Abono extra libre inversión')].creditoId").isEqualTo(List.of(idCredito()))
                .jsonPath("$.planes[0].escenarios[1].items[?(@.nombre == 'Abono extra libre inversión')].tipo").isEqualTo(List.of("CREDITO"));
    }

    @Test
    void unMesSinPlanSeCreaCopiandoElAnterior() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        probar(daniel, idCredito(), SIGUIENTE.plusMonths(1), 1_000_000).expectStatus().isCreated();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[1].estado").isEqualTo("BORRADOR")
                .jsonPath("$.planes[1].escenarios[*].letra").isEqualTo(List.of("A", "B"))
                .jsonPath("$.planes[1].escenarios[0].items[*].nombre").isEqualTo(List.of("Cuota libre inversión"));
    }

    @Test
    void abonosInvalidos() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        usar(daniel, actual, escenario(actual)).expectStatus().isOk();
        probar(daniel, idCredito(), MES, 1_000).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("MES_NO_BORRADOR");
        probar(daniel, idCredito(), SIGUIENTE, 0).expectStatus().isBadRequest();
        probar(daniel, UUID.randomUUID().toString(), SIGUIENTE, 1_000).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("CREDITO_NO_ENCONTRADO");
    }

    // --- Usar la opción ---

    @Test
    void usarOtraOpcionArchivaLasDemas() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        String b = idLetra(duplicar(daniel, plan, escenario(plan)).expectStatus().isCreated(), "B");
        duplicar(esposa, plan, escenario(plan)).expectStatus().isCreated();
        usar(esposa, plan, b).expectStatus().isOk().expectBody()
                .jsonPath("$.escenarioActivoId").isEqualTo(b)
                .jsonPath("$.escenarios[?(@.archivado == true)].letra").isEqualTo(List.of("A", "C"));
    }

    @Test
    void cambiarDeOpcionEnUnMesActivoOConPagos() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        String luz = ayudas.item(daniel, plan, escenario(plan), "Recibo Luz", 50_000, "FIJO", ayudas.categoria(daniel, "Gastos fijos"), null, null);
        String b = idLetra(duplicar(daniel, plan, escenario(plan)).expectStatus().isCreated(), "B");
        post(daniel, "/api/pagos", pago(luz, 50_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        // Borrador sin opcion elegida, pero la principal (A) ya tiene un pago.
        usar(daniel, plan, b).expectStatus().isEqualTo(409).expectBody()
                .jsonPath("$.codigo").isEqualTo("MES_NO_BORRADOR")
                .jsonPath("$.mensaje").isEqualTo(capital(MES) + " ya tiene pagos en la Opción A; no cambia de opción");
        usar(daniel, plan, escenario(plan)).expectStatus().isOk();
        // Activo: volver a elegir la A no cambia nada; elegir la B, no.
        usar(esposa, plan, escenario(plan)).expectStatus().isOk().expectBody().jsonPath("$.estado").isEqualTo("ACTIVO");
        usar(esposa, plan, b).expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("MES_NO_BORRADOR");
    }

    // --- Aislamiento ---

    @Test
    void opcionesAjenasYSinSesion() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        String otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
        duplicar(otro, plan, escenario(plan)).expectStatus().isNotFound();
        delete(otro, "/api/planes/{p}/escenarios/{e}", plan.get("id"), escenario(plan)).expectStatus().isNotFound();
        probar(otro, idCredito(), SIGUIENTE, 1_000).expectStatus().isNotFound();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios.length()").isEqualTo(1);

        client.post().uri("/api/planes/{p}/escenarios", plan.get("id")).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/planes/{p}/escenarios/{e}", plan.get("id"), escenario(plan)).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/creditos/{id}/probar", idCredito()).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
    }

    // --- Ayudas ---

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec duplicar(String sesion, Map<?, ?> plan, String desde) {
        Map<String, Object> m = new HashMap<>();
        m.put("desde", desde);
        return post(sesion, "/api/planes/{id}/escenarios", m, plan.get("id"));
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec usar(String sesion, Map<?, ?> plan, String escenarioId) {
        return post(sesion, "/api/planes/{id}/usar", Map.of("escenarioId", escenarioId), plan.get("id"));
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec probar(String sesion, String credito, YearMonth mes, long abono) {
        return post(sesion, "/api/creditos/{id}/probar", Map.of("anio", mes.getYear(), "mes", mes.getMonthValue(), "abono", abono), credito);
    }

    private static String idLetra(org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec r, String letra) {
        Map<?, ?> plan = r.expectBody(Map.class).returnResult().getResponseBody();
        return ((List<?>) plan.get("escenarios")).stream().map(e -> (Map<?, ?>) e).filter(e -> letra.equals(e.get("letra")))
                .map(e -> (String) e.get("id")).findFirst().orElseThrow();
    }

    private String idCredito() {
        Map<?, ?> f = get(daniel, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        return (String) ((Map<?, ?>) ((List<?>) f.get("creditos")).getFirst()).get("id");
    }

    private static int estado(org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec r) {
        return r.returnResult(String.class).getStatus().value();
    }

    private static String capital(YearMonth mes) {
        String n = List.of("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
                "noviembre", "diciembre").get(mes.getMonthValue() - 1);
        return Character.toUpperCase(n.charAt(0)) + n.substring(1);
    }
}
