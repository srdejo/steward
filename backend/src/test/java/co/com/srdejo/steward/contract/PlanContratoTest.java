package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Spec steward-plan-mes: "Categorias del hogar", "Crear el plan de un mes", "Items de la opcion" y "Usar la opcion y
 * estados del mes". Los meses son relativos al mes en curso del backend.
 */
class PlanContratoTest extends ContratoBase {

    static final YearMonth MES = YearMonth.now(ZoneId.of("America/Bogota"));

    private String daniel;
    private String esposa;

    @BeforeEach
    void hogar() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
    }

    // --- Categorias del hogar ---

    @Test
    void hogarNuevoConLasCategoriasDelSistema() {
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.categorias[*].nombre").isEqualTo(List.of("Diezmo", "Gastos fijos", "Tarjetas y cuotas", "Variables", "Créditos"))
                .jsonPath("$.categorias[*].tipo").isEqualTo(List.of("DIEZMO", "FIJO", "TARJETA", "VARIABLE", "CREDITO"))
                .jsonPath("$.categorias[0].sistema").isEqualTo(true);
    }

    @Test
    void nuevaCategoriaYRenombrar() {
        String id = valorDe(post(daniel, "/api/categorias", Map.of("nombre", "Educación")).expectStatus().isCreated(), "id");
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.categorias[5].nombre").isEqualTo("Educación")
                .jsonPath("$.categorias[5].orden").isEqualTo(5)
                .jsonPath("$.categorias[5].sistema").isEqualTo(false);
        client.patch().uri("/api/categorias/{id}", id).header("Authorization", "Bearer " + esposa)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON).bodyValue(Map.of("nombre", "Colegio"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.nombre").isEqualTo("Colegio");
        // Repetida, sin distinguir mayusculas.
        post(daniel, "/api/categorias", Map.of("nombre", "colegio")).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("DUPLICADA");
    }

    @Test
    void diezmoNoEsCategoria() {
        post(daniel, "/api/categorias", Map.of("nombre", "diezmo")).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("RESERVADA");
        // La categoria del sistema Diezmo no se renombra (diezmo-como-gasto).
        client.patch().uri("/api/categorias/{id}", categoria(daniel, "Diezmo")).header("Authorization", "Bearer " + esposa)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON).bodyValue(Map.of("nombre", "Ofrendas"))
                .exchange().expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("RESERVADA");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.categorias.length()").isEqualTo(5)
                .jsonPath("$.categorias[0].nombre").isEqualTo("Diezmo");
    }

    // --- Crear el plan de un mes ---

    @Test
    void copiarMesAnteriorAvanzaCuotasYSoloFijosDejaVariablesEnCero() {
        Map<?, ?> actual = crearPlan(daniel, MES, "CERO");
        String esc = escenario(actual);
        item(daniel, actual, esc, "Compra a cuotas", 375_000, "CUOTA", categoria(daniel, "Tarjetas y cuotas"), 4, 12);
        item(daniel, actual, esc, "Mercado", 320_000, "VARIABLE", categoria(daniel, "Variables"), null, null);
        item(daniel, actual, esc, "Última cuota", 100_000, "CUOTA", categoria(daniel, "Tarjetas y cuotas"), 12, 12);

        post(daniel, "/api/planes", Map.of("anio", MES.plusMonths(1).getYear(), "mes", MES.plusMonths(1).getMonthValue(), "modo", "COPIAR"))
                .expectStatus().isCreated().expectBody()
                .jsonPath("$.estado").isEqualTo("BORRADOR")
                .jsonPath("$.escenarios[0].letra").isEqualTo("A")
                .jsonPath("$.escenarios[0].items.length()").isEqualTo(2)
                .jsonPath("$.escenarios[0].items[0].nombre").isEqualTo("Compra a cuotas")
                .jsonPath("$.escenarios[0].items[0].cuota.actual").isEqualTo(5)
                .jsonPath("$.escenarios[0].items[0].cuota.total").isEqualTo(12)
                .jsonPath("$.escenarios[0].items[1].monto").isEqualTo(320_000);

        post(daniel, "/api/planes", Map.of("anio", MES.plusMonths(2).getYear(), "mes", MES.plusMonths(2).getMonthValue(), "modo", "FIJOS"))
                .expectStatus().isCreated().expectBody()
                .jsonPath("$.escenarios[0].items[?(@.nombre == 'Mercado')].monto").isEqualTo(0)
                .jsonPath("$.escenarios[0].items[?(@.nombre == 'Compra a cuotas')].monto").isEqualTo(375_000);
    }

    @Test
    void mesQueYaTienePlan() {
        crearPlan(daniel, MES, "CERO");
        post(esposa, "/api/planes", Map.of("anio", MES.getYear(), "mes", MES.getMonthValue(), "modo", "CERO"))
                .expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("YA_EXISTE");
        post(daniel, "/api/planes", Map.of("anio", MES.plusMonths(1).getYear(), "mes", MES.plusMonths(1).getMonthValue(), "modo", "OTRO"))
                .expectStatus().isBadRequest();
    }

    // --- Items de la opcion ---

    @Test
    void agregarEditarYQuitarItems() {
        Map<?, ?> plan = crearPlan(daniel, MES.plusMonths(1), "CERO");
        String esc = escenario(plan);
        String internet = item(daniel, plan, esc, "Internet", 120_000, "FIJO", categoria(daniel, "Gastos fijos"), null, null);
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.planes[0].escenarios[0].items[0].nombre").isEqualTo("Internet")
                .jsonPath("$.planes[0].escenarios[0].items[0].diaVence").isEqualTo(15);

        Map<String, Object> editado = itemBody("Internet hogar", 99_000, "FIJO", categoria(daniel, "Gastos fijos"), null, null);
        put(esposa, "/api/planes/{p}/escenarios/{e}/items/{i}", editado, plan.get("id"), esc, internet).expectStatus().isOk()
                .expectBody().jsonPath("$.monto").isEqualTo(99_000);
        delete(daniel, "/api/planes/{p}/escenarios/{e}/items/{i}", plan.get("id"), esc, internet).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios[0].items.length()").isEqualTo(0);
    }

    @Test
    void itemsInvalidos() {
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        String esc = escenario(plan);
        String fijos = categoria(daniel, "Gastos fijos");
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", itemBody("", 1, "FIJO", fijos, null, null), plan.get("id"), esc)
                .expectStatus().isBadRequest();
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", itemBody("Luz", -1, "FIJO", fijos, null, null), plan.get("id"), esc)
                .expectStatus().isBadRequest();
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", itemBody("Luz", 1, "OTRO", fijos, null, null), plan.get("id"), esc)
                .expectStatus().isBadRequest();
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", itemBody("Cuotas", 1, "CUOTA", fijos, 13, 12), plan.get("id"), esc)
                .expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", itemBody("Luz", 1, "FIJO", java.util.UUID.randomUUID().toString(), null, null),
                plan.get("id"), esc).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("CATEGORIA_NO_ENCONTRADA");
    }

    @Test
    void itemConPagosNoSeQuita() {
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        String esc = escenario(plan);
        String luz = item(daniel, plan, esc, "Recibo Luz", 50_000, "FIJO", categoria(daniel, "Gastos fijos"), null, null);
        post(esposa, "/api/pagos", pago(luz, 38_000, idDe(esposa), "NINGUNO")).expectStatus().isCreated();
        delete(daniel, "/api/planes/{p}/escenarios/{e}/items/{i}", plan.get("id"), esc, luz).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("ITEM_CON_PAGOS");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.planes[0].escenarios[0].items.length()").isEqualTo(1);
    }

    // --- Usar la opcion y estados del mes ---

    @Test
    void usarLaOpcionA() {
        Map<?, ?> siguiente = crearPlan(daniel, MES.plusMonths(1), "CERO");
        Map<?, ?> actual = crearPlan(daniel, MES, "CERO");
        post(esposa, "/api/planes/{id}/usar", Map.of("escenarioId", escenario(siguiente)), siguiente.get("id"))
                .expectStatus().isOk().expectBody()
                .jsonPath("$.estado").isEqualTo("BORRADOR")
                .jsonPath("$.escenarioActivoId").isEqualTo(escenario(siguiente));
        // El mes en curso con opcion elegida ya se lee Activo.
        post(esposa, "/api/planes/{id}/usar", Map.of("escenarioId", escenario(actual)), actual.get("id"))
                .expectStatus().isOk().expectBody().jsonPath("$.estado").isEqualTo("ACTIVO");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.planes[0].estado").isEqualTo("ACTIVO")
                .jsonPath("$.planes[1].estado").isEqualTo("BORRADOR");
    }

    @Test
    void mesCerrado() throws Exception {
        Map<?, ?> plan = crearPlan(daniel, MES, "CERO");
        String esc = escenario(plan);
        String luz = item(daniel, plan, esc, "Recibo Luz", 50_000, "FIJO", categoria(daniel, "Gastos fijos"), null, null);
        sql("UPDATE plan_mes SET estado = 'CERRADO'");
        post(daniel, "/api/planes/{p}/escenarios/{e}/items", itemBody("Gas", 25_000, "FIJO", categoria(daniel, "Gastos fijos"), null, null),
                plan.get("id"), esc).expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("MES_CERRADO");
        post(daniel, "/api/pagos", pago(luz, 50_000, idDe(daniel), "NINGUNO")).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("MES_CERRADO");
        post(daniel, "/api/gastos", gasto(null, 1_000, "x", idDe(daniel))).expectStatus().isEqualTo(409);
    }

    // --- Ayudas (tambien las usan los demas contratos de la Etapa 4) ---

    Map<?, ?> crearPlan(String sesion, YearMonth ref, String modo) {
        return post(sesion, "/api/planes", Map.of("anio", ref.getYear(), "mes", ref.getMonthValue(), "modo", modo))
                .expectStatus().isCreated().expectBody(Map.class).returnResult().getResponseBody();
    }

    static String escenario(Map<?, ?> plan) {
        return (String) ((Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst()).get("id");
    }

    String categoria(String sesion, String nombre) {
        Map<?, ?> f = get(sesion, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        return ((List<?>) f.get("categorias")).stream().map(c -> (Map<?, ?>) c)
                .filter(c -> nombre.equals(c.get("nombre"))).map(c -> (String) c.get("id")).findFirst().orElseThrow();
    }

    String item(String sesion, Map<?, ?> plan, String esc, String nombre, long monto, String tipo, String categoria,
                Integer cuotaActual, Integer cuotaTotal) {
        return valorDe(post(sesion, "/api/planes/{p}/escenarios/{e}/items",
                itemBody(nombre, monto, tipo, categoria, cuotaActual, cuotaTotal), plan.get("id"), esc).expectStatus().isCreated(), "id");
    }

    static Map<String, Object> itemBody(String nombre, long monto, String tipo, String categoria, Integer cuotaActual, Integer cuotaTotal) {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", nombre);
        m.put("monto", monto);
        m.put("tipo", tipo);
        m.put("categoriaId", categoria);
        m.put("diaVence", 15);
        if (cuotaActual != null) {
            m.put("cuota", Map.of("actual", cuotaActual, "total", cuotaTotal));
        }
        return m;
    }

    String idDe(String sesion) {
        Map<?, ?> s = get(sesion, "/api/sesion").expectBody(Map.class).returnResult().getResponseBody();
        return (String) ((Map<?, ?>) s.get("usuario")).get("id");
    }

    static Map<String, Object> pago(String item, long monto, String usuario, String origen) {
        Map<String, Object> m = new HashMap<>();
        m.put("itemId", item);
        m.put("monto", monto);
        m.put("usuarioId", usuario);
        m.put("origen", Map.of("tipo", origen));
        return m;
    }

    static Map<String, Object> gasto(String item, long monto, String nota, String usuario) {
        Map<String, Object> m = new HashMap<>();
        m.put("itemId", item);
        m.put("monto", monto);
        m.put("nota", nota);
        m.put("usuarioId", usuario);
        m.put("origen", Map.of("tipo", "NINGUNO"));
        return m;
    }
}
