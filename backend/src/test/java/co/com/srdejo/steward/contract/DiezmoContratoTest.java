package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.regla;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.pago;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-plan-mes "Items de diezmo" e "Ingresos de la opcion", y steward-finanzas "Recibir un ingreso fijo" y
 * "Registrar un aporte" (diezmo-como-gasto), con las cifras del dominio compartido. El mes y la fecha son los de hoy en el
 * backend (America/Bogota).
 */
class DiezmoContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String salarioId;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        salarioId = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");
    }

    // --- Items de diezmo ---

    @Test
    void diezmoDelSalarioAlCrearElMes() {
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        Map<?, ?> diezmo = diezmos(plan).getFirst();
        assertEquals("Diezmo · Salario Daniel", diezmo.get("nombre"));
        assertEquals(700_000, ((Number) diezmo.get("monto")).longValue());
        assertEquals(salarioId, diezmo.get("ingresoFijoId"));
        assertEquals(ayudas.categoria(daniel, "Diezmo"), diezmo.get("categoriaId"));
        assertEquals(1, diezmos(plan).size());
    }

    @Test
    void unDiezmoPorCadaIngreso() {
        put(esposa, "/api/regla-diezmo", regla(true, 10, "NETO", false)).expectStatus().isOk();
        post(esposa, "/api/ingresos-fijos", ingreso("Salario Esposa", 3_500_000, 3_000_000)).expectStatus().isCreated();
        assertEquals(List.of("Diezmo · Salario Daniel:700000", "Diezmo · Salario Esposa:300000"),
                diezmos(crearPlan(daniel, MES, "COPIAR")).stream().map(i -> i.get("nombre") + ":" + i.get("monto")).sorted().toList());
    }

    @Test
    void sinReglaSinItem() {
        post(esposa, "/api/ingresos-fijos", ingreso("Salario Esposa", 3_000_000, 3_000_000)).expectStatus().isCreated();
        assertEquals(List.of("Diezmo · Salario Daniel"), diezmos(crearPlan(daniel, MES, "CERO")).stream().map(i -> i.get("nombre")).toList());
    }

    @Test
    void noSeCopiaElEditadoYEditarConservaElEnlace() {
        Map<?, ?> octubre = crearPlan(daniel, MES, "CERO");
        Map<?, ?> diezmo = diezmos(octubre).getFirst();
        Map<String, Object> editado = PlanContratoTest.itemBody("Diezmo · Salario Daniel", 750_000, "DIEZMO", (String) diezmo.get("categoriaId"), null, null);
        put(esposa, "/api/planes/{p}/escenarios/{e}/items/{i}", editado, octubre.get("id"), escenario(octubre), diezmo.get("id"))
                .expectStatus().isOk().expectBody()
                .jsonPath("$.monto").isEqualTo(750_000)
                .jsonPath("$.ingresoFijoId").isEqualTo(salarioId);
        List<Map<?, ?>> siguiente = diezmos(crearPlan(daniel, MES.plusMonths(1), "COPIAR"));
        assertEquals(1, siguiente.size());
        assertEquals(700_000, ((Number) siguiente.getFirst().get("monto")).longValue());
    }

    @Test
    void aporteConDiezmoEnUnMesConPlan() {
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", true)).expectStatus().isOk();
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        String aporte = valorDe(post(daniel, "/api/aportes", aporte(ayudas.idDe(daniel), 2_000_000, MES, true)).expectStatus().isCreated(), "id");
        Map<?, ?> item = diezmos(planDe(esposa, MES)).stream().filter(i -> aporte.equals(i.get("aporteId"))).findFirst().orElseThrow();
        assertEquals("Diezmo · aporte " + fechaCorta(hoy()), item.get("nombre"));
        assertEquals(200_000, ((Number) item.get("monto")).longValue());
        assertEquals(plan.get("id"), planDe(esposa, MES).get("id"));
    }

    @Test
    void aporteParaUnMesSinPlan() {
        YearMonth siguiente = MES.plusMonths(1);
        String aporte = valorDe(post(esposa, "/api/aportes", aporte(ayudas.idDe(esposa), 1_000_000, siguiente, true)).expectStatus().isCreated(), "id");
        // Esposa no tiene regla: 10 %.
        Map<?, ?> item = diezmos(crearPlan(daniel, siguiente, "CERO")).stream().filter(i -> aporte.equals(i.get("aporteId")))
                .findFirst().orElseThrow();
        assertEquals(100_000, ((Number) item.get("monto")).longValue());
    }

    @Test
    void marcarElDiezmoPagado() {
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        String diezmo = (String) diezmos(plan).getFirst().get("id");
        post(daniel, "/api/pagos", pago(diezmo, 700_000, ayudas.idDe(daniel), "NINGUNO")).expectStatus().isCreated()
                .expectBody().jsonPath("$.tipo").isEqualTo("PAGO").jsonPath("$.itemId").isEqualTo(diezmo);
        post(daniel, "/api/pagos", pago(diezmo, 700_000, ayudas.idDe(daniel), "NINGUNO")).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_PAGADO");
    }

    @Test
    void sinLosEndpointsDelDiezmoAutomatico() {
        get(daniel, "/api/diezmo/pendientes").expectStatus().isNotFound();
        post(daniel, "/api/diezmo/entregas", Map.of("obligaciones", List.of())).expectStatus().isNotFound();
        put(daniel, "/api/hogar/diezmo-en-hoy", Map.of("modo", "AGRUPADO")).expectStatus().isNotFound();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.diezmoEnHoy").doesNotExist();
    }

    // --- Recibir ---

    @Test
    void salarioRecibidoSinPlan() {
        // Lo marca cualquier miembro; el dueno sigue siendo Daniel, y no genera obligacion.
        post(esposa, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.tipo").isEqualTo("INGRESO_FIJO")
                .jsonPath("$.monto").isEqualTo(6_288_000)
                .jsonPath("$.bruto").isEqualTo(7_000_000)
                .jsonPath("$.fecha").isEqualTo(hoy().toString())
                .jsonPath("$.aplicaDiezmo").isEqualTo(false);
    }

    @Test
    void recibidoDosVecesYConOtroMonto() {
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of("monto", 6_350_000), salarioId).expectStatus().isCreated()
                .expectBody().jsonPath("$.monto").isEqualTo(6_350_000);
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_RECIBIDO");
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of("monto", 0), salarioId).expectStatus().isBadRequest();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(1);
    }

    @Test
    void ingresoQuitadoNoSeRecibe() {
        delete(daniel, "/api/ingresos-fijos/{id}", salarioId).expectStatus().isNoContent();
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("INGRESO_NO_ENCONTRADO");
    }

    // --- Ingresos de la opcion ---

    @Test
    void lasLineasNacenConElMesYSeEditan() {
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        Map<?, ?> linea = lineas(plan).getFirst();
        assertEquals("Salario Daniel", linea.get("nombre"));
        assertEquals(6_288_000, ((Number) linea.get("monto")).longValue());
        assertEquals("FIJO", linea.get("tipo"));
        assertEquals(salarioId, linea.get("ingresoFijoId"));

        put(esposa, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", lineaBody("Salario Daniel", 7_000_000), plan.get("id"), escenario(plan), linea.get("id"))
                .expectStatus().isOk().expectBody()
                .jsonPath("$.monto").isEqualTo(7_000_000)
                .jsonPath("$.tipo").isEqualTo("FIJO")
                .jsonPath("$.ingresoFijoId").isEqualTo(salarioId);
        post(esposa, "/api/planes/{p}/escenarios/{e}/ingresos", lineaBody("Venta bicicleta", 400_000), plan.get("id"), escenario(plan))
                .expectStatus().isCreated().expectBody().jsonPath("$.tipo").isEqualTo("OTRO");
        // Ajustes no cambia.
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.ingresosFijos[0].neto").isEqualTo(6_288_000);
        assertEquals(List.of("Salario Daniel:7000000", "Venta bicicleta:400000"),
                lineas(planDe(daniel, MES)).stream().map(l -> l.get("nombre") + ":" + l.get("monto")).toList());
        post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos", lineaBody(" ", 1), plan.get("id"), escenario(plan)).expectStatus().isBadRequest();
        post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos", lineaBody("Otro", -1), plan.get("id"), escenario(plan)).expectStatus().isBadRequest();
    }

    @Test
    void copiarTraeLasAgregadasAManoYDuplicarTodas() {
        Map<?, ?> plan = crearPlan(daniel, MES.plusMonths(1), "CERO");
        String salario = (String) lineas(plan).getFirst().get("id");
        put(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", lineaBody("Salario Daniel", 6_500_000), plan.get("id"), escenario(plan), salario)
                .expectStatus().isOk();
        post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos", lineaBody("Venta bicicleta", 400_000), plan.get("id"), escenario(plan))
                .expectStatus().isCreated();
        Map<?, ?> conB = post(esposa, "/api/planes/{p}/escenarios", Map.of("desde", escenario(plan)), plan.get("id")).expectStatus().isCreated()
                .expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> b = (Map<?, ?>) ((List<?>) conB.get("escenarios")).get(1);
        assertEquals(List.of("Salario Daniel:6500000", "Venta bicicleta:400000"),
                ((List<?>) b.get("ingresos")).stream().map(l -> ((Map<?, ?>) l).get("nombre") + ":" + ((Map<?, ?>) l).get("monto")).toList());

        assertEquals(List.of("Salario Daniel:6288000", "Venta bicicleta:400000"),
                lineas(crearPlan(daniel, MES.plusMonths(2), "COPIAR")).stream().map(l -> l.get("nombre") + ":" + l.get("monto")).toList());
    }

    @Test
    void recibirUnaLineaConOtroMontoYNoQuitarla() {
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        String esc = escenario(plan);
        String venta = valorDe(post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos", lineaBody("Venta bicicleta", 400_000), plan.get("id"), esc)
                .expectStatus().isCreated(), "id");
        String salario = (String) lineas(plan).getFirst().get("id");

        post(esposa, "/api/planes/{p}/escenarios/{e}/ingresos/{l}/recibido", Map.of("monto", 6_350_000), plan.get("id"), esc, salario)
                .expectStatus().isCreated().expectBody()
                .jsonPath("$.monto").isEqualTo(6_350_000)
                .jsonPath("$.ingresoPlanId").isEqualTo(salario)
                .jsonPath("$.ingresoFijoId").isEqualTo(salarioId)
                .jsonPath("$.bruto").isEqualTo(7_000_000);
        post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}/recibido", Map.of(), plan.get("id"), esc, venta)
                .expectStatus().isCreated().expectBody()
                .jsonPath("$.monto").isEqualTo(400_000)
                .jsonPath("$.ingresoPlanId").isEqualTo(venta)
                .jsonPath("$.ingresoFijoId").isEmpty();
        post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}/recibido", Map.of(), plan.get("id"), esc, venta)
                .expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("YA_RECIBIDO");
        // El ingreso fijo de una linea ya recibida tampoco se recibe aparte.
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isEqualTo(409);
        delete(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", plan.get("id"), esc, salario).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("INGRESO_RECIBIDO");
        // La linea del plan sigue con su monto planeado.
        assertEquals(6_288_000, ((Number) lineas(planDe(daniel, MES)).getFirst().get("monto")).longValue());
    }

    @Test
    void unIngresoFijoNuevoEntraAlMesEnCurso() {
        crearPlan(daniel, MES, "CERO");
        crearPlan(daniel, MES.plusMonths(1), "CERO");
        String prima = valorDe(post(daniel, "/api/ingresos-fijos", ingreso("Prima", 1_000_000, 1_000_000)).expectStatus().isCreated(), "id");
        Map<?, ?> actual = planDe(esposa, MES);
        assertEquals(List.of("Salario Daniel:6288000", "Prima:1000000"), lineas(actual).stream().map(l -> l.get("nombre") + ":" + l.get("monto")).toList());
        Map<?, ?> diezmo = diezmos(actual).stream().filter(i -> prima.equals(i.get("ingresoFijoId"))).findFirst().orElseThrow();
        assertEquals(100_000, ((Number) diezmo.get("monto")).longValue());
        // El mes siguiente, ya creado, no cambia: la prima entra cuando nazca otro mes.
        assertEquals(1, lineas(planDe(esposa, MES.plusMonths(1))).size());
    }

    @Test
    void unaLineaDeOtroMesNoSeRecibe() {
        Map<?, ?> plan = crearPlan(daniel, MES.plusMonths(2), "CERO");
        post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}/recibido", Map.of(), plan.get("id"), escenario(plan), lineas(plan).getFirst().get("id"))
                .expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
    }

    // --- Ayudas ---

    private Map<?, ?> crearPlan(String sesion, YearMonth ref, String modo) {
        return post(sesion, "/api/planes", Map.of("anio", ref.getYear(), "mes", ref.getMonthValue(), "modo", modo)).expectStatus().isCreated()
                .expectBody(Map.class).returnResult().getResponseBody();
    }

    private Map<?, ?> planDe(String sesion, YearMonth ref) {
        Map<?, ?> f = get(sesion, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        return ((List<?>) f.get("planes")).stream().map(p -> (Map<?, ?>) p)
                .filter(p -> ((Map<?, ?>) p.get("ref")).get("mes").equals(ref.getMonthValue())
                        && ((Map<?, ?>) p.get("ref")).get("anio").equals(ref.getYear()))
                .findFirst().orElseThrow();
    }

    private static Map<?, ?> principal(Map<?, ?> plan) {
        return (Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst();
    }

    private static List<Map<?, ?>> diezmos(Map<?, ?> plan) {
        return ((List<?>) principal(plan).get("items")).stream().<Map<?, ?>>map(i -> (Map<?, ?>) i).filter(i -> "DIEZMO".equals(i.get("tipo")))
                .toList();
    }

    private static List<Map<?, ?>> lineas(Map<?, ?> plan) {
        return ((List<?>) principal(plan).get("ingresos")).stream().<Map<?, ?>>map(i -> (Map<?, ?>) i).toList();
    }

    private static Map<String, Object> lineaBody(String nombre, long monto) {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", nombre);
        m.put("monto", monto);
        return m;
    }

    private static Map<String, Object> ingreso(String nombre, long bruto, long neto) {
        Map<String, Object> m = salario(bruto, neto);
        m.put("nombre", nombre);
        return m;
    }

    private static Map<String, Object> aporte(String usuario, long monto, YearMonth mes, boolean diezmo) {
        Map<String, Object> m = new HashMap<>();
        m.put("usuarioId", usuario);
        m.put("monto", monto);
        m.put("mes", Map.of("anio", mes.getYear(), "mes", mes.getMonthValue()));
        m.put("aplicaDiezmo", diezmo);
        return m;
    }

    private static String fechaCorta(LocalDate fecha) {
        return co.com.srdejo.steward.domain.usecase.Formato.fechaCorta(fecha);
    }

    private static LocalDate hoy() {
        return LocalDate.now(ZoneId.of("America/Bogota"));
    }
}
