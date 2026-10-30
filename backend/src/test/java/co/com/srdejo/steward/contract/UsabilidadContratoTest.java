package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.CierreContratoTest.cierre;
import static co.com.srdejo.steward.contract.CreditosContratoTest.libreInversion;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.regla;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.gasto;
import static co.com.srdejo.steward.contract.PlanContratoTest.itemBody;
import static co.com.srdejo.steward.contract.PlanContratoTest.pago;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * usabilidad-plan: spec steward-plan-mes "El diezmo sigue a su línea de ingreso", "Borrar el plan de un mes" y "Empezar de
 * nuevo", y steward-finanzas "Corregir o borrar un registro", "Un ingreso fijo editado actualiza los meses abiertos" y
 * "Registros en un mes cerrado". Daniel tiene la regla del 10 % del bruto y un salario de $7.000.000 bruto, $6.288.000 neto.
 */
class UsabilidadContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idDaniel;
    private String salarioId;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idDaniel = ayudas.idDe(daniel);
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", true)).expectStatus().isOk();
        salarioId = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");
    }

    // --- El diezmo sigue a su linea ---

    @Test
    void elDiezmoSigueASuLinea() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        Map<?, ?> linea = lineas(plan).getFirst();
        assertEquals(linea.get("id"), diezmos(plan).getFirst().get("ingresoPlanId"));
        assertEquals(7_000_000, ((Number) linea.get("bruto")).longValue());

        put(esposa, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", lineaBody("Salario", 6_700_000, 7_500_000L), plan.get("id"), escenario(plan),
                linea.get("id")).expectStatus().isOk().expectBody().jsonPath("$.bruto").isEqualTo(7_500_000);
        Map<?, ?> diezmo = diezmos(planDe(daniel, MES)).getFirst();
        assertEquals("Diezmo · Salario:750000:false", diezmo.get("nombre") + ":" + diezmo.get("monto") + ":" + diezmo.get("ajustadoAMano"));
    }

    @Test
    void ajustadoAManoYVolverACalcular() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        Map<?, ?> diezmo = diezmos(plan).getFirst();
        put(daniel, "/api/planes/{p}/escenarios/{e}/items/{i}", itemBody("Diezmo · Salario Daniel", 800_000, "DIEZMO",
                (String) diezmo.get("categoriaId"), null, null), plan.get("id"), escenario(plan), diezmo.get("id"))
                .expectStatus().isOk().expectBody().jsonPath("$.ajustadoAMano").isEqualTo(true);
        put(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", lineaBody("Salario Daniel", 6_700_000, 7_500_000L), plan.get("id"),
                escenario(plan), lineas(plan).getFirst().get("id")).expectStatus().isOk();
        assertEquals(800_000, ((Number) diezmos(planDe(daniel, MES)).getFirst().get("monto")).longValue());

        post(esposa, "/api/planes/{p}/escenarios/{e}/items/{i}/recalcular", Map.of(), plan.get("id"), escenario(plan), diezmo.get("id"))
                .expectStatus().isOk().expectBody()
                .jsonPath("$.monto").isEqualTo(750_000)
                .jsonPath("$.ajustadoAMano").isEqualTo(false);
    }

    @Test
    void unDiezmoConPagosNoSeRecalcula() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/pagos", pago((String) diezmos(plan).getFirst().get("id"), 700_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        put(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", lineaBody("Salario Daniel", 6_700_000, 7_500_000L), plan.get("id"),
                escenario(plan), lineas(plan).getFirst().get("id")).expectStatus().isOk();
        assertEquals(700_000, ((Number) diezmos(planDe(daniel, MES)).getFirst().get("monto")).longValue());
    }

    @Test
    void lineaConAplicarDiezmoYQuitarla() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        Map<String, Object> venta = lineaBody("Venta bicicleta", 400_000, null);
        venta.put("aplicarDiezmo", true);
        String linea = valorDe(post(daniel, "/api/planes/{p}/escenarios/{e}/ingresos", venta, plan.get("id"), escenario(plan))
                .expectStatus().isCreated(), "id");
        Map<?, ?> diezmo = diezmos(planDe(daniel, MES)).stream().filter(i -> linea.equals(i.get("ingresoPlanId"))).findFirst().orElseThrow();
        assertEquals("Diezmo · Venta bicicleta:40000", diezmo.get("nombre") + ":" + diezmo.get("monto"));

        delete(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", plan.get("id"), escenario(plan), linea).expectStatus().isNoContent();
        assertEquals(List.of("Diezmo · Salario Daniel"), diezmos(planDe(daniel, MES)).stream().map(i -> i.get("nombre")).toList());
    }

    @Test
    void alDuplicarElDiezmoSigueALaCopia() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES.plusMonths(1), "CERO");
        Map<?, ?> conB = post(daniel, "/api/planes/{p}/escenarios", Map.of("desde", escenario(plan)), plan.get("id")).expectStatus().isCreated()
                .expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> b = (Map<?, ?>) ((List<?>) conB.get("escenarios")).get(1);
        Map<?, ?> lineaB = (Map<?, ?>) ((List<?>) b.get("ingresos")).getFirst();
        Map<?, ?> diezmoB = ((List<?>) b.get("items")).stream().map(i -> (Map<?, ?>) i).filter(i -> "DIEZMO".equals(i.get("tipo")))
                .findFirst().orElseThrow();
        assertEquals(lineaB.get("id"), diezmoB.get("ingresoPlanId"));
    }

    // --- Un ingreso fijo editado actualiza los meses abiertos ---

    @Test
    void aumentoDeSalario() {
        ayudas.crearPlan(daniel, MES, "CERO");
        Map<?, ?> noviembre = ayudas.crearPlan(daniel, MES.plusMonths(1), "CERO");
        Map<?, ?> conB = post(daniel, "/api/planes/{p}/escenarios", Map.of("desde", escenario(noviembre)), noviembre.get("id"))
                .expectStatus().isCreated().expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> b = (Map<?, ?>) ((List<?>) conB.get("escenarios")).get(1);
        put(daniel, "/api/planes/{p}/escenarios/{e}/ingresos/{l}", lineaBody("Salario Daniel", 6_000_000, 6_000_000L), noviembre.get("id"),
                b.get("id"), ((Map<?, ?>) ((List<?>) b.get("ingresos")).getFirst()).get("id")).expectStatus().isOk();

        put(daniel, "/api/ingresos-fijos/{id}", salario(7_500_000, 6_700_000), salarioId).expectStatus().isOk();
        for (YearMonth ref : List.of(MES, MES.plusMonths(1))) {
            Map<?, ?> p = planDe(daniel, ref);
            Map<?, ?> linea = lineas(p).getFirst();
            assertEquals("6700000:7500000", linea.get("monto") + ":" + linea.get("bruto"));
            assertEquals(750_000, ((Number) diezmos(p).getFirst().get("monto")).longValue());
        }
        // La linea de la Opcion B, cambiada a mano, no cambia.
        Map<?, ?> bDespues = (Map<?, ?>) ((List<?>) planDe(daniel, MES.plusMonths(1)).get("escenarios")).get(1);
        assertEquals(6_000_000, ((Number) ((Map<?, ?>) ((List<?>) bDespues.get("ingresos")).getFirst()).get("monto")).longValue());
    }

    // --- Borrar el plan de un mes ---

    @Test
    void borrarElPlanDelMes() {
        ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        String cuota = itemDe(planDe(daniel, MES), "CREDITO");
        post(daniel, "/api/pagos", pago(cuota, 500_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        post(daniel, "/api/gastos", gasto(null, 85_000, "Farmacia", idDaniel)).expectStatus().isCreated();
        post(daniel, "/api/aportes", aporte(1_000_000)).expectStatus().isCreated();
        get(esposa, "/api/meses/{ref}/borrado", MES.toString()).expectStatus().isOk().expectBody()
                .jsonPath("$.pagos").isEqualTo(1)
                .jsonPath("$.gastos").isEqualTo(1)
                .jsonPath("$.ingresos").isEqualTo(0)
                .jsonPath("$.cerrado").isEqualTo(false);

        delete(esposa, "/api/meses/{ref}", MES.toString()).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes.length()").isEqualTo(0)
                .jsonPath("$.movimientos[*].tipo").isEqualTo(List.of("APORTE"))
                .jsonPath("$.creditos[0].saldo").isEqualTo(14_250_000);
        delete(daniel, "/api/meses/{ref}", MES.toString()).expectStatus().isNotFound().expectBody()
                .jsonPath("$.codigo").isEqualTo("PLAN_NO_ENCONTRADO");
    }

    @Test
    void borrarUnMesCerrado() {
        ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/cierres", cierre(MES, -50_000, 0, 0, 0, 0)).expectStatus().isCreated();
        get(daniel, "/api/meses/{ref}/borrado", MES.toString()).expectBody().jsonPath("$.cerrado").isEqualTo(true);
        delete(daniel, "/api/meses/{ref}", MES.toString()).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.cierres.length()").isEqualTo(0).jsonPath("$.planes.length()").isEqualTo(0);
        delete(daniel, "/api/meses/{ref}", "octubre").expectStatus().isBadRequest();
    }

    // --- Empezar de nuevo ---

    @Test
    void empezarDeNuevo() {
        String davivienda = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated(), "id");
        ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        post(daniel, "/api/gastos", gastoDesde(50_000, davivienda)).expectStatus().isCreated();
        post(daniel, "/api/aportes", aporte(1_000_000)).expectStatus().isCreated();

        post(esposa, "/api/hogar/empezar-de-nuevo", Map.of()).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes.length()").isEqualTo(0)
                .jsonPath("$.movimientos.length()").isEqualTo(0)
                .jsonPath("$.cierres.length()").isEqualTo(0)
                .jsonPath("$.cuentas[0].saldoCuadre").isEqualTo(3_950_000)
                .jsonPath("$.creditos[0].saldo").isEqualTo(14_250_000)
                .jsonPath("$.ingresosFijos.length()").isEqualTo(1);
    }

    // --- Corregir o borrar un registro ---

    @Test
    void borrarUnGastoEquivocado() {
        ayudas.crearPlan(daniel, MES, "CERO");
        String farmacia = valorDe(post(esposa, "/api/gastos", gasto(null, 95_000, "Farmacia", idDaniel)).expectStatus().isCreated(), "id");
        delete(esposa, "/api/registros/{id}", farmacia).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(0);
        delete(esposa, "/api/registros/{id}", farmacia).expectStatus().isNotFound().expectBody()
                .jsonPath("$.codigo").isEqualTo("REGISTRO_NO_ENCONTRADO");
    }

    @Test
    void corregirElMontoDeUnPago() {
        String davivienda = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated(), "id");
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        String internet = ayudas.item(daniel, plan, escenario(plan), "Internet", 120_000, "FIJO", ayudas.categoria(daniel, "Gastos fijos"), null, null);
        Map<String, Object> p = pago(internet, 210_000, idDaniel, "NINGUNO");
        p.put("origen", Map.of("tipo", "CUENTA", "cuentaId", davivienda));
        String id = valorDe(post(daniel, "/api/pagos", p).expectStatus().isCreated(), "id");

        patch(esposa, "/api/registros/{id}", Map.of("monto", 120_000), id).expectStatus().isOk().expectBody()
                .jsonPath("$.monto").isEqualTo(120_000)
                .jsonPath("$.cuentaId").isEqualTo(davivienda);
        // Davivienda estima $3.880.000: cuadrar en eso no deja ajuste.
        cuadrar(davivienda, 3_880_000).expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')]").isEmpty();
        patch(daniel, "/api/registros/{id}", Map.of("monto", 0), id).expectStatus().isBadRequest();
    }

    @Test
    void borrarElPagoDeUnaCuota() {
        ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/creditos", libreInversion()).expectStatus().isCreated();
        String cuota = itemDe(planDe(daniel, MES), "CREDITO");
        String id = valorDe(post(daniel, "/api/pagos", pago(cuota, 500_000, idDaniel, "NINGUNO")).expectStatus().isCreated(), "id");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos[0].capital").isEqualTo(272_000);
        patch(daniel, "/api/registros/{id}", Map.of("monto", 550_000), id).expectStatus().isBadRequest();

        delete(daniel, "/api/registros/{id}", id).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.creditos[0].saldo").isEqualTo(14_250_000);
        // Vuelve a Por pagar: se puede marcar otra vez.
        post(daniel, "/api/pagos", pago(cuota, 500_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
    }

    @Test
    void registroYaCuadrado() {
        String davivienda = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated(), "id");
        ayudas.crearPlan(daniel, MES, "CERO");
        String id = valorDe(post(daniel, "/api/gastos", gastoDesde(100_000, davivienda)).expectStatus().isCreated(), "id");
        cuadrar(davivienda, 3_900_000).expectStatus().isOk();
        delete(daniel, "/api/registros/{id}", id).expectStatus().isNoContent();
        // Sigue estimando $3.900.000: cuadrar en eso no deja ajuste.
        cuadrar(davivienda, 3_900_000).expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')]").isEmpty();
    }

    @Test
    void unAporteBorradoSeLlevaSuDiezmo() {
        ayudas.crearPlan(daniel, MES, "CERO");
        String aporte = valorDe(post(daniel, "/api/aportes", aporte(2_000_000)).expectStatus().isCreated(), "id");
        patch(daniel, "/api/registros/{id}", Map.of("monto", 3_000_000), aporte).expectStatus().isOk();
        Map<?, ?> diezmo = diezmos(planDe(daniel, MES)).stream().filter(i -> aporte.equals(i.get("aporteId"))).findFirst().orElseThrow();
        assertEquals(300_000, ((Number) diezmo.get("monto")).longValue());

        delete(daniel, "/api/registros/{id}", aporte).expectStatus().isNoContent();
        assertEquals(List.of("Diezmo · Salario Daniel"), diezmos(planDe(daniel, MES)).stream().map(i -> i.get("nombre")).toList());
    }

    @Test
    void loQueNoSeCorrigePorAqui() {
        String davivienda = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated(), "id");
        String efectivo = valorDe(post(daniel, "/api/cuentas", cuenta("Efectivo", "CONJUNTA", 0)).expectStatus().isCreated(), "id");
        String id = valorDe(post(daniel, "/api/transferencias", Map.of("desde", davivienda, "hacia", efectivo, "monto", 100_000))
                .expectStatus().isCreated(), "id");
        delete(daniel, "/api/registros/{id}", id).expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
    }

    @Test
    void unRegistroDeOtroHogar() {
        ayudas.crearPlan(daniel, MES, "CERO");
        String id = valorDe(post(daniel, "/api/gastos", gasto(null, 85_000, "Farmacia", idDaniel)).expectStatus().isCreated(), "id");
        String otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
        delete(otro, "/api/registros/{id}", id).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("REGISTRO_NO_ENCONTRADO");
        patch(otro, "/api/registros/{id}", Map.of("monto", 1), id).expectStatus().isNotFound();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(1);
    }

    @Test
    void borrarUnRegistroDeUnMesCerrado() {
        ayudas.crearPlan(daniel, MES, "CERO");
        Map<?, ?> g = post(daniel, "/api/gastos", gasto(null, 85_000, "Farmacia", idDaniel)).expectStatus().isCreated()
                .expectBody(Map.class).returnResult().getResponseBody();
        String id = (String) g.get("id");
        post(daniel, "/api/cierres", cierre(MES, -50_000, 0, 0, 0, ((Number) g.get("seq")).longValue())).expectStatus().isCreated();
        delete(daniel, "/api/registros/{id}", id).expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("MES_CERRADO");
        patch(daniel, "/api/registros/{id}", Map.of("monto", 1), id).expectStatus().isEqualTo(409);
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(1);
    }

    // --- Ayudas ---

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec patch(String sesion, String uri, Object cuerpo,
                                                                                         Object... variables) {
        return client.patch().uri(uri, variables).header("Authorization", "Bearer " + sesion)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON).bodyValue(cuerpo).exchange();
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec cuadrar(String cuentaId, long saldo) {
        return post(daniel, "/api/cuentas/cuadre", Map.of("saldos", List.of(Map.of("cuentaId", cuentaId, "saldoBanco", saldo))));
    }

    private Map<String, Object> gastoDesde(long monto, String cuentaId) {
        Map<String, Object> m = gasto(null, monto, "Mercado", idDaniel);
        m.put("origen", Map.of("tipo", "CUENTA", "cuentaId", cuentaId));
        return m;
    }

    private Map<String, Object> aporte(long monto) {
        Map<String, Object> m = new HashMap<>();
        m.put("usuarioId", idDaniel);
        m.put("monto", monto);
        m.put("mes", Map.of("anio", MES.getYear(), "mes", MES.getMonthValue()));
        m.put("aplicaDiezmo", true);
        return m;
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

    private static String itemDe(Map<?, ?> plan, String tipo) {
        return ((List<?>) principal(plan).get("items")).stream().map(i -> (Map<?, ?>) i).filter(i -> tipo.equals(i.get("tipo")))
                .map(i -> (String) i.get("id")).findFirst().orElseThrow();
    }

    private static List<Map<?, ?>> lineas(Map<?, ?> plan) {
        return ((List<?>) principal(plan).get("ingresos")).stream().<Map<?, ?>>map(i -> (Map<?, ?>) i).toList();
    }

    private Map<String, Object> lineaBody(String nombre, long monto, Long bruto) {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", nombre);
        m.put("monto", monto);
        m.put("usuarioId", idDaniel);
        if (bruto != null) {
            m.put("bruto", bruto);
        }
        return m;
    }
}
