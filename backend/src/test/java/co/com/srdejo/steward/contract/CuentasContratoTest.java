package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.PlanContratoTest.MES;
import static co.com.srdejo.steward.contract.PlanContratoTest.escenario;

/**
 * Spec steward-finanzas: "Cuadrar cuentas", "Mover dinero" y el saldo estimado de "Cuentas básicas"
 * (backend-cuentas-creditos). El saldo estimado lo calcula la PWA; aqui se ve por la diferencia que registra el cuadre.
 */
class CuentasContratoTest extends ContratoBase {

    private final PlanContratoTest ayudas = new PlanContratoTest();
    private String daniel;
    private String esposa;
    private String idDaniel;
    private String davivienda;
    private String efectivo;
    private String luz;
    private String internet;

    @BeforeEach
    void hogar() {
        ayudas.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        idDaniel = ayudas.idDe(daniel);
        davivienda = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated(), "id");
        efectivo = valorDe(post(daniel, "/api/cuentas", cuenta("Efectivo", "CONJUNTA", 200_000)).expectStatus().isCreated(), "id");
        Map<?, ?> plan = ayudas.crearPlan(daniel, MES, "CERO");
        String fijos = ayudas.categoria(daniel, "Gastos fijos");
        luz = ayudas.item(daniel, plan, escenario(plan), "Recibo Luz", 50_000, "FIJO", fijos, null, null);
        internet = ayudas.item(daniel, plan, escenario(plan), "Internet", 120_000, "FIJO", fijos, null, null);
    }

    // --- Cuadrar cuentas ---

    @Test
    void diferencia() {
        pagarDesde(luz, 50_000, davivienda).expectStatus().isCreated();
        cuadrar(esposa, Map.of(davivienda, 3_900_000L)).expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo(davivienda)
                .jsonPath("$[0].saldoCuadre").isEqualTo(3_900_000)
                .jsonPath("$[0].cuadrada").isEqualTo(true);
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')].monto").isEqualTo(List.of(50_000))
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')].nota").isEqualTo(List.of("Gastos sin registrar"))
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')].cuentaId").isEqualTo(List.of(davivienda))
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')].ref.mes").isEqualTo(List.of(MES.getMonthValue()));
    }

    @Test
    void entroDinero() {
        cuadrar(daniel, Map.of(efectivo, 230_000L)).expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')].monto").isEqualTo(List.of(-30_000));
    }

    @Test
    void loDeAntesDelCuadreNoCuenta() {
        cuadrar(daniel, Map.of(davivienda, 3_900_000L)).expectStatus().isOk();
        pagarDesde(internet, 120_000, davivienda).expectStatus().isCreated();
        // Estima $3.780.000: cuadrar en eso no deja otro ajuste.
        cuadrar(daniel, Map.of(davivienda, 3_780_000L)).expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')].monto").isEqualTo(List.of(100_000));
    }

    @Test
    void unaCuentaAjenaNoCuadraNinguna() {
        String otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
        String ajena = valorDe(post(otro, "/api/cuentas", cuenta("Ajena", "YO", 1_000)).expectStatus().isCreated(), "id");
        Map<String, Long> saldos = new HashMap<>();
        saldos.put(davivienda, 1L);
        saldos.put(ajena, 1L);
        cuadrar(daniel, saldos).expectStatus().isNotFound().expectBody()
                .jsonPath("$.codigo").isEqualTo("CUENTA_NO_ENCONTRADA");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.cuentas[?(@.nombre == 'Davivienda')].cuadrada").isEqualTo(List.of(false))
                .jsonPath("$.movimientos.length()").isEqualTo(0);
        get(otro, "/api/finanzas").expectBody().jsonPath("$.cuentas[0].cuadrada").isEqualTo(false);
    }

    @Test
    void saldoNegativoOVacio() {
        cuadrar(daniel, Map.of(davivienda, -1L)).expectStatus().isBadRequest();
        post(daniel, "/api/cuentas/cuadre", Map.of("saldos", List.of())).expectStatus().isBadRequest();
    }

    // --- Mover dinero ---

    @Test
    void delBancoAlEfectivo() {
        post(daniel, "/api/transferencias", Map.of("desde", davivienda, "hacia", efectivo, "monto", 100_000))
                .expectStatus().isCreated().expectBody()
                .jsonPath("$.tipo").isEqualTo("TRANSFERENCIA")
                .jsonPath("$.cuentaId").isEqualTo(davivienda)
                .jsonPath("$.cuentaDestinoId").isEqualTo(efectivo)
                .jsonPath("$.origen").isEqualTo("CUENTA");
        // Davivienda estima $3.900.000 y Efectivo $300.000: cuadrar en eso no deja ajustes.
        Map<String, Long> saldos = new HashMap<>();
        saldos.put(davivienda, 3_900_000L);
        saldos.put(efectivo, 300_000L);
        cuadrar(esposa, saldos).expectStatus().isOk();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')]").isEmpty();
    }

    @Test
    void transferenciasInvalidas() {
        post(daniel, "/api/transferencias", Map.of("desde", davivienda, "hacia", davivienda, "monto", 1))
                .expectStatus().isBadRequest().expectBody().jsonPath("$.codigo").isEqualTo("MISMA_CUENTA");
        post(daniel, "/api/transferencias", Map.of("desde", davivienda, "hacia", efectivo, "monto", 0))
                .expectStatus().isBadRequest();
        post(daniel, "/api/transferencias", Map.of("desde", davivienda, "hacia", java.util.UUID.randomUUID().toString(),
                "monto", 1)).expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("CUENTA_NO_ENCONTRADA");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(0);
    }

    // --- Cuentas básicas: el saldo estimado ---

    @Test
    void unPagoDeHaceCuatroMeses() throws Exception {
        YearMonth junio = MES.minusMonths(4);
        sql("INSERT INTO movimiento (id, hogar_id, tipo, ref_anio, ref_mes, monto, fecha, usuario_id, creado_por, cuenta_id, origen) "
                + "SELECT gen_random_uuid(), c.hogar_id, 'GASTO', " + junio.getYear() + ", " + junio.getMonthValue()
                + ", 50000, now()::date, m.usuario_id, m.usuario_id, c.id, 'CUENTA' FROM cuenta c "
                + "JOIN miembro m ON m.hogar_id = c.hogar_id WHERE c.id = '" + davivienda + "' LIMIT 1");
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos[?(@.ref.mes == " + junio.getMonthValue() + ")].monto").isEqualTo(List.of(50_000));
        // Sigue descontando: cuadrar en $3.950.000 no deja ajuste.
        cuadrar(daniel, Map.of(davivienda, 3_950_000L)).expectStatus().isOk();
        Map<String, Long> todas = new HashMap<>();
        todas.put(efectivo, 200_000L);
        cuadrar(daniel, todas).expectStatus().isOk();
        // Con todas cuadradas, lo de junio ya no se lee.
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos[?(@.tipo == 'AJUSTE_CUADRE')]").isEmpty()
                .jsonPath("$.movimientos[?(@.ref.mes == " + junio.getMonthValue() + ")]").isEmpty();
    }

    @Test
    void unaCuentaNuevaEmpiezaDespuesDeLoRegistrado() {
        String seq = String.valueOf(((Number) post(daniel, "/api/pagos", pagoDesde(luz, 50_000, davivienda))
                .expectStatus().isCreated().expectBody(Map.class).returnResult().getResponseBody().get("seq")).longValue());
        post(daniel, "/api/cuentas", cuenta("Nu", "YO", 300_000)).expectStatus().isCreated();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.cuentas[?(@.nombre == 'Nu')].seqCuadre").isEqualTo(List.of(Integer.parseInt(seq)))
                .jsonPath("$.cuentas[?(@.nombre == 'Davivienda')].seqCuadre").isEqualTo(List.of(0));
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec cuadrar(String sesion, Map<String, Long> saldos) {
        return post(sesion, "/api/cuentas/cuadre", Map.of("saldos", saldos.entrySet().stream()
                .map(e -> Map.of("cuentaId", e.getKey(), "saldoBanco", e.getValue())).toList()));
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec pagarDesde(String item, long monto, String cuentaId) {
        return post(daniel, "/api/pagos", pagoDesde(item, monto, cuentaId));
    }

    private Map<String, Object> pagoDesde(String item, long monto, String cuentaId) {
        Map<String, Object> m = new HashMap<>();
        m.put("itemId", item);
        m.put("monto", monto);
        m.put("usuarioId", idDaniel);
        m.put("origen", Map.of("tipo", "CUENTA", "cuentaId", cuentaId));
        return m;
    }
}
