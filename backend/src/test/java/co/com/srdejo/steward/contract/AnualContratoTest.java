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

    // --- Replicar el mes base (planear-anio-desde-un-mes) ---

    @Test
    void replicarElMesBase() {
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        String fijos = ayudas.categoria(daniel, "Gastos fijos");
        String variables = ayudas.categoria(daniel, "Variables");
        ayudas.item(daniel, actual, escenario(actual), "Internet", 120_000, "FIJO", fijos, null, null);
        ayudas.item(daniel, actual, escenario(actual), "Arriendo", 675_000, "FIJO", fijos, null, null);
        ayudas.item(daniel, actual, escenario(actual), "Mercado", 720_000, "VARIABLE", variables, null, null);
        post(esposa, "/api/aportes", aporte(idEsposa, 1_500_000, MES)).expectStatus().isCreated();

        // Sin anual: replicar lo crea.
        post(daniel, "/api/anuales/{anio}/replicar", base(MES), ANIO).expectStatus().isOk().expectBody()
                .jsonPath("$.estado").isEqualTo("BORRADOR")
                .jsonPath("$.base.anio").isEqualTo(MES.getYear())
                .jsonPath("$.base.mes").isEqualTo(MES.getMonthValue())
                .jsonPath("$.celdas.length()").isEqualTo(24);
        Map<?, ?> f = get(esposa, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        Map<?, ?> anual = (Map<?, ?>) ((List<?>) f.get("anuales")).getFirst();
        assertEquals(List.of(795_000), ((List<?>) anual.get("celdas")).stream().map(c -> (Map<?, ?>) c)
                .filter(c -> c.get("categoriaId").equals(fijos)).map(c -> ((Number) c.get("monto")).intValue()).distinct().toList());
        assertEquals(12, ((List<?>) f.get("proyecciones")).stream().map(p -> (Map<?, ?>) p)
                .filter(p -> p.get("usuarioId").equals(idEsposa) && p.get("monto").equals(1_500_000)).count());

        // Replicar otra vez: las celdas se reemplazan y los eventos se conservan; solo fijos deja Variables en 0.
        post(daniel, "/api/anuales/{anio}/eventos", evento("SOAT", 3, 900_000, "GASTO", null), ANIO).expectStatus().isCreated();
        post(daniel, "/api/anuales/{anio}/replicar", Map.of("tipo", "FIJOS"), ANIO).expectStatus().isOk().expectBody()
                .jsonPath("$.celdas.length()").isEqualTo(12)
                .jsonPath("$.eventos[0].nombre").isEqualTo("SOAT");

        // Mes base sin plan y base invalida.
        post(daniel, "/api/anuales/{anio}/replicar", base(MES.plusMonths(2)), ANIO).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("PLAN_NO_ENCONTRADO");
        post(daniel, "/api/anuales/{anio}/replicar", Map.of("tipo", "OTRO"), ANIO).expectStatus().isBadRequest();
        post(daniel, "/api/anuales/{anio}/replicar", base(MES), MES.getYear() - 1).expectStatus().isBadRequest();
    }

    @Test
    void eventosConCategoriaEnAdelanteYQuitar() {
        put(daniel, "/api/regla-diezmo", FinanzasContratoTest.regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        Map<?, ?> actual = ayudas.crearPlan(daniel, MES, "CERO");
        String fijos = ayudas.categoria(daniel, "Gastos fijos");
        String variables = ayudas.categoria(daniel, "Variables");
        ayudas.item(daniel, actual, escenario(actual), "Internet", 120_000, "FIJO", fijos, null, null);
        ayudas.item(daniel, actual, escenario(actual), "Arriendo", 675_000, "FIJO", fijos, null, null);
        post(daniel, "/api/anuales/{anio}/replicar", base(MES), ANIO).expectStatus().isOk();

        Map<String, Object> navidad = evento("Navidad", 12, 680_000, "GASTO", null);
        navidad.put("categoriaId", variables);
        post(daniel, "/api/anuales/{anio}/eventos", navidad, ANIO).expectStatus().isCreated().expectBody()
                .jsonPath("$.categoriaId").isEqualTo(variables)
                .jsonPath("$.enAdelante").isEqualTo(false);
        Map<String, Object> aumento = evento("Aumento", 7, 300_000, "INGRESO", ayudas.idDe(daniel));
        aumento.put("enAdelante", true);
        post(daniel, "/api/anuales/{anio}/eventos", aumento, ANIO).expectStatus().isCreated();
        String soat = valorDe(post(daniel, "/api/anuales/{anio}/eventos", evento("SOAT", 3, 900_000, "GASTO", null), ANIO)
                .expectStatus().isCreated(), "id");

        // Un ingreso no lleva categoria; Diezmo no es categoria de un evento.
        Map<String, Object> malo = evento("Bono", 2, 1, "INGRESO", null);
        malo.put("categoriaId", variables);
        post(daniel, "/api/anuales/{anio}/eventos", malo, ANIO).expectStatus().isBadRequest();
        Map<String, Object> diezmo = evento("Ofrenda", 2, 1, "GASTO", null);
        diezmo.put("categoriaId", ayudas.categoria(daniel, "Diezmo"));
        post(daniel, "/api/anuales/{anio}/eventos", diezmo, ANIO).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");

        // Corregir y quitar.
        put(esposa, "/api/anuales/{anio}/eventos/{id}", evento("SOAT", 4, 950_000, "GASTO", null), ANIO, soat).expectStatus().isOk()
                .expectBody().jsonPath("$.mes").isEqualTo(4);
        delete(esposa, "/api/anuales/{anio}/eventos/{id}", ANIO, soat).expectStatus().isNoContent();
        delete(esposa, "/api/anuales/{anio}/eventos/{id}", ANIO, soat).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("EVENTO_NO_ENCONTRADO");

        post(esposa, "/api/anuales/{anio}/crear-meses", Map.of(), ANIO).expectStatus().isOk();
        Map<?, ?> f = get(daniel, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        // Los items del mes base, Navidad en Variables y sin "Eventos del año" (SOAT se quito).
        assertEquals(List.of("Internet:120000", "Arriendo:675000"), nombres(f, 2).stream().filter(n -> !n.startsWith("Diezmo")).toList());
        assertEquals(List.of("Internet:120000", "Arriendo:675000", "Navidad:680000"),
                nombres(f, 12).stream().filter(n -> !n.startsWith("Diezmo")).toList());
        // El aumento de julio en adelante: linea de ingreso y su diezmo de julio a diciembre, no antes.
        assertEquals(true, nombres(f, 9).contains("Diezmo · Aumento:30000"));
        assertEquals(false, nombres(f, 6).contains("Diezmo · Aumento:30000"));
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.categorias[?(@.nombre == 'Eventos del año')]").isEmpty();
    }

    @Test
    void borrarElPlanAnual() {
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
        post(daniel, "/api/anuales/{anio}/eventos", evento("SOAT", 3, 900_000, "GASTO", null), ANIO).expectStatus().isCreated();
        proyeccion(esposa, idEsposa, 1, 2_000_000).expectStatus().isNoContent();
        post(esposa, "/api/anuales/{anio}/crear-meses", Map.of(), ANIO).expectStatus().isOk();

        delete(daniel, "/api/anuales/{anio}", ANIO).expectStatus().isNoContent();
        Map<?, ?> f = get(esposa, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        assertEquals(List.of(), f.get("anuales"));
        assertEquals(List.of(), f.get("proyecciones"));
        // Los meses ya creados no cambian: marzo sigue con SOAT.
        assertEquals(List.of("SOAT:900000"), nombres(f, 3));
        delete(daniel, "/api/anuales/{anio}", ANIO).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("ANUAL_NO_ENCONTRADO");
        // Sin anual, se puede planear el año otra vez.
        post(daniel, "/api/anuales", Map.of("anio", ANIO)).expectStatus().isCreated();
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

    private static Map<String, Object> base(YearMonth mes) {
        return Map.of("tipo", "MES", "anio", mes.getYear(), "mes", mes.getMonthValue());
    }

    private static Map<String, Object> aporte(String usuario, long monto, YearMonth mes) {
        Map<String, Object> m = new HashMap<>();
        m.put("usuarioId", usuario);
        m.put("monto", monto);
        m.put("mes", Map.of("anio", mes.getYear(), "mes", mes.getMonthValue()));
        m.put("aplicaDiezmo", false);
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
