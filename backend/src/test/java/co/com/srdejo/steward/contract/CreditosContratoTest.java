package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.itemBody;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-finanzas: "Créditos del hogar", "Abono y saldo de un crédito" y la cuota en "Marcar un pago"; spec
 * steward-plan-mes: las cuotas en "Crear el plan de un mes" e "Ítems de la opción" (backend-cuentas-creditos).
 */
class CreditosContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idDaniel;
    private String davivienda;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idDaniel = ayudas.idDe(daniel);
        davivienda = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated(), "id");
    }

    // --- Créditos del hogar ---

    @Test
    void agregarUnCreditoConElPlanActivo() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/planes/{id}/usar", Map.of("escenarioId", escenario(plan)), plan.get("id")).expectStatus().isOk();

        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated().expectBody()
                .jsonPath("$.nombre").isEqualTo("Libre inversión")
                .jsonPath("$.entidad").isEqualTo("Bancolombia")
                .jsonPath("$.saldo").isEqualTo(14_250_000)
                .jsonPath("$.tasaEM").isEqualTo(1.6)
                .jsonPath("$.saldoActualizadoEn").isEqualTo(hoy().toString())
                .jsonPath("$.pagos").isEmpty();
        String creditos = ayudas.categoria(daniel, "Créditos");
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.creditos[0].nombre").isEqualTo("Libre inversión")
                .jsonPath("$.planes[0].escenarios[0].items.length()").isEqualTo(1)
                .jsonPath("$.planes[0].escenarios[0].items[0].nombre").isEqualTo("Cuota libre inversión")
                .jsonPath("$.planes[0].escenarios[0].items[0].monto").isEqualTo(500_000)
                .jsonPath("$.planes[0].escenarios[0].items[0].diaVence").isEqualTo(15)
                .jsonPath("$.planes[0].escenarios[0].items[0].tipo").isEqualTo("CREDITO")
                .jsonPath("$.planes[0].escenarios[0].items[0].categoriaId").isEqualTo(creditos)
                .jsonPath("$.planes[0].escenarios[0].items[0].creditoId").isEqualTo(idCredito(esposa));
    }

    @Test
    void sinPlanEnElMes() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.creditos.length()").isEqualTo(1)
                .jsonPath("$.planes").isEmpty();
    }

    @Test
    void conElMesCerradoNoTocaElPlan() throws Exception {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        sql("UPDATE plan_mes SET estado = 'CERRADO' WHERE id = '" + plan.get("id") + "'");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios[0].items").isEmpty();
    }

    @Test
    void creditosInvalidos() {
        post(daniel, "/api/creditos", conCambio("totalOriginal", 10_000_000)).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        post(daniel, "/api/creditos", conCambio("cuota", 0)).expectStatus().isBadRequest();
        post(daniel, "/api/creditos", conCambio("tasaEM", 11)).expectStatus().isBadRequest();
        post(daniel, "/api/creditos", conCambio("tasaEM", 1.605)).expectStatus().isBadRequest();
        post(daniel, "/api/creditos", conCambio("nombre", " ")).expectStatus().isBadRequest();
        post(daniel, "/api/creditos", conCambio("diaPago", 32)).expectStatus().isBadRequest();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.creditos").isEmpty();
    }

    // --- Crear el plan de un mes, con creditos ---

    @Test
    void desdeCeroConUnCredito() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        ayudas.crearPlan(daniel, MES.plusMonths(1), "CERO");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[0].escenarios[0].items.length()").isEqualTo(1)
                .jsonPath("$.planes[0].escenarios[0].items[0].nombre").isEqualTo("Cuota libre inversión")
                .jsonPath("$.planes[0].escenarios[0].items[0].creditoId").isEqualTo(idCredito(daniel));
    }

    @Test
    void copiarSinDuplicarLaCuotaYSinLaDeUnCreditoPagado() {
        ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        ayudas.crearPlan(daniel, MES.plusMonths(1), "COPIAR");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[1].escenarios[0].items[?(@.creditoId)].nombre").isEqualTo(List.of("Cuota libre inversión"));

        put(daniel, "/api/creditos/{id}/saldo", Map.of("saldo", 0), idCredito(daniel)).expectStatus().isOk();
        ayudas.crearPlan(daniel, MES.plusMonths(2), "COPIAR");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[2].escenarios[0].items").isEmpty();
    }

    // --- Ítems de la opción, con creditos ---

    @Test
    void elItemConservaSuCreditoYNoAceptaUnoAjeno() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES.plusMonths(1), "CERO");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        Map<?, ?> nov = ayudas.crearPlan(daniel, MES.plusMonths(2), "CERO");
        String esc = escenario(nov);
        Map<?, ?> f = get(daniel, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> cuota = (Map<?, ?>) ((List<?>) ((Map<?, ?>) ((List<?>) ((Map<?, ?>) ((List<?>) f.get("planes")).get(1))
                .get("escenarios")).getFirst()).get("items")).getFirst();
        Map<String, Object> cambio = itemBody("Cuota libre inversión", 550_000, "CREDITO", (String) cuota.get("categoriaId"), null, null);
        put(daniel, "/api/planes/{p}/escenarios/{e}/items/{i}", cambio, nov.get("id"), esc, cuota.get("id")).expectStatus().isOk()
                .expectBody().jsonPath("$.creditoId").isEqualTo(idCredito(daniel)).jsonPath("$.monto").isEqualTo(550_000);

        Map<String, Object> ajeno = itemBody("Otro", 1, "CREDITO", (String) cuota.get("categoriaId"), null, null);
        ajeno.put("creditoId", UUID.randomUUID().toString());
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", ajeno, plan.get("id"), escenario(plan)).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("CREDITO_NO_ENCONTRADO");
    }

    // --- Marcar un pago: la cuota ---

    @Test
    void cuotaDeUnCredito() {
        ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        String item = itemCuota(daniel);
        post(esposa, "/api/pagos", PlanContratoTest.pago(item, 500_000, idDaniel, "NINGUNO")).expectStatus().isCreated()
                .expectBody().jsonPath("$.creditoId").isEqualTo(idCredito(daniel));
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.creditos[0].saldo").isEqualTo(13_978_000)
                .jsonPath("$.creditos[0].pagos[0].tipo").isEqualTo("CUOTA")
                .jsonPath("$.creditos[0].pagos[0].monto").isEqualTo(500_000);
        // Pagarla otra vez no baja el saldo.
        post(daniel, "/api/pagos", PlanContratoTest.pago(item, 500_000, idDaniel, "NINGUNO")).expectStatus().isEqualTo(409);
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.creditos[0].saldo").isEqualTo(13_978_000);
    }

    // --- Abono y saldo de un crédito ---

    @Test
    void abono() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        String credito = idCredito(daniel);
        post(esposa, "/api/creditos/{id}/abonos", abono(2_000_000, idDaniel, "CUENTA", davivienda), credito).expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.tipo").isEqualTo("ABONO_CREDITO")
                .jsonPath("$.creditoId").isEqualTo(credito)
                .jsonPath("$.cuentaId").isEqualTo(davivienda)
                .jsonPath("$.ref.mes").isEqualTo(MES.getMonthValue());
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.creditos[0].saldo").isEqualTo(12_250_000)
                .jsonPath("$.creditos[0].pagos[0].tipo").isEqualTo("ABONO")
                .jsonPath("$.creditos[0].pagos[0].monto").isEqualTo(2_000_000);
    }

    @Test
    void abonoMayorQueElSaldo() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        post(daniel, "/api/creditos/{id}/abonos", abono(15_000_000, idDaniel, "NINGUNO", null), idCredito(daniel))
                .expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("ABONO_MAYOR");
        post(daniel, "/api/creditos/{id}/abonos", abono(0, idDaniel, "NINGUNO", null), idCredito(daniel)).expectStatus().isBadRequest();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.creditos[0].saldo").isEqualTo(14_250_000)
                .jsonPath("$.movimientos").isEmpty();
    }

    @Test
    void dosAbonosALaVezNoDejanElSaldoNegativo() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        String credito = idCredito(daniel);
        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() -> estado(post(daniel, "/api/creditos/{id}/abonos",
                abono(10_000_000, idDaniel, "NINGUNO", null), credito)));
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() -> estado(post(esposa, "/api/creditos/{id}/abonos",
                abono(10_000_000, idDaniel, "NINGUNO", null), credito)));
        assertEquals(List.of(201, 400), Stream.of(a.join(), b.join()).sorted().toList());
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.creditos[0].saldo").isEqualTo(4_250_000)
                .jsonPath("$.movimientos.length()").isEqualTo(1);
    }

    @Test
    void actualizarSaldo() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        put(esposa, "/api/creditos/{id}/saldo", Map.of("saldo", 13_900_000), idCredito(daniel)).expectStatus().isOk()
                .expectBody()
                .jsonPath("$.saldo").isEqualTo(13_900_000)
                .jsonPath("$.saldoActualizadoEn").isEqualTo(hoy().toString());
        put(esposa, "/api/creditos/{id}/saldo", Map.of("saldo", -1), idCredito(daniel)).expectStatus().isBadRequest();
    }

    // --- Aislamiento ---

    @Test
    void creditoAjeno() {
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        String credito = idCredito(daniel);
        String otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
        String idOtro = ayudas.idDe(otro);
        post(otro, "/api/creditos/{id}/abonos", abono(1_000, idOtro, "NINGUNO", null), credito).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("CREDITO_NO_ENCONTRADO");
        put(otro, "/api/creditos/{id}/saldo", Map.of("saldo", 1), credito).expectStatus().isNotFound();
        post(otro, "/api/cuentas/cuadre", Map.of("saldos", List.of(Map.of("cuentaId", davivienda, "saldoBanco", 1))))
                .expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("CUENTA_NO_ENCONTRADA");
        get(otro, "/api/finanzas").expectBody().jsonPath("$.creditos").isEmpty();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.creditos[0].saldo").isEqualTo(14_250_000);
    }

    @Test
    void sinSesionTodoDa401() {
        client.post().uri("/api/cuentas/cuadre").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/transferencias").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/creditos").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/creditos/{id}/saldo", UUID.randomUUID()).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/creditos/{id}/abonos", UUID.randomUUID()).bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void losUltimosQueSalenNoDejanCreditos() throws Exception {
        ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        post(daniel, "/api/pagos", PlanContratoTest.pago(itemCuota(daniel), 500_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        post(daniel, "/api/creditos/{id}/abonos", abono(1_000, idDaniel, "NINGUNO", null), idCredito(daniel)).expectStatus().isCreated();
        delete(esposa, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        delete(daniel, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        for (String tabla : List.of("hogar", "credito", "item_plan", "movimiento")) {
            try (var c = java.sql.DriverManager.getConnection(DB_URL, "postgres", "postgres");
                 var r = c.createStatement().executeQuery("SELECT count(*) FROM " + tabla)) {
                r.next();
                assertEquals(0, r.getLong(1), tabla);
            }
        }
    }

    // --- Ayudas ---

    static Map<String, Object> libreInversion() {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", "Libre inversión");
        m.put("entidad", "Bancolombia");
        m.put("saldo", 14_250_000);
        m.put("totalOriginal", 20_000_000);
        m.put("cuota", 500_000);
        m.put("tasaEM", 1.6);
        m.put("diaPago", 15);
        return m;
    }

    private static Map<String, Object> conCambio(String campo, Object valor) {
        Map<String, Object> m = libreInversion();
        m.put(campo, valor);
        return m;
    }

    static Map<String, Object> abono(long monto, String usuario, String origen, String cuentaId) {
        Map<String, Object> m = new HashMap<>();
        m.put("monto", monto);
        m.put("usuarioId", usuario);
        m.put("origen", cuentaId == null ? Map.of("tipo", origen) : Map.of("tipo", origen, "cuentaId", cuentaId));
        return m;
    }

    private String idCredito(String sesion) {
        Map<?, ?> f = get(sesion, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        return (String) ((Map<?, ?>) ((List<?>) f.get("creditos")).getFirst()).get("id");
    }

    private String itemCuota(String sesion) {
        Map<?, ?> f = get(sesion, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> plan = (Map<?, ?>) ((List<?>) f.get("planes")).getFirst();
        Map<?, ?> esc = (Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst();
        return (String) ((Map<?, ?>) ((List<?>) esc.get("items")).getFirst()).get("id");
    }

    private static int estado(org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec r) {
        return r.returnResult(String.class).getStatus().value();
    }

    private static LocalDate hoy() {
        return LocalDate.now(ZoneId.of("America/Bogota"));
    }
}
