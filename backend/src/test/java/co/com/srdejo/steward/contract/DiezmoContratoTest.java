package co.com.srdejo.steward.contract;

import co.com.srdejo.steward.domain.usecase.CalculoDiezmo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.regla;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;

/**
 * Spec steward-finanzas: "Recibir un ingreso fijo", "Obligaciones de diezmo" y "Entregar el diezmo", con las cifras del
 * dominio compartido. El mes y la fecha son los de hoy en el backend (America/Bogota, design D4).
 */
class DiezmoContratoTest extends ContratoBase {

    private String daniel;
    private String esposa;
    private String salarioId;

    @BeforeEach
    void hogar() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        salarioId = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");
    }

    @Test
    void salarioRecibido() {
        // Lo marca cualquier miembro; el dueno sigue siendo Daniel.
        post(esposa, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.tipo").isEqualTo("INGRESO_FIJO")
                .jsonPath("$.monto").isEqualTo(6_288_000)
                .jsonPath("$.bruto").isEqualTo(7_000_000)
                .jsonPath("$.fecha").isEqualTo(hoy().toString())
                .jsonPath("$.aplicaDiezmo").isEqualTo(true);
    }

    @Test
    void recibidoDosVeces() {
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated();
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("YA_RECIBIDO");
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.movimientos.length()").isEqualTo(1);
    }

    @Test
    void ingresoQuitadoNoSeRecibe() {
        delete(daniel, "/api/ingresos-fijos/{id}", salarioId).expectStatus().isNoContent();
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("INGRESO_NO_ENCONTRADO");
    }

    @Test
    void diezmoDelSalario() {
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated();
        get(esposa, "/api/diezmo/pendientes").expectStatus().isOk().expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].monto").isEqualTo(700_000)
                .jsonPath("$[0].detalle").isEqualTo("10% de Salario Daniel · recibido " + CalculoDiezmo.fechaCorta(hoy()));
    }

    @Test
    void baseNeto() {
        put(daniel, "/api/regla-diezmo", regla(true, 10, "NETO", false)).expectStatus().isOk();
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated();
        get(daniel, "/api/diezmo/pendientes").expectBody().jsonPath("$[0].monto").isEqualTo(628_800);
    }

    @Test
    void sinRegla() {
        Map<String, Object> suyo = salario(3_000_000, 3_000_000);
        suyo.put("nombre", "Salario Esposa");
        String id = valorDe(post(esposa, "/api/ingresos-fijos", suyo), "id");
        post(esposa, "/api/ingresos-fijos/{id}/recibido", Map.of(), id).expectStatus().isCreated()
                .expectBody().jsonPath("$.aplicaDiezmo").isEqualTo(false);
        get(esposa, "/api/diezmo/pendientes").expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void reglaInactivaAlRecibirNoGeneraDiezmo() {
        put(daniel, "/api/regla-diezmo", regla(false, 10, "BRUTO", false)).expectStatus().isOk();
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated()
                .expectBody().jsonPath("$.aplicaDiezmo").isEqualTo(false);
        get(daniel, "/api/diezmo/pendientes").expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void entregado() {
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated();
        String obligacion = obligaciones(daniel).getFirst();
        entregar(daniel, List.of(obligacion)).expectStatus().isCreated().expectBody()
                .jsonPath("$.tipo").isEqualTo("DIEZMO_ENTREGADO")
                .jsonPath("$.monto").isEqualTo(700_000)
                .jsonPath("$.diezmoDe[0]").isEqualTo(obligacion);
        get(esposa, "/api/diezmo/pendientes").expectBody().jsonPath("$.length()").isEqualTo(0);
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos.length()").isEqualTo(2)
                .jsonPath("$.movimientos[1].diezmoDe[0]").isEqualTo(obligacion);
    }

    @Test
    void agrupado() {
        // Esposa tambien diezma: 10 % de su ingreso de $1.500.000 = $150.000.
        put(esposa, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        Map<String, Object> suyo = salario(1_500_000, 1_500_000);
        suyo.put("nombre", "Salario Esposa");
        String id = valorDe(post(esposa, "/api/ingresos-fijos", suyo), "id");
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated();
        post(esposa, "/api/ingresos-fijos/{id}/recibido", Map.of(), id).expectStatus().isCreated();

        entregar(daniel, obligaciones(daniel)).expectStatus().isCreated().expectBody()
                .jsonPath("$.monto").isEqualTo(850_000)
                .jsonPath("$.diezmoDe.length()").isEqualTo(2);
        get(daniel, "/api/diezmo/pendientes").expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void yaEntregado() {
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioId).expectStatus().isCreated();
        List<String> ids = obligaciones(daniel);
        entregar(daniel, ids).expectStatus().isCreated();
        entregar(daniel, ids).expectStatus().isEqualTo(409).expectBody().jsonPath("$.codigo").isEqualTo("SIN_DIEZMO");
        entregar(daniel, List.of()).expectStatus().isEqualTo(409);
    }

    private List<String> obligaciones(String sesion) {
        List<?> lista = get(sesion, "/api/diezmo/pendientes").expectStatus().isOk()
                .expectBody(List.class).returnResult().getResponseBody();
        return lista.stream().map(o -> (String) ((Map<?, ?>) o).get("id")).toList();
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec entregar(String sesion, List<String> ids) {
        Map<String, Object> cuerpo = new HashMap<>();
        cuerpo.put("obligaciones", ids);
        return post(sesion, "/api/diezmo/entregas", cuerpo);
    }

    private static LocalDate hoy() {
        return LocalDate.now(ZoneId.of("America/Bogota"));
    }
}
