package co.com.srdejo.steward.contract;

import co.com.srdejo.steward.domain.usecase.Formato;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.regla;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.gasto;
import static co.com.srdejo.steward.contract.PlanContratoTest.pago;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-finanzas: "Marcar un pago", "Registrar un gasto", "Registrar un aporte", las obligaciones de los aportes
 * y "Finanzas del hogar en una lectura", con el plan del mes en curso del backend.
 */
class RegistrosContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idDaniel;
    private String idEsposa;
    private String mastercard;
    private String luz;
    private String mercado;

    @BeforeEach
    void planDelMes() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idDaniel = ayudas.idDe(daniel);
        idEsposa = ayudas.idDe(esposa);
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        String esc = escenario(plan);
        mastercard = ayudas.item(daniel, plan, esc, "Tarjeta Mastercard", 1_500_000, "FIJO", ayudas.categoria(daniel, "Tarjetas y cuotas"), null, null);
        luz = ayudas.item(daniel, plan, esc, "Recibo Luz", 50_000, "FIJO", ayudas.categoria(daniel, "Gastos fijos"), null, null);
        mercado = ayudas.item(daniel, plan, esc, "Mercado", 320_000, "VARIABLE", ayudas.categoria(daniel, "Variables"), null, null);
    }

    // --- Marcar un pago ---

    @Test
    void pagoDirecto() {
        post(esposa, "/api/pagos", pago(mastercard, 1_500_000, idEsposa, "EXTERNA")).expectStatus().isCreated().expectBody()
                .jsonPath("$.tipo").isEqualTo("PAGO")
                .jsonPath("$.monto").isEqualTo(1_500_000)
                .jsonPath("$.usuarioId").isEqualTo(idEsposa)
                .jsonPath("$.origen").isEqualTo("EXTERNA")
                .jsonPath("$.itemId").isEqualTo(mastercard);
    }

    @Test
    void pagoDuplicado() {
        post(esposa, "/api/pagos", pago(luz, 38_000, idEsposa, "NINGUNO")).expectStatus().isCreated();
        post(daniel, "/api/pagos", pago(luz, 50_000, idDaniel, "NINGUNO")).expectStatus().isEqualTo(409).expectBody()
                .jsonPath("$.codigo").isEqualTo("YA_PAGADO")
                .jsonPath("$.mensaje").isEqualTo("Ya lo pagó Esposa el " + Formato.fechaCorta(hoy()));
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos[?(@.itemId == '" + luz + "')].monto").isEqualTo(38_000);
    }

    @Test
    void dosPagosALaVezDejanUnoSolo() {
        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() -> estado(post(daniel, "/api/pagos", pago(luz, 50_000, idDaniel, "NINGUNO"))));
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() -> estado(post(esposa, "/api/pagos", pago(luz, 50_000, idEsposa, "NINGUNO"))));
        assertEquals(List.of(201, 409), java.util.stream.Stream.of(a.join(), b.join()).sorted().toList());
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(1);
    }

    @Test
    void variableAcumulaComoGasto() {
        post(daniel, "/api/pagos", pago(mercado, 180_000, idDaniel, "NINGUNO")).expectStatus().isCreated()
                .expectBody().jsonPath("$.tipo").isEqualTo("GASTO");
        post(esposa, "/api/pagos", pago(mercado, 40_000, idEsposa, "NINGUNO")).expectStatus().isCreated();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos[?(@.itemId == '" + mercado + "')].monto").isEqualTo(List.of(180_000, 40_000));
    }

    @Test
    void pagoInvalido() {
        post(daniel, "/api/pagos", pago(luz, 0, idDaniel, "NINGUNO")).expectStatus().isBadRequest();
        post(daniel, "/api/pagos", pago(luz, 1, idDaniel, "OTRO")).expectStatus().isBadRequest();
        post(daniel, "/api/pagos", pago(luz, 1, idDaniel, "CUENTA")).expectStatus().isBadRequest();
        post(daniel, "/api/pagos", pago(java.util.UUID.randomUUID().toString(), 1, idDaniel, "NINGUNO")).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("ITEM_NO_ENCONTRADO");
    }

    // --- Registrar un gasto ---

    @Test
    void noEstabaPlaneado() {
        post(daniel, "/api/gastos", gasto(null, 85_000, " Farmacia ", idDaniel)).expectStatus().isCreated().expectBody()
                .jsonPath("$.tipo").isEqualTo("GASTO")
                .jsonPath("$.itemId").doesNotExist()
                .jsonPath("$.nota").isEqualTo("Farmacia");
        post(daniel, "/api/gastos", gasto(mercado, 40_000, "", idDaniel)).expectStatus().isCreated()
                .expectBody().jsonPath("$.itemId").isEqualTo(mercado);
        post(daniel, "/api/gastos", gasto(null, 1, "x".repeat(121), idDaniel)).expectStatus().isBadRequest();
    }

    // --- Registrar un aporte ---

    @Test
    void aporteParaElMesSiguienteYNoParaOtro() {
        post(daniel, "/api/aportes", aporte(idEsposa, 500_000, MES.plusMonths(1), false)).expectStatus().isCreated().expectBody()
                .jsonPath("$.tipo").isEqualTo("APORTE")
                .jsonPath("$.ref.mes").isEqualTo(MES.plusMonths(1).getMonthValue());
        post(daniel, "/api/aportes", aporte(idEsposa, 500_000, MES.plusMonths(2), false)).expectStatus().isBadRequest();
        post(daniel, "/api/aportes", aporte(idEsposa, 500_000, MES.minusMonths(1), false)).expectStatus().isBadRequest();
    }

    @Test
    void aporteConDiezmoYAgrupado() {
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", true)).expectStatus().isOk();
        post(daniel, "/api/aportes", aporte(idDaniel, 2_000_000, MES, true)).expectStatus().isCreated();
        get(esposa, "/api/diezmo/pendientes").expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].monto").isEqualTo(200_000)
                .jsonPath("$[0].detalle").isEqualTo("10% del aporte · " + Formato.fechaCorta(hoy()));

        String salarioId = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated();
        List<?> pendientes = get(daniel, "/api/diezmo/pendientes").expectBody(List.class).returnResult().getResponseBody();
        List<String> ids = pendientes.stream().map(o -> (String) ((Map<?, ?>) o).get("id")).toList();
        post(daniel, "/api/diezmo/entregas", Map.of("obligaciones", ids)).expectStatus().isCreated()
                .expectBody().jsonPath("$.monto").isEqualTo(900_000);
    }

    // --- Finanzas del hogar en una lectura ---

    @Test
    void elPlanYLoPagado() throws Exception {
        post(daniel, "/api/pagos", pago(luz, 38_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        // Un gasto de hace tres meses queda fuera de la lectura.
        sql("INSERT INTO movimiento (id, hogar_id, tipo, ref_anio, ref_mes, monto, fecha, usuario_id, creado_por) "
                + "SELECT gen_random_uuid(), h.id, 'GASTO', " + MES.minusMonths(3).getYear() + ", " + MES.minusMonths(3).getMonthValue()
                + ", 1, now()::date, m.usuario_id, m.usuario_id FROM hogar h JOIN miembro m ON m.hogar_id = h.id LIMIT 1");
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.planes.length()").isEqualTo(1)
                .jsonPath("$.planes[0].ref.mes").isEqualTo(MES.getMonthValue())
                .jsonPath("$.planes[0].escenarios[0].letra").isEqualTo("A")
                .jsonPath("$.planes[0].escenarios[0].items.length()").isEqualTo(3)
                .jsonPath("$.movimientos.length()").isEqualTo(1)
                .jsonPath("$.movimientos[0].itemId").isEqualTo(luz)
                .jsonPath("$.movimientos[0].usuarioId").isEqualTo(idDaniel);
    }

    // --- Salir del hogar con plan y registros ---

    @Test
    void losUltimosQueSalenNoDejanNadaAunqueHayaPlanYPagos() throws Exception {
        post(esposa, "/api/pagos", pago(luz, 38_000, idEsposa, "NINGUNO")).expectStatus().isCreated();
        post(daniel, "/api/gastos", gasto(mercado, 40_000, "", idDaniel)).expectStatus().isCreated();
        delete(esposa, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        delete(daniel, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        for (String tabla : List.of("hogar", "categoria", "plan_mes", "item_plan", "movimiento")) {
            try (var c = java.sql.DriverManager.getConnection(DB_URL, "postgres", "postgres");
                 var r = c.createStatement().executeQuery("SELECT count(*) FROM " + tabla)) {
                r.next();
                assertEquals(0, r.getLong(1), tabla);
            }
        }
    }

    private static Map<String, Object> aporte(String usuario, long monto, java.time.YearMonth mes, boolean diezmo) {
        Map<String, Object> m = new HashMap<>();
        m.put("usuarioId", usuario);
        m.put("monto", monto);
        m.put("mes", Map.of("anio", mes.getYear(), "mes", mes.getMonthValue()));
        m.put("aplicaDiezmo", diezmo);
        return m;
    }

    private static int estado(org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec r) {
        return r.returnResult(String.class).getStatus().value();
    }

    private static LocalDate hoy() {
        return LocalDate.now(ZoneId.of("America/Bogota"));
    }
}
