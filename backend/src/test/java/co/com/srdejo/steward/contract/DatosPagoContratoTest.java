package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.itemBody;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-plan-mes "Datos de pago de un gasto" y steward-plan-anual "Datos de pago en el mes base" (gastos-datos-pago).
 * El mes anterior se cierra; el mes en curso y los dos siguientes tienen Internet.
 */
class DatosPagoContratoTest extends ContratoBase {

    private static final String ENLACE = "https://pagos.ejemplo.com";
    private static final String RUTA_ITEM = "/api/planes/{p}/escenarios/{e}/items/{i}";

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String fijos;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        fijos = ayudas.categoria(daniel, "Gastos fijos");
    }

    @Test
    void aplicarALosMesesYaPlaneadosNoTocaLosCerrados() throws Exception {
        Map<?, ?> anterior = ayudas.crearPlan(daniel, MES.minusMonths(1), "CERO");
        ayudas.item(daniel, anterior, escenario(anterior), "Internet", 120_000, "FIJO", fijos, null, null);
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "COPIAR");
        sql("UPDATE plan_mes SET estado = 'CERRADO' WHERE id = '" + anterior.get("id") + "'");
        ayudas.crearPlan(daniel, MES.plusMonths(1), "COPIAR");
        ayudas.crearPlan(daniel, MES.plusMonths(2), "FIJOS");
        String esc = escenario(actual);
        String internet = idDe(actual, "Internet");

        Map<String, Object> cuerpo = conPago(itemBody(" internet ", 130_000, "FIJO", fijos, null, null), " " + ENLACE + " ", "123456");
        cuerpo.put("aplicarAMeses", true);
        put(daniel, RUTA_ITEM, cuerpo, actual.get("id"), esc, internet).expectStatus().isOk().expectBody()
                .jsonPath("$.enlacePago").isEqualTo(ENLACE)
                .jsonPath("$.codigoPago").isEqualTo("123456");

        assertEquals(List.of(pago(null, null), pago(ENLACE, "123456"), pago(ENLACE, "123456"), pago(ENLACE, "123456")),
                pagosDeInternet(esposa));
    }

    @Test
    void soloEsteMesSinLaCasilla() {
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        String internet = ayudas.item(daniel, actual, escenario(actual), "Internet", 120_000, "FIJO", fijos, null, null);
        ayudas.crearPlan(daniel, MES.plusMonths(1), "COPIAR");
        put(daniel, RUTA_ITEM, conPago(itemBody("Internet", 120_000, "FIJO", fijos, null, null), null, "987"),
                actual.get("id"), escenario(actual), internet).expectStatus().isOk();
        assertEquals(List.of(pago(null, "987"), pago(null, null)), pagosDeInternet(daniel));
    }

    @Test
    void sinIndicarSeConservanYVacioLosQuita() {
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        String esc = escenario(actual);
        String internet = valorDe(post(daniel, "/api/planes/{p}/escenarios/{e}/items",
                conPago(itemBody("Internet", 120_000, "FIJO", fijos, null, null), ENLACE, "123"), actual.get("id"), esc)
                .expectStatus().isCreated(), "id");
        // Una version anterior de la app no envia los campos: se conservan.
        put(daniel, RUTA_ITEM, itemBody("Internet", 130_000, "FIJO", fijos, null, null), actual.get("id"), esc, internet)
                .expectStatus().isOk().expectBody().jsonPath("$.enlacePago").isEqualTo(ENLACE).jsonPath("$.codigoPago").isEqualTo("123");
        put(daniel, RUTA_ITEM, conPago(itemBody("Internet", 130_000, "FIJO", fijos, null, null), "", ""), actual.get("id"), esc, internet)
                .expectStatus().isOk().expectBody().jsonPath("$.enlacePago").isEmpty().jsonPath("$.codigoPago").isEmpty();
    }

    @Test
    void enlaceInvalido() {
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        String esc = escenario(actual);
        for (String enlace : List.of("javascript:alert(1)", "pagos.ejemplo.com", "https://a b.com", "https://" + "a".repeat(500))) {
            post(daniel, "/api/planes/{p}/escenarios/{e}/items", conPago(itemBody("Agua", 1, "FIJO", fijos, null, null), enlace, null),
                    actual.get("id"), esc).expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        }
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", conPago(itemBody("Agua", 1, "FIJO", fijos, null, null), null, "x".repeat(61)),
                actual.get("id"), esc).expectStatus().isBadRequest();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios[0].items").isEmpty();
    }

    @Test
    void elMesBaseLosGuardaYLosMesesDelAnioLosTraen() {
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        valorDe(post(daniel, "/api/planes/{p}/escenarios/{e}/items",
                conPago(itemBody("Internet", 120_000, "FIJO", fijos, null, null), ENLACE, "123"), actual.get("id"), escenario(actual))
                .expectStatus().isCreated(), "id");
        int anio = MES.getYear() + 1;
        Map<?, ?> op = post(daniel, "/api/anuales/{anio}/opciones", Map.of("desde", Map.of("tipo", "MES", "anio", MES.getYear(), "mes", MES.getMonthValue())), anio)
                .expectStatus().isCreated().expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> base = (Map<?, ?>) ((List<?>) ((Map<?, ?>) op.get("mesBase")).get("items")).getFirst();
        assertEquals(pago(ENLACE, "123"), pago((String) base.get("enlacePago"), (String) base.get("codigoPago")));

        // Editar el gasto del mes base sin los campos los conserva; "" quita el codigo.
        put(daniel, "/api/anuales/{anio}/opciones/{op}/base/items/{id}", itemBody("Internet", 125_000, "FIJO", fijos, null, null),
                anio, op.get("id"), base.get("id")).expectStatus().isOk().expectBody().jsonPath("$.enlacePago").isEqualTo(ENLACE);
        put(daniel, "/api/anuales/{anio}/opciones/{op}/base/items/{id}", conPago(itemBody("Internet", 125_000, "FIJO", fijos, null, null), null, ""),
                anio, op.get("id"), base.get("id")).expectStatus().isOk().expectBody()
                .jsonPath("$.enlacePago").isEqualTo(ENLACE).jsonPath("$.codigoPago").isEmpty();

        post(daniel, "/api/anuales/{anio}/opciones/{op}/base/usar", Map.of(), anio, op.get("id")).expectStatus().isOk();
        post(daniel, "/api/anuales/{anio}/meses", Map.of("opcionId", op.get("id"), "actualizar", List.of()), anio).expectStatus().is2xxSuccessful();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[?(@.ref.anio == " + anio + " && @.ref.mes == 3)].escenarios[0].items[0].enlacePago").isEqualTo(List.of(ENLACE));
    }

    @Test
    void aplicarDesdeUnMesLlegaAlMesBaseDelAnio() {
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        String internet = ayudas.item(daniel, actual, escenario(actual), "Internet", 120_000, "FIJO", fijos, null, null);
        int anio = MES.getYear() + 1;
        Map<?, ?> op = post(daniel, "/api/anuales/{anio}/opciones", Map.of("desde", Map.of("tipo", "MES", "anio", MES.getYear(), "mes", MES.getMonthValue())), anio)
                .expectStatus().isCreated().expectBody(Map.class).returnResult().getResponseBody();
        Map<String, Object> cuerpo = conPago(itemBody("Internet", 120_000, "FIJO", fijos, null, null), null, "555");
        cuerpo.put("aplicarAMeses", true);
        put(daniel, RUTA_ITEM, cuerpo, actual.get("id"), escenario(actual), internet).expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.anuales[?(@.anio == " + anio + ")].opciones[0].mesBase.items[0].codigoPago").isEqualTo(List.of("555"));
    }

    // --- Ayudas ---

    private static Map<String, Object> conPago(Map<String, Object> cuerpo, String enlace, String codigo) {
        if (enlace != null) {
            cuerpo.put("enlacePago", enlace);
        }
        if (codigo != null) {
            cuerpo.put("codigoPago", codigo);
        }
        return cuerpo;
    }

    private static String idDe(Map<?, ?> plan, String nombre) {
        return ((List<?>) ((Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst()).get("items")).stream()
                .map(i -> (Map<?, ?>) i).filter(i -> nombre.equals(i.get("nombre"))).map(i -> (String) i.get("id")).findFirst().orElseThrow();
    }

    private static String pago(String enlace, String codigo) {
        return enlace + "|" + codigo;
    }

    /** Enlace y codigo de Internet en cada mes, del mas antiguo al mas nuevo. */
    private List<String> pagosDeInternet(String sesion) {
        Map<?, ?> f = get(sesion, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        return ((List<?>) f.get("planes")).stream().map(p -> (Map<?, ?>) p)
                .sorted(java.util.Comparator.comparing(p -> YearMonth.of((Integer) ((Map<?, ?>) p.get("ref")).get("anio"),
                        (Integer) ((Map<?, ?>) p.get("ref")).get("mes"))))
                .map(p -> (Map<?, ?>) ((List<?>) ((Map<?, ?>) ((List<?>) p.get("escenarios")).getFirst()).get("items")).stream()
                        .map(i -> (Map<?, ?>) i).filter(i -> "internet".equalsIgnoreCase(((String) i.get("nombre")).strip())).findFirst().orElseThrow())
                .map(i -> pago((String) i.get("enlacePago"), (String) i.get("codigoPago")))
                .toList();
    }
}
