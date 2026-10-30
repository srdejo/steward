package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

/**
 * Spec steward-finanzas: "Regla de diezmo propia", "Ingresos fijos propios", "Cuentas basicas" y "Finanzas del hogar en
 * una lectura".
 */
class FinanzasContratoTest extends ContratoBase {

    private String daniel;
    private String esposa;

    @BeforeEach
    void hogar() {
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
    }

    // --- Regla de diezmo propia ---

    @Test
    void guardarLaRegla() {
        put(esposa, "/api/regla-diezmo", regla(true, 5, "NETO", true)).expectStatus().isOk();
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk()
                .expectBody()
                .jsonPath("$.porcentaje").isEqualTo(10)
                .jsonPath("$.base").isEqualTo("BRUTO")
                .jsonPath("$.aplicaAportes").isEqualTo(false);
        // La de Esposa no cambio.
        get(daniel, "/api/finanzas").expectBody()
                .jsonPath("$.reglas.length()").isEqualTo(2)
                .jsonPath("$.reglas[?(@.base == 'NETO')].porcentaje").isEqualTo(5);
    }

    @Test
    void porcentajeInvalido() {
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        for (Object malo : new Object[]{0, 120, 10.125}) {
            put(daniel, "/api/regla-diezmo", regla(true, malo, "BRUTO", false)).expectStatus().isBadRequest()
                    .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        }
        put(daniel, "/api/regla-diezmo", regla(true, 10, "OTRA", false)).expectStatus().isBadRequest();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.reglas[0].porcentaje").isEqualTo(10);
    }

    // --- Ingresos fijos propios ---

