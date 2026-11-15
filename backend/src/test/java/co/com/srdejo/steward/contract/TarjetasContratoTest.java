package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-tarjetas: "Tarjetas del hogar" y "La tarjeta es una línea del plan"; spec steward-cuentas: "Cómo baja el saldo
 * de un crédito" (tarjetas-y-creditos).
 */
class TarjetasContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idDaniel;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idDaniel = ayudas.idDe(daniel);
    }

    @Test
    void agregarUnaTarjetaYVerlaEnElPlan() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        String id = valorDe(post(daniel, "/api/tarjetas", nu()).expectStatus().isCreated(), "id");
        get(esposa, "/api/tarjetas").expectStatus().isOk().expectBody()
                .jsonPath("$[0].nombre").isEqualTo("Nu")
                .jsonPath("$[0].uso").isEqualTo("Mercado")
                .jsonPath("$[0].pagoTipo").isEqualTo("COMPLETA");
        String tarjetas = ayudas.categoria(daniel, "Tarjetas");
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.tarjetas[0].id").isEqualTo(id)
                .jsonPath("$.tarjetas[0].diaCorte").isEqualTo(13)
                .jsonPath("$.planes[0].id").isEqualTo(plan.get("id"))
                .jsonPath("$.planes[0].escenarios[0].items[0].nombre").isEqualTo("Tarjeta Nu · Mercado")
                .jsonPath("$.planes[0].escenarios[0].items[0].monto").isEqualTo(320_000)
                .jsonPath("$.planes[0].escenarios[0].items[0].diaVence").isEqualTo(31)
                .jsonPath("$.planes[0].escenarios[0].items[0].categoriaId").isEqualTo(tarjetas)
                .jsonPath("$.planes[0].escenarios[0].items[0].tarjetaId").isEqualTo(id);
    }

    @Test
    void datosInvalidos() {
        post(daniel, "/api/tarjetas", con("diaCorte", 32)).expectStatus().isBadRequest();
        post(daniel, "/api/tarjetas", con("nombre", " ")).expectStatus().isBadRequest();
        Map<String, Object> fijoEnCero = con("pagoTipo", "FIJO");
        fijoEnCero.put("pagoMonto", 0);
        post(daniel, "/api/tarjetas", fijoEnCero).expectStatus().isBadRequest();
        post(daniel, "/api/tarjetas", con("pagoTipo", "OTRO")).expectStatus().isBadRequest();
        get(daniel, "/api/tarjetas").expectBody().jsonPath("$").isEmpty();
    }

    @Test
    void otroHogarNoLaVe() {
        String id = valorDe(post(daniel, "/api/tarjetas", nu()).expectStatus().isCreated(), "id");
        String otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
        put(otro, "/api/tarjetas/{id}", nu(), id).expectStatus().isNotFound();
        delete(otro, "/api/tarjetas/{id}", id).expectStatus().isNotFound();
        get(otro, "/api/tarjetas").expectBody().jsonPath("$").isEmpty();
    }

    @Test
    void enlazarUnItemQueYaExiste() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        String item = ayudas.item(daniel, plan, escenario(plan), "Tarjeta Mastercard", 1_500_000, "FIJO",
                ayudas.categoria(daniel, "Créditos"), null, null);
        Map<String, Object> mc = mastercard();
        mc.put("itemId", item);
        String id = valorDe(post(daniel, "/api/tarjetas", mc).expectStatus().isCreated(), "id");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[0].escenarios[0].items.length()").isEqualTo(1)
                .jsonPath("$.planes[0].escenarios[0].items[0].id").isEqualTo(item)
                .jsonPath("$.planes[0].escenarios[0].items[0].tarjetaId").isEqualTo(id)
                .jsonPath("$.planes[0].escenarios[0].items[0].categoriaId").isEqualTo(ayudas.categoria(daniel, "Tarjetas"))
                .jsonPath("$.planes[0].escenarios[0].items[0].diaVence").isEqualTo(30);
    }

    @Test
    void completaSigueAlUltimoPagoYElMesNuevoTraeLaLinea() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/planes/{id}/usar", Map.of("escenarioId", escenario(plan)), plan.get("id")).expectStatus().isOk();
        post(daniel, "/api/tarjetas", nu()).expectStatus().isCreated();
        post(daniel, "/api/tarjetas", mastercard()).expectStatus().isCreated();
        String linea = itemDe(daniel, "Tarjeta Nu · Mercado");
        post(daniel, "/api/pagos", PlanContratoTest.pago(linea, 352_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        get(daniel, "/api/tarjetas").expectBody().jsonPath("$[0].pagoMonto").isEqualTo(352_000);

        ayudas.crearPlan(daniel, MES.plusMonths(1), "CERO");
        Map<?, ?> f = get(daniel, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        List<?> items = (List<?>) ((Map<?, ?>) ((List<?>) ((Map<?, ?>) ((List<?>) f.get("planes")).getLast()).get("escenarios")).getFirst()).get("items");
        assertEquals(List.of("Tarjeta Nu · Mercado:352000", "Tarjeta Mastercard:1500000"),
                items.stream().map(i -> (Map<?, ?>) i).map(i -> i.get("nombre") + ":" + i.get("monto")).toList());
    }

    @Test
    void editarCambiaLosBorradoresYQuitarDejaLosItems() {
        String id = valorDe(post(daniel, "/api/tarjetas", mastercard()).expectStatus().isCreated(), "id");
        Map<?, ?> noviembre = ayudas.crearPlan(daniel, MES.plusMonths(1), "CERO");
        Map<String, Object> cambio = mastercard();
        cambio.put("pagoMonto", 1_800_000);
        put(daniel, "/api/tarjetas/{id}", cambio, id).expectStatus().isOk().expectBody().jsonPath("$.pagoMonto").isEqualTo(1_800_000);
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[0].id").isEqualTo(noviembre.get("id"))
                .jsonPath("$.planes[0].escenarios[0].items[0].monto").isEqualTo(1_800_000);
        delete(daniel, "/api/tarjetas/{id}", id).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.tarjetas").isEmpty()
                .jsonPath("$.planes[0].escenarios[0].items[0].nombre").isEqualTo("Tarjeta Mastercard")
                .jsonPath("$.planes[0].escenarios[0].items[0].tarjetaId").doesNotExist();
    }

    // --- Créditos por método ---

    @Test
    void planDePagosSinInteresesYPagarUnaCuota() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/planes/{id}/usar", Map.of("escenarioId", escenario(plan)), plan.get("id")).expectStatus().isOk();
        post(daniel, "/api/creditos", nevera()).expectStatus().isCreated().expectBody()
                .jsonPath("$.metodo").isEqualTo("PLAN")
                .jsonPath("$.cuota").isEqualTo(375_000)
                .jsonPath("$.saldo").isEqualTo(3_375_000)
                .jsonPath("$.cuotasPagadas").isEqualTo(3)
                .jsonPath("$.numeroCuotas").isEqualTo(12);
        String item = itemDe(daniel, "Cuota nevera");
        String pago = valorDe(post(daniel, "/api/pagos", PlanContratoTest.pago(item, 375_000, idDaniel, "NINGUNO")).expectStatus().isCreated(), "id");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.creditos[0].saldo").isEqualTo(3_000_000)
                .jsonPath("$.creditos[0].cuotasPagadas").isEqualTo(4);
        delete(daniel, "/api/registros/{id}", pago).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.creditos[0].saldo").isEqualTo(3_375_000)
                .jsonPath("$.creditos[0].cuotasPagadas").isEqualTo(3);
    }

    @Test
    void cambiarAManoNoBajaElSaldoAlPagar() {
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        post(daniel, "/api/planes/{id}/usar", Map.of("escenarioId", escenario(plan)), plan.get("id")).expectStatus().isOk();
        String id = valorDe(post(daniel, "/api/creditos", CreditosContratoTest.libreInversion()).expectStatus().isCreated(), "id");
        Map<String, Object> aMano = new HashMap<>();
        aMano.put("metodo", "MANUAL");
        aMano.put("saldo", 14_000_000);
        aMano.put("cuota", 500_000);
        aMano.put("tasaEM", 0);
        put(daniel, "/api/creditos/{id}/metodo", aMano, id).expectStatus().isOk().expectBody()
                .jsonPath("$.metodo").isEqualTo("MANUAL")
                .jsonPath("$.saldo").isEqualTo(14_000_000);
        post(daniel, "/api/pagos", PlanContratoTest.pago(itemDe(daniel, "Cuota libre inversión"), 500_000, idDaniel, "NINGUNO")).expectStatus().isCreated();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.creditos[0].saldo").isEqualTo(14_000_000);
        aMano.put("metodo", "OTRO");
        put(daniel, "/api/creditos/{id}/metodo", aMano, id).expectStatus().isBadRequest();
    }

    private String itemDe(String sesion, String nombre) {
        Map<?, ?> f = get(sesion, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> plan = (Map<?, ?>) ((List<?>) f.get("planes")).getFirst();
        Map<?, ?> esc = (Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst();
        return ((List<?>) esc.get("items")).stream().map(i -> (Map<?, ?>) i).filter(i -> nombre.equals(i.get("nombre")))
                .map(i -> (String) i.get("id")).findFirst().orElseThrow();
    }

    static Map<String, Object> nu() {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", "Nu");
        m.put("diaCorte", 13);
        // El 31 nunca ha pasado en el mes en curso: su linea siempre entra al mes de la prueba.
        m.put("diaPago", 31);
        m.put("uso", "Mercado");
        m.put("pagoTipo", "COMPLETA");
        m.put("pagoMonto", 320_000);
        return m;
    }

    private static Map<String, Object> mastercard() {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", "Mastercard");
        m.put("diaCorte", 15);
        m.put("diaPago", 30);
        m.put("uso", "");
        m.put("pagoTipo", "FIJO");
        m.put("pagoMonto", 1_500_000);
        return m;
    }

    private static Map<String, Object> con(String campo, Object valor) {
        Map<String, Object> m = nu();
        m.put(campo, valor);
        return m;
    }

    private static Map<String, Object> nevera() {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", "Nevera");
        m.put("entidad", "Almacén");
        m.put("metodo", "PLAN");
        m.put("valorFinanciado", 4_500_000);
        m.put("numeroCuotas", 12);
        m.put("cuotasPagadas", 3);
        m.put("tasaEM", 0);
        m.put("diaPago", 20);
        return m;
    }
}
