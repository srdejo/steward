package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.gasto;
import static co.com.srdejo.steward.contract.PlanContratoTest.pago;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** plan-mes-siguiente: spec steward-finanzas, "Recibí", pagos y gastos en el mes en curso o el siguiente. */
class MesSiguienteContratoTest extends ContratoBase {

    private static final YearMonth SIGUIENTE = MES.plusMonths(1);

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
        salarioId = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");
    }

    @Test
    void recibirUnaLineaDelMesSiguiente() {
        ayudas.crearPlan(daniel, MES, "CERO");
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        String linea = lineaDe(plan);
        post(esposa, "/api/planes/{p}/escenarios/{e}/ingresos/{l}/recibido", Map.of(), plan.get("id"), escenario(plan), linea)
                .expectStatus().isCreated().expectBody()
                .jsonPath("$.ref.mes").isEqualTo(SIGUIENTE.getMonthValue())
                .jsonPath("$.ref.anio").isEqualTo(SIGUIENTE.getYear())
                .jsonPath("$.fecha").isEqualTo(hoy().toString())
                .jsonPath("$.ingresoPlanId").isEqualTo(linea);
        // El ingreso fijo de ese mes ya se recibio, pero el del mes en curso sigue libre.
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of("mes", mes(SIGUIENTE)), salarioId).expectStatus().isEqualTo(409);
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated()
                .expectBody().jsonPath("$.ref.mes").isEqualTo(MES.getMonthValue());
    }

    @Test
    void recibirUnIngresoFijoEnElMesSiguiente() {
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of("mes", mes(SIGUIENTE)), salarioId).expectStatus().isCreated()
                .expectBody().jsonPath("$.ref.mes").isEqualTo(SIGUIENTE.getMonthValue());
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of("mes", mes(MES.plusMonths(2))), salarioId).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
    }

    @Test
    void pagarUnItemDelMesSiguiente() {
        ayudas.crearPlan(daniel, MES, "CERO");
        Map<?, ?> plan = ayudas.crearPlan(daniel, SIGUIENTE, "CERO");
        String internet = ayudas.item(daniel, plan, escenario(plan), "Internet", 120_000, "FIJO", ayudas.categoria(daniel, "Gastos fijos"), null, null);
        // Sin mes se busca en el mes en curso.
        post(daniel, "/api/pagos", pago(internet, 120_000, idDaniel, "NINGUNO")).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("ITEM_NO_ENCONTRADO");
        Map<String, Object> p = pago(internet, 120_000, idDaniel, "NINGUNO");
        p.put("mes", mes(SIGUIENTE));
        post(daniel, "/api/pagos", p).expectStatus().isCreated().expectBody()
                .jsonPath("$.ref.mes").isEqualTo(SIGUIENTE.getMonthValue())
                .jsonPath("$.fecha").isEqualTo(hoy().toString());
        post(daniel, "/api/pagos", p).expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("YA_PAGADO");
        p.put("mes", mes(MES.minusMonths(1)));
        post(daniel, "/api/pagos", p).expectStatus().isBadRequest();
    }

    @Test
    void gastoEnElMesSiguienteYUnMesQueNoSePuede() {
        Map<String, Object> g = new HashMap<>(gasto(null, 85_000, "Farmacia", idDaniel));
        g.put("mes", mes(SIGUIENTE));
        post(esposa, "/api/gastos", g).expectStatus().isCreated().expectBody().jsonPath("$.ref.mes").isEqualTo(SIGUIENTE.getMonthValue());
        g.put("mes", mes(MES.minusMonths(1)));
        post(esposa, "/api/gastos", g).expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(1);
    }

    private static Map<String, Object> mes(YearMonth m) {
        return Map.of("anio", m.getYear(), "mes", m.getMonthValue());
    }

    private static String lineaDe(Map<?, ?> plan) {
        Map<?, ?> esc = (Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst();
        Map<?, ?> linea = (Map<?, ?>) ((List<?>) esc.get("ingresos")).getFirst();
        assertEquals("Salario Daniel", linea.get("nombre"));
        return (String) linea.get("id");
    }

    private static LocalDate hoy() {
        return LocalDate.now(ZoneId.of("America/Bogota"));
    }
}