    @Test
    void crearElSalario() {
        post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)).expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.nombre").isEqualTo("Salario Daniel")
                .jsonPath("$.activo").isEqualTo(true);
        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.ingresosFijos.length()").isEqualTo(1)
                .jsonPath("$.ingresosFijos[0].nombre").isEqualTo("Salario Daniel")
                .jsonPath("$.ingresosFijos[0].bruto").isEqualTo(7_000_000)
                .jsonPath("$.ingresosFijos[0].neto").isEqualTo(6_288_000)
                .jsonPath("$.ingresosFijos[0].diaPago").isEqualTo(25);
    }

    @Test
    void brutoMenorQueElNetoYOtrosDatosInvalidos() {
        post(daniel, "/api/ingresos-fijos", salario(5_000_000, 6_000_000)).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        Map<String, Object> sinNombre = salario(7_000_000, 6_288_000);
        sinNombre.put("nombre", " ");
        post(daniel, "/api/ingresos-fijos", sinNombre).expectStatus().isBadRequest();
        Map<String, Object> dia32 = salario(7_000_000, 6_288_000);
        dia32.put("diaPago", 32);
        post(daniel, "/api/ingresos-fijos", dia32).expectStatus().isBadRequest();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.ingresosFijos.length()").isEqualTo(0);
    }

    @Test
    void editarYQuitarSoloLosPropios() {
        String id = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");

        put(esposa, "/api/ingresos-fijos/{id}", salario(1, 1), id).expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("INGRESO_NO_ENCONTRADO");
        delete(esposa, "/api/ingresos-fijos/{id}", id).expectStatus().isNotFound();

        put(daniel, "/api/ingresos-fijos/{id}", salario(7_000_000, 6_500_000), id).expectStatus().isOk()
                .expectBody().jsonPath("$.neto").isEqualTo(6_500_000);
        delete(daniel, "/api/ingresos-fijos/{id}", id).expectStatus().isNoContent();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.ingresosFijos.length()").isEqualTo(0);
        // Quitado: ya no se edita.
        put(daniel, "/api/ingresos-fijos/{id}", salario(7_000_000, 6_288_000), id).expectStatus().isNotFound();
    }

    // --- Cuentas basicas ---

    @Test
    void cuentasDelOnboarding() {
        String davivienda = valorDe(post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated(), "id");
        post(daniel, "/api/cuentas", cuenta("Efectivo", "CONJUNTA", 200_000)).expectStatus().isCreated();

        get(esposa, "/api/finanzas").expectBody()
                .jsonPath("$.cuentas.length()").isEqualTo(2)
                .jsonPath("$.cuentas[0].nombre").isEqualTo("Davivienda")
                .jsonPath("$.cuentas[0].saldoCuadre").isEqualTo(4_000_000)
                .jsonPath("$.cuentas[0].cuadrada").isEqualTo(false)
                .jsonPath("$.cuentas[0].titularId").isNotEmpty()
                .jsonPath("$.cuentas[1].nombre").isEqualTo("Efectivo")
                .jsonPath("$.cuentas[1].titularId").doesNotExist();

        // El ingreso puede apuntar a una cuenta del hogar.
        Map<String, Object> conCuenta = salario(7_000_000, 6_288_000);
        conCuenta.put("cuentaId", davivienda);
        post(daniel, "/api/ingresos-fijos", conCuenta).expectStatus().isCreated()
                .expectBody().jsonPath("$.cuentaId").isEqualTo(davivienda);
    }

    @Test
    void cuentaSinNombreOConSaldoNegativo() {
        post(daniel, "/api/cuentas", cuenta("", "YO", 0)).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
        post(daniel, "/api/cuentas", cuenta("Nu", "YO", -1)).expectStatus().isBadRequest();
        get(daniel, "/api/finanzas").expectBody().jsonPath("$.cuentas.length()").isEqualTo(0);
    }

    // --- Finanzas del hogar en una lectura ---

    @Test
    void loQueVeEsposa() {
        put(daniel, "/api/regla-diezmo", regla(true, 10, "BRUTO", false)).expectStatus().isOk();
        post(daniel, "/api/cuentas", cuenta("Davivienda", "YO", 4_000_000)).expectStatus().isCreated();
        String id = valorDe(post(daniel, "/api/ingresos-fijos", salario(7_000_000, 6_288_000)), "id");
        post(daniel, "/api/ingresos-fijos/{id}/recibido", Map.of(), id).expectStatus().isCreated();

        get(esposa, "/api/finanzas").expectStatus().isOk().expectBody()
                .jsonPath("$.mes.anio").isNumber()
                .jsonPath("$.ingresosFijos[0].nombre").isEqualTo("Salario Daniel")
                .jsonPath("$.reglas.length()").isEqualTo(1)
                .jsonPath("$.reglas[0].porcentaje").isEqualTo(10)
                .jsonPath("$.cuentas[0].nombre").isEqualTo("Davivienda")
                .jsonPath("$.movimientos.length()").isEqualTo(1)
                .jsonPath("$.movimientos[0].tipo").isEqualTo("INGRESO_FIJO")
                .jsonPath("$.movimientos[0].monto").isEqualTo(6_288_000)
                .jsonPath("$.movimientos[0].ingresoFijoId").isEqualTo(id);
    }

    @Test
    void sinHogar() {
        String solo = entrar("solo@ejemplo.com", "Solo");
        get(solo, "/api/finanzas").expectStatus().isNotFound().expectBody().jsonPath("$.codigo").isEqualTo("SIN_HOGAR");
    }

    static Map<String, Object> regla(boolean activa, Object porcentaje, String base, boolean aplicaAportes) {
        return Map.of("activa", activa, "porcentaje", porcentaje, "base", base, "aplicaAportes", aplicaAportes);
    }

    static Map<String, Object> salario(long bruto, long neto) {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", "Salario Daniel");
        m.put("bruto", bruto);
        m.put("neto", neto);
        m.put("diaPago", 25);
        return m;
    }

    static Map<String, Object> cuenta(String nombre, String titular, long saldo) {
        return Map.of("nombre", nombre, "titular", titular, "saldo", saldo);
    }
}
