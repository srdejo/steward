package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;
import static co.com.srdejo.steward.contract.PlanContratoTest.gasto;
import static co.com.srdejo.steward.contract.PlanContratoTest.pago;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Spec steward-plan-mes: "Cerrar el mes" y el mes cerrado sin plan; spec steward-finanzas: "Registros en un mes cerrado" y
 * los cierres en la lectura (backend-cierre-mes). La foto la calcula la PWA; aqui va escrita a mano.
 */
class CierreContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idDaniel;
    private String idEsposa;
    private String luz;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idDaniel = ayudas.idDe(daniel);
        idEsposa = ayudas.idDe(esposa);
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        luz = ayudas.item(daniel, plan, escenario(plan), "Recibo Luz", 50_000, "FIJO", ayudas.categoria(daniel, "Gastos fijos"), null, null);
    }

    // --- Cerrar el mes ---

    @Test
    void cerrarOctubre() {
        long seq = seqDe(post(esposa, "/api/gastos", gasto(null, 85_000, "Farmacia", idEsposa)).expectStatus().isCreated());
        post(daniel, "/api/cierres", cierre(MES, 3_166_000, 2_000_000, 1_166_000, 0, seq)).expectStatus().isCreated().expectBody()
                .jsonPath("$.ref.mes").isEqualTo(MES.getMonthValue())
                .jsonPath("$.aSiguiente").isEqualTo(1_166_000)
                .jsonPath("$.cerradoPor").isEqualTo(idDaniel);
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.cierres.length()").isEqualTo(1)
                .jsonPath("$.cierres[0].sobrante").isEqualTo(3_166_000)
                .jsonPath("$.cierres[0].aAhorro").isEqualTo(2_000_000)
                .jsonPath("$.cierres[0].aSiguiente").isEqualTo(1_166_000)
                .jsonPath("$.cierres[0].cerradoPor").isEqualTo(idDaniel)
                .jsonPath("$.cierres[0].filas[0].nombre").isEqualTo("Ingresos")
                .jsonPath("$.cierres[0].filas[1].plan").doesNotExist()
                .jsonPath("$.cierres[0].filas[1].real").isEqualTo(85_000)
                .jsonPath("$.planes[0].estado").isEqualTo("CERRADO");
    }

    @Test
    void repartoQueNoSuma() {
        post(daniel, "/api/cierres", cierre(MES, 3_166_000, 2_000_000, 1_000_000, 0, 0)).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("REPARTO_INVALIDO");
        post(daniel, "/api/cierres", cierre(MES, -50_000, 0, 0, 0, 0)).expectStatus().isCreated();
    }

    @Test
    void sinSobranteElRepartoEsCero() {
        post(daniel, "/api/cierres", cierre(MES, -50_000, 10, 0, 0, 0)).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("REPARTO_INVALIDO");
    }

    @Test
    void alguienRegistroAlgoMientrasTanto() {
        long seq = seqDe(post(esposa, "/api/gastos", gasto(null, 85_000, "Farmacia", idEsposa)).expectStatus().isCreated());
        post(esposa, "/api/gastos", gasto(null, 10_000, "Pan", idEsposa)).expectStatus().isCreated();
        post(daniel, "/api/cierres", cierre(MES, 0, 0, 0, 0, seq)).expectStatus().isEqualTo(409).expectBody()
                .jsonPath("$.codigo").isEqualTo("CIERRE_DESACTUALIZADO")
                .jsonPath("$.mensaje").isEqualTo("Alguien registró algo en " + nombre(MES) + "; revisa el cierre otra vez");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.cierres").isEmpty()
                .jsonPath("$.planes[0].estado").isEqualTo("BORRADOR");
    }

    @Test
    void sinRegistrarQueNoCoincide() {
        String cta = valorDe(post(daniel, "/api/cuentas", cuenta("Efectivo", "CONJUNTA", 200_000)).expectStatus().isCreated(), "id");
        post(daniel, "/api/cuentas/cuadre", Map.of("saldos", List.of(Map.of("cuentaId", cta, "saldoBanco", 150_000)))).expectStatus().isOk();
        long seq = ultimoSeq(daniel);
        post(daniel, "/api/cierres", cierre(MES, 0, 0, 0, 0, seq)).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("CIERRE_DESACTUALIZADO");
        post(daniel, "/api/cierres", cierre(MES, 0, 0, 0, 50_000, seq)).expectStatus().isCreated();
    }

    @Test
    void mesFuturo() {
        post(daniel, "/api/cierres", cierre(MES.plusMonths(1), 0, 0, 0, 0, 0)).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        post(daniel, "/api/cierres", Map.of("anio", 2026, "mes", 13, "filas", List.of())).expectStatus().isBadRequest();
    }

    @Test
    void cerrarDosVeces() {
        post(daniel, "/api/cierres", cierre(MES, 100, 100, 0, 0, 0)).expectStatus().isCreated();
        post(esposa, "/api/cierres", cierre(MES, 200, 0, 200, 0, 0)).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("MES_CERRADO");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.cierres[0].aAhorro").isEqualTo(100);
    }

    @Test
    void dosCierresALaVezDejanUnoSolo() {
        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() -> estado(post(daniel, "/api/cierres", cierre(MES, 0, 0, 0, 0, 0))));
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() -> estado(post(esposa, "/api/cierres", cierre(MES, 0, 0, 0, 0, 0))));
        assertEquals(List.of(201, 409), Stream.of(a.join(), b.join()).sorted().toList());
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.cierres.length()").isEqualTo(1);
    }

    // --- Registros en un mes cerrado ---

    @Test
    void registrosEnUnMesCerrado() {
        String salario = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)).expectStatus().isCreated(), "id");
        String cta = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 1_000_000)).expectStatus().isCreated(), "id");
        post(daniel, "/api/cierres", cierre(MES, 0, 0, 0, 0, 0)).expectStatus().isCreated();

        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salario).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("MES_CERRADO");
        post(daniel, "/api/pagos", pago(luz, 50_000, idDaniel, "NINGUNO")).expectStatus().isEqualTo(409);
        post(daniel, "/api/gastos", gasto(null, 1_000, "x", idDaniel)).expectStatus().isEqualTo(409);
        post(daniel, "/api/aportes", aporte(MES)).expectStatus().isEqualTo(409);
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos").isEmpty();

        // Para el mes siguiente sí, y las cuentas siguen funcionando.
        post(daniel, "/api/aportes", aporte(MES.plusMonths(1))).expectStatus().isCreated();
        post(daniel, "/api/cuentas/cuadre", Map.of("saldos", List.of(Map.of("cuentaId", cta, "saldoBanco", 900_000)))).expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.cierres[0].sinRegistrar").isEqualTo(0);
    }

    @Test
    void mesCerradoSinPlan() {
        YearMonth anterior = MES.minusMonths(1);
        post(daniel, "/api/cierres", cierre(anterior, 0, 0, 0, 0, 0)).expectStatus().isCreated();
        post(daniel, "/api/planes", Map.of("anio", anterior.getYear(), "mes", anterior.getMonthValue(), "modo", "CERO"))
                .expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("MES_CERRADO");
    }

    // --- Lectura y aislamiento ---

    @Test
    void laLecturaTraeLosCierresDesdeTresMesesAntes() {
        post(daniel, "/api/cierres", cierre(MES.minusMonths(4), 0, 0, 0, 0, 0)).expectStatus().isCreated();
        post(daniel, "/api/cierres", cierre(MES.minusMonths(3), 0, 0, 0, 0, 0)).expectStatus().isCreated();
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.cierres.length()").isEqualTo(1)
                .jsonPath("$.cierres[0].ref.mes").isEqualTo(MES.minusMonths(3).getMonthValue());
    }

    @Test
    void cierresAjenosYSinSesion() throws Exception {
        post(daniel, "/api/cierres", cierre(MES, 0, 0, 0, 0, 0)).expectStatus().isCreated();
        String otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
        get(otro, "/api/finanzas").expectBody().jsonPath("$.cierres").isEmpty();
        // El hogar sale de la sesion: el otro cierra su propio mes, no el de "Nuestra casa".
        post(otro, "/api/cierres", cierre(MES, 0, 0, 0, 0, 0)).expectStatus().isCreated();
        client.post().uri("/api/cierres").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();

        delete(esposa, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        delete(daniel, "/api/hogar/miembros/yo").expectStatus().isNoContent();
        try (var c = java.sql.DriverManager.getConnection(DB_URL, "postgres", "postgres");
             var r = c.createStatement().executeQuery("SELECT count(*) FROM cierre_mes")) {
            r.next();
            assertEquals(1, r.getLong(1));
        }
    }

    // --- Ayudas ---

    static Map<String, Object> cierre(YearMonth mes, long sobrante, long ahorro, long siguiente, long sinRegistrar, long ultimoSeq) {
        Map<String, Object> plan = new HashMap<>();
        plan.put("nombre", "No estaba planeado");
        plan.put("plan", null);
        plan.put("real", 85_000);
        Map<String, Object> m = new HashMap<>();
        m.put("anio", mes.getYear());
        m.put("mes", mes.getMonthValue());
        m.put("filas", List.of(Map.of("nombre", "Ingresos", "plan", 9_000_000, "real", 9_000_000), plan));
        m.put("sinRegistrar", sinRegistrar);
        m.put("sobrante", sobrante);
        m.put("aAhorro", ahorro);
        m.put("aSiguiente", siguiente);
        m.put("ultimoSeq", ultimoSeq);
        return m;
    }

    private Map<String, Object> aporte(YearMonth mes) {
        return Map.of("usuarioId", idDaniel, "monto", 1_000, "mes", Map.of("anio", mes.getYear(), "mes", mes.getMonthValue()),
                "aplicaDiezmo", false);
    }

    private static long seqDe(org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec r) {
        return ((Number) r.expectBody(Map.class).returnResult().getResponseBody().get("seq")).longValue();
    }

    private long ultimoSeq(String sesion) {
        Map<?, ?> f = get(sesion, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody();
        return ((List<?>) f.get("movimientos")).stream().mapToLong(m -> ((Number) ((Map<?, ?>) m).get("seq")).longValue()).max().orElse(0);
    }

    private static int estado(org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec r) {
        return r.returnResult(String.class).getStatus().value();
    }

    private static String nombre(YearMonth mes) {
        return List.of("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
                "noviembre", "diciembre").get(mes.getMonthValue() - 1);
    }
}
