package co.com.srdejo.steward.contract;

import co.com.srdejo.steward.domain.usecase.FirmaAviso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Spec steward-avisos, "API de avisos" y "Avisos · Configurar" (avisos-pagos): solo sobre el hogar de la sesion; la
 * accion de un aviso va sin sesion con su identificador firmado, y uno alterado o vencido no registra nada.
 */
class AvisosContratoTest extends ContratoBase {

    static final YearMonth MES = YearMonth.now(ZoneId.of("America/Bogota"));
    static final LocalDate HOY = LocalDate.now(ZoneId.of("America/Bogota"));
    /** El secreto del perfil contract (application-contract.yml). */
    static final FirmaAviso FIRMA = new FirmaAviso("contract-only-avisos-secret-0123456789abcdef");

    private final PlanContratoTest plan = new PlanContratoTest();
    private String daniel;
    private String esposa;

    @BeforeEach
    void hogar() {
        plan.client = client;
        daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        esposa = unirA(daniel, "esposa@ejemplo.com", "Esposa");
    }

    private String hogarDe(String sesion) {
        Map<?, ?> h = get(sesion, "/api/hogar").expectBody(Map.class).returnResult().getResponseBody();
        return (String) h.get("id");
    }

    private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec accion(String token, String que) {
        return client.post().uri("/api/avisos/accion").contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("accion", token, "que", que)).exchange();
    }

    @Test
    void proximosDelHogarConElPagoYSuDestino() {
        Map<?, ?> p = plan.crearPlan(daniel, MES, "CERO");
        plan.item(daniel, p, PlanContratoTest.escenario(p), "Recibo Luz", 50_000, "FIJO", plan.categoria(daniel, "Gastos fijos"), null, null);
        List<?> avisos = get(esposa, "/api/avisos/proximos").expectStatus().isOk().expectBody(List.class).returnResult().getResponseBody();
        Map<?, ?> luz = avisos.stream().map(a -> (Map<?, ?>) a).filter(a -> "Recibo Luz".equals(a.get("nombre"))).findFirst().orElseThrow();
        assertEquals("PAGO", luz.get("tipo"));
        assertEquals(50_000, ((Number) luz.get("monto")).intValue());
        assertEquals(Map.of("anio", MES.getYear(), "mes", MES.getMonthValue()), ((Map<?, ?>) luz.get("pago")).get("ref"));
        // Cerrar el mes lleva a su cierre.
        assertTrue(avisos.stream().map(a -> (Map<?, ?>) a).anyMatch(a -> a.get("nombre").toString().startsWith("Cerrar ")
                && "CIERRE".equals(((Map<?, ?>) a.get("destino")).get("tipo"))));
    }

    @Test
    void preferenciasDeCadaPersona() {
        get(daniel, "/api/avisos/preferencias").expectBody()
                .jsonPath("$.tiposApagados").isEmpty().jsonPath("$.correo").isEqualTo(true).jsonPath("$.noMolestar").isEqualTo(true);
        put(esposa, "/api/avisos/preferencias", Map.of("tiposApagados", List.of("TARJETA"), "correo", false, "noMolestar", true))
                .expectStatus().isOk().expectBody().jsonPath("$.tiposApagados[0]").isEqualTo("TARJETA");
        get(esposa, "/api/avisos/preferencias").expectBody().jsonPath("$.tiposApagados[0]").isEqualTo("TARJETA").jsonPath("$.correo").isEqualTo(false);
        // Lo de Esposa no cambia lo de Daniel.
        get(daniel, "/api/avisos/preferencias").expectBody().jsonPath("$.tiposApagados").isEmpty();
        put(daniel, "/api/avisos/preferencias", Map.of("tiposApagados", List.of("NADA"), "correo", true, "noMolestar", true))
                .expectStatus().isBadRequest();
    }

    @Test
    void dispositivosPruebaYTokenInvalido() {
        post(daniel, "/api/avisos/prueba", Map.of()).expectStatus().isBadRequest()
                .expectBody().jsonPath("$.mensaje").isEqualTo("Activa las notificaciones en este dispositivo");
        post(daniel, "/api/avisos/dispositivos", Map.of("tipo", "EXPO", "token", "otro")).expectStatus().isBadRequest();
        post(daniel, "/api/avisos/dispositivos", Map.of("tipo", "WEB", "endpoint", "https://push.ejemplo/1")).expectStatus().isBadRequest();
        // Expo reporta este token como no registrado: se quita al primer envio.
        post(daniel, "/api/avisos/dispositivos", Map.of("tipo", "EXPO", "token", "ExponentPushToken[invalido]")).expectStatus().isNoContent();
        post(daniel, "/api/avisos/prueba", Map.of()).expectStatus().isNoContent();
        post(daniel, "/api/avisos/prueba", Map.of()).expectStatus().isBadRequest();
        // Uno valido y quitarlo al cerrar sesion.
        post(daniel, "/api/avisos/dispositivos", Map.of("tipo", "EXPO", "token", "ExponentPushToken[iphone]")).expectStatus().isNoContent();
        post(daniel, "/api/avisos/prueba", Map.of()).expectStatus().isNoContent();
        post(daniel, "/api/avisos/dispositivos/quitar", Map.of("token", "ExponentPushToken[iphone]")).expectStatus().isNoContent();
        post(daniel, "/api/avisos/prueba", Map.of()).expectStatus().isBadRequest();
        get(daniel, "/api/avisos/clave-web").expectStatus().isOk().expectBody().jsonPath("$.clave").isNotEmpty();
    }

    @Test
    void yaLoPagueDesdeElAvisoSinSesionYSinRepetir() {
        Map<?, ?> p = plan.crearPlan(daniel, MES, "CERO");
        String luz = plan.item(daniel, p, PlanContratoTest.escenario(p), "Recibo Luz", 50_000, "FIJO", plan.categoria(daniel, "Gastos fijos"), null, null);
        UUID u = UUID.fromString(plan.idDe(daniel));
        UUID h = UUID.fromString(hogarDe(daniel));
        String token = FIRMA.firmar(new FirmaAviso.Accion(u, h, UUID.fromString(luz), MES, "PAGO:" + luz + ":" + MES, HOY.plusDays(7)));
        accion(token, "PAGADO").expectStatus().isNoContent();
        // Una segunda vez (o el aviso viejo de otro) no crea otro pago.
        accion(token, "PAGADO").expectStatus().isNoContent();
        List<?> movs = (List<?>) get(esposa, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody().get("movimientos");
        long pagos = movs.stream().map(m -> (Map<?, ?>) m).filter(m -> "PAGO".equals(m.get("tipo")) && luz.equals(m.get("itemId"))).count();
        assertEquals(1, pagos);
        Map<?, ?> pago = movs.stream().map(m -> (Map<?, ?>) m).filter(m -> luz.equals(m.get("itemId"))).findFirst().orElseThrow();
        assertEquals(50_000, ((Number) pago.get("monto")).intValue());
        assertEquals(u.toString(), pago.get("usuarioId"));
    }

    @Test
    void identificadorAlteradoOVencidoNoRegistraNada() {
        Map<?, ?> p = plan.crearPlan(daniel, MES, "CERO");
        String luz = plan.item(daniel, p, PlanContratoTest.escenario(p), "Recibo Luz", 50_000, "FIJO", plan.categoria(daniel, "Gastos fijos"), null, null);
        UUID u = UUID.fromString(plan.idDe(daniel));
        UUID h = UUID.fromString(hogarDe(daniel));
        String bueno = FIRMA.firmar(new FirmaAviso.Accion(u, h, UUID.fromString(luz), MES, "PAGO:" + luz, HOY.plusDays(7)));
        // Otro item en el cuerpo con la firma vieja.
        String otro = new FirmaAviso("otro-secreto-de-al-menos-16").firmar(new FirmaAviso.Accion(u, h, UUID.randomUUID(), MES, "x", HOY.plusDays(7)));
        String alterado = otro.substring(0, otro.indexOf('.')) + bueno.substring(bueno.indexOf('.'));
        accion(alterado, "PAGADO").expectStatus().isNotFound();
        String vencido = FIRMA.firmar(new FirmaAviso.Accion(u, h, UUID.fromString(luz), MES, "PAGO:" + luz, HOY.minusDays(1)));
        accion(vencido, "PAGADO").expectStatus().isNotFound();
        accion("basura", "MANANA").expectStatus().isNotFound();
        // Desde el navegador (service worker) la accion llega por GET.
        client.get().uri("/api/avisos/accion?accion={a}&que=PAGADO", vencido).exchange().expectStatus().isNotFound();
        List<?> movs = (List<?>) get(daniel, "/api/finanzas").expectBody(Map.class).returnResult().getResponseBody().get("movimientos");
        assertTrue(movs.stream().map(m -> (Map<?, ?>) m).noneMatch(m -> luz.equals(m.get("itemId"))));
        // Recordar mañana con uno bueno se acepta.
        accion(bueno, "MANANA").expectStatus().isNoContent();
        client.get().uri("/api/avisos/accion?accion={a}&que=MANANA", bueno).exchange().expectStatus().isNoContent();
    }

    @Test
    void sinSesionNoHayNadaMasQueLaAccion() {
        client.get().uri("/api/avisos/proximos").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/avisos/prueba").exchange().expectStatus().isUnauthorized();
    }
}
