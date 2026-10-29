package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.contract.FinanzasContratoTest.cuenta;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.regla;
import static co.com.srdejo.steward.contract.FinanzasContratoTest.salario;

/** Spec steward-finanzas, "Aislamiento de las finanzas": dos hogares que no se ven. */
class FinanzasAislamientoContratoTest extends ContratoBase {

    private String daniel;
    private String otro;
    private String salarioDaniel;

    @BeforeEach
    void dosHogares() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        salarioDaniel = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");

        otro = entrar("otro@ejemplo.com", "Otro");
        crearHogar(otro, "Otra casa").expectStatus().isCreated();
    }

    @Test
    void ingresoDeOtroHogar() {
        post(otro, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioDaniel).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("INGRESO_NO_ENCONTRADO");
        put(otro, "/api/ingresos-fijos/{id}", salario(1, 1), salarioDaniel).expectStatus().isNotFound();
        delete(otro, "/api/ingresos-fijos/{id}", salarioDaniel).expectStatus().isNotFound();
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.movimientos.length()").isEqualTo(0)
                .jsonPath("$.ingresosFijos[0].neto").isEqualTo(6_288_000);
        get(otro, "/api/finanzas").expectBody()
                .jsonPath("$.ingresosFijos.length()").isEqualTo(0)
                .jsonPath("$.reglas.length()").isEqualTo(0);
    }

    @Test
    void entregarDiezmoAjeno() {
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), salarioDaniel).expectStatus().isCreated();
        List<?> pendientes = get(daniel, "/api/diezmo/pendientes").expectBody(List.class).returnResult().getResponseBody();
        String obligacion = (String) ((Map<?, ?>) pendientes.getFirst()).get("id");

        get(otro, "/api/diezmo/pendientes").expectBody().jsonPath("$.length()").isEqualTo(0);
        Map<String, Object> cuerpo = new HashMap<>();
        cuerpo.put("obligaciones", List.of(obligacion));
        post(otro, "/api/diezmo/entregas", cuerpo).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.codigo").isEqualTo("SIN_DIEZMO");
        get(daniel, "/api/diezmo/pendientes").expectBody().jsonPath("$[0].id").isEqualTo(obligacion);
    }

    @Test
    void cuentaDeOtroHogarComoCuentaDelIngreso() {
        String cuentaDaniel = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)), "id");
        Map<String, Object> conCuentaAjena = salario(2_000_000, 2_000_000);
        conCuentaAjena.put("cuentaId", cuentaDaniel);
        post(otro, "/api/ingresos-fijos", conCuentaAjena).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("CUENTA_NO_ENCONTRADA");
        get(otro, "/api/finanzas").expectBody()
                .jsonPath("$.cuentas.length()").isEqualTo(0)
                .jsonPath("$.ingresosFijos.length()").isEqualTo(0);
    }

    @Test
    void sinSesionTodoDa401() {
        String id = salarioDaniel;
        client.get().uri("/api/finanzas").exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/diezmo/pendientes").exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/regla-diezmo").bodyValue(regla(true, 10, "BRUTO", false)).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/ingresos-fijos").bodyValue(salario(1, 1)).exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/ingresos-fijos/{id}", id).bodyValue(salario(1, 1)).exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/ingresos-fijos/{id}", id).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/ingresos-fijos/{id}/recibido", id).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/diezmo/entregas").bodyValue(Map.of()).exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/hogar/diezmo-en-hoy").bodyValue(Map.of("modo", "AGRUPADO")).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/cuentas").bodyValue(cuenta("Nu", "YO", 1)).exchange().expectStatus().isUnauthorized();
    }
}
