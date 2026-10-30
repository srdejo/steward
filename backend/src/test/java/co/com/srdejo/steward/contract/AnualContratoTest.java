package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-plan-anual: crear el plan anual, sus celdas, eventos y aportes proyectados, y crear los meses desde el
 * (backend-plan-anual). El año siguiente al en curso.
 */
class AnualContratoTest extends ContratoBase {

    private static final int ANIO = MES.getYear() + 1;

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idEsposa;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idEsposa = ayudas.idDe(esposa);
    }

    // --- Crear el plan anual ---

    @Test
    void crearElAnualVacio() {
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated().expectBody()
                .jsonPath("$.anio").isEqualTo(ANIO)
                .jsonPath("$.estado").isEqualTo("BORRADOR")
                .jsonPath("$.celdas").isEmpty()
                .jsonPath("$.eventos").isEmpty();
        get(esposa, "/api/finanzas").expectBody().jsonPath("$.anuales[0].anio").isEqualTo(ANIO);
        post(esposa, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_EXISTE");
        post(daniel, "/api/anuales", Map.of("anio", MES.getYear() - 1)).expectStatus().isBadRequest();
    }

    // --- Celdas, eventos y aportes proyectados ---

    @Test
    void celdasQueSeReemplazan() {
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
        String fijos = ayudas.categoria(daniel, "Gastos fijos");
        celda(daniel, fijos, 1, 800_000).expectStatus().isNoContent();
        celda(esposa, fijos, 1, 900_000).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.anuales[0].celdas.length()").isEqualTo(1)
                .jsonPath("$.anuales[0].celdas[0].monto").isEqualTo(900_000);
        celda(daniel, UUID.randomUUID().toString(), 1, 1).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("CATEGORIA_NO_ENCONTRADA");
        celda(daniel, fijos, 13, 1).expectStatus().isBadRequest();
        put(daniel, "/api/anuales/{anio}/celdas", Map.of("categoriaId", fijos, "mes", 1, "monto", 1), ANIO + 1)
                .expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("ANUAL_NO_ENCONTRADO");
    }

    @Test
    void eventoDelAnio() {
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
        post(esposa, "/api/anuales/{anio}/eventos", evento("SOAT", 3, 1_200_000, "GASTO", null), ANIO).expectStatus().isCreated()
                .expectBody().jsonPath("$.nombre").isEqualTo("SOAT");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.anuales[0].eventos[0].mes").isEqualTo(3)
                .jsonPath("$.anuales[0].eventos[0].tipo").isEqualTo("GASTO");
        post(daniel, "/api/anuales/{anio}/eventos", evento("Prima", 6, 1, "OTRO", null), ANIO).expectStatus().isBadRequest();
        post(daniel, "/api/anuales/{anio}/eventos", evento("Prima", 6, 1, "INGRESO", UUID.randomUUID().toString()), ANIO)
                .expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("MIEMBRO_NO_ENCONTRADO");
    }

    @Test
    void aporteProyectado() {
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
        proyeccion(esposa, idEsposa, 1, 2_000_000).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.proyecciones.length()").isEqualTo(1)
                .jsonPath("$.proyecciones[0].usuarioId").isEqualTo(idEsposa)
                .jsonPath("$.proyecciones[0].anio").isEqualTo(ANIO)
                .jsonPath("$.proyecciones[0].monto").isEqualTo(2_000_000);
        proyeccion(esposa, idEsposa, 1, 0).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.proyecciones").isEmpty();
        proyeccion(daniel, UUID.randomUUID().toString(), 1, 1).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("MIEMBRO_NO_ENCONTRADO");
    }

    // --- Crear los meses desde el plan anual ---

    @Test
    void crearLosMesesDelAnio() {
        // La plantilla: el ultimo plan antes del año.
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        String fijos = ayudas.categoria(daniel, "Gastos fijos");
        String variables = ayudas.categoria(daniel, "Variables");
        ayudas.item(daniel, actual, escenario(actual), "Internet", 120_000, "FIJO", fijos, null, null);
        ayudas.item(daniel, actual, escenario(actual), "Mercado", 320_000, "VARIABLE", variables, null, null);
        // Enero del año ya tiene plan: no cambia.
        ayudas.crearPlan(daniel, YearMonth.of(ANIO, 1), "CERO");

        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
        IntStream.rangeClosed(1, 12).forEach(m -> celda(daniel, fijos, m, 800_000).expectStatus().isNoContent());
        celda(daniel, variables, 2, 200_000).expectStatus().isNoContent();
        post(esposa, "/api/anuales/{anio}/eventos", evento("SOAT", 3, 1_200_000, "GASTO", null), ANIO).expectStatus().isCreated();

        List<?> creados = post(esposa, "/api/anuales/{anio}/crear-meses", Map.of(), ANIO).expectStatus().isOk()
                .expectBody(List.class).returnResult().getResponseBody();
        assertEquals(11, creados.size());

        Map<?, ?> f = get(daniel, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        assertEquals("CREADO", ((Map<?, ?>) ((List<?>) f.get("anuales")).getFirst()).get("estado"));
        assertEquals(List.of(), nombres(f, 1));
        // Febrero: Internet + el ajuste a $800.000, y Variables por la columna ($200.000 < $320.000 copiados).
        assertEquals(List.of("Internet:120000", "Ajuste del plan anual:680000", "Variables:200000"), nombres(f, 2));
        // Marzo: sin variables (columna en 0) y con SOAT en "Eventos del año".
        assertEquals(List.of("Internet:120000", "Ajuste del plan anual:680000", "SOAT:1200000"), nombres(f, 3));
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.categorias[?(@.nombre == 'Eventos del año')].orden").isEqualTo(List.of(90));
    }

    @Test
    void diezmoDeLaPrimaYCeldaDeDiezmo() {
        put(daniel, "/api/regla-diezmo", FinanzasContratoTest.regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        post(daniel, "/api/ingresos-fijos", FinanzasContratoTest.salario(7_000_000, 6_288_000)).expectStatus().isCreated();
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
        post(daniel, "/api/anuales/{anio}/eventos", evento("Prima", 6, 3_000_000, "INGRESO", ayudas.idDe(daniel)), ANIO).expectStatus().isCreated();
        // La fila Diezmo se calcula con las reglas (diezmo-como-gasto).
        celda(daniel, ayudas.categoria(daniel, "Diezmo"), 1, 1).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");

        post(esposa, "/api/anuales/{anio}/crear-meses", Map.of(), ANIO).expectStatus().isOk();
        Map<?, ?> f = get(daniel, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        assertEquals(List.of("Diezmo · Salario Daniel:700000", "Diezmo · Prima:300000"), nombres(f, 6));
        assertEquals(List.of("Diezmo · Salario Daniel:700000"), nombres(f, 5));
        Map<?, ?> junio = ((List<?>) f.get("planes")).stream().map(p -> (Map<?, ?>) p)
                .filter(p -> ((Map<?, ?>) p.get("ref")).get("anio").equals(ANIO) && ((Map<?, ?>) p.get("ref")).get("mes").equals(6))
                .findFirst().orElseThrow();
        Map<?, ?> esc = (Map<?, ?>) ((List<?>) junio.get("escenarios")).getFirst();
        assertEquals(List.of("Salario Daniel:6288000:FIJO", "Prima:3000000:EXTRA"), ((List<?>) esc.get("ingresos")).stream()
                .map(l -> (Map<?, ?>) l).map(l -> l.get("nombre") + ":" + l.get("monto") + ":" + l.get("tipo")).toList());
    }

    // --- Aislamiento ---

    @Test
    void anualAjenoYSinSesion() throws Exception {
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
        String otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
        put(otro, "/api/anuales/{anio}/celdas", Map.of("categoriaId", ayudas.categoria(daniel, "Gastos fijos"), "mes", 1, "monto", 1), ANIO)
                .expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("ANUAL_NO_ENCONTRADO");
        get(otro, "/api/finanzas").expectBody().jsonPath("$.anuales").isEmpty();
        client.post().uri("/api/anuales").bodyValue(Map.of("anio", ANIO)).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/anuales/{anio}/crear-meses", ANIO).exchange().expectStatus().isUnauthorized();

        delete(esposa, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        delete(daniel, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        try (var c = java.sql.DriverManager.getConnection(DB_URL, "postgres", "postgres");
             var r = c.createStatement().executeQuery("SELECT count(*) FROM plan_anual")) {
            r.next();
            assertEquals(0, r.getLong(1));
        }
    }

    // --- Ayudas ---

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec celda(String sesion, String categoria, int mes, long monto) {
        return put(sesion, "/api/anuales/{anio}/celdas", Map.of("categoriaId", categoria, "mes", mes, "monto", monto), ANIO);
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec proyeccion(String sesion, String usuario, int mes, long monto) {
        return put(sesion, "/api/anuales/{anio}/proyecciones", Map.of("usuarioId", usuario, "mes", mes, "monto", monto), ANIO);
    }

    private static Map<String, Object> evento(String nombre, int mes, long monto, String tipo, String usuario) {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", nombre);
        m.put("mes", mes);
        m.put("monto", monto);
        m.put("tipo", tipo);
        m.put("usuarioId", usuario);
        return m;
    }

    private static List<String> nombres(Map<?, ?> finanzas, int mes) {
        Map<?, ?> plan = ((List<?>) finanzas.get("planes")).stream().map(p -> (Map<?, ?>) p)
                .filter(p -> ((Map<?, ?>) p.get("ref")).get("anio").equals(ANIO) && ((Map<?, ?>) p.get("ref")).get("mes").equals(mes))
                .findFirst().orElseThrow();
        Map<?, ?> esc = (Map<?, ?>) ((List<?>) plan.get("escenarios")).getFirst();
        return ((List<?>) esc.get("items")).stream().map(i -> (Map<?, ?>) i).map(i -> i.get("nombre") + ":" + i.get("monto")).toList();
    }
}
