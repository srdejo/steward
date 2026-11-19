package co.com.srdejo.steward.infrastructure.out.push;

import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.MensajeAviso;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Los recibos de Expo (tarea 2.7 de avisos-pagos): el ticket solo dice que Expo recibio el envio; 15 minutos despues, el
 * recibo dice si llego. {@code DeviceNotRegistered} en el recibo devuelve el token para quitarlo. Un servidor local hace
 * de Expo.
 */
class RecibosExpoTest {

    private HttpServer expo;
    private final List<String> pedidosRecibos = new ArrayList<>();
    private int siguiente;
    /** El reloj del adaptador, que las pruebas adelantan. */
    private Instant ahora = Instant.parse("2026-11-19T13:00:00Z");

    @BeforeEach
    void iniciar() throws Exception {
        expo = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        expo.createContext("/send", ex -> {
            ex.getRequestBody().readAllBytes();
            responder(ex, "{\"data\":{\"status\":\"ok\",\"id\":\"ticket-" + (++siguiente) + "\"}}");
        });
        expo.createContext("/getReceipts", ex -> {
            String cuerpo = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            pedidosRecibos.add(cuerpo);
            // El ticket 1 llego; el 2 es de un iPhone que ya no esta registrado.
            responder(ex, "{\"data\":{\"ticket-1\":{\"status\":\"ok\"},\"ticket-2\":{\"status\":\"error\",\"message\":\"no registrado\","
                    + "\"details\":{\"error\":\"DeviceNotRegistered\"}}}}");
        });
        expo.start();
    }

    @AfterEach
    void parar() {
        expo.stop(0);
    }

    private static void responder(com.sun.net.httpserver.HttpExchange ex, String json) throws java.io.IOException {
        byte[] b = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(200, b.length);
        ex.getResponseBody().write(b);
        ex.close();
    }

    private EnvioPushAdapter adaptador() {
        Clock reloj = new Clock() {
            public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId z) { return this; }
            public Instant instant() { return ahora; }
        };
        return new EnvioPushAdapter(WebClient.builder(), null, null, null, null, "http://127.0.0.1:" + expo.getAddress().getPort(), reloj);
    }

    private static DispositivoAviso iphone(String token) {
        return new DispositivoAviso(UUID.randomUUID(), UUID.randomUUID(), DispositivoAviso.Tipo.EXPO, token, null, null);
    }

    @Test
    void elReciboDeviceNotRegisteredDevuelveSuTokenYLosLeidosSalen() {
        EnvioPushAdapter a = adaptador();
        MensajeAviso m = new MensajeAviso("Mastercard", "Mañana · $1.500.000", "pago", Map.of());
        assertFalse(a.enviar(iphone("ExponentPushToken[bueno]"), m).block());
        assertFalse(a.enviar(iphone("ExponentPushToken[viejo]"), m).block());
        assertEquals(2, a.recibosPendientes());
        // Antes de 15 minutos no se piden.
        ahora = ahora.plus(Duration.ofMinutes(10));
        assertEquals(List.of(), a.tokensInvalidosPorRecibos().block());
        assertTrue(pedidosRecibos.isEmpty());
        // A los 15 minutos, un solo pedido con los dos tickets.
        ahora = ahora.plus(Duration.ofMinutes(5));
        assertEquals(List.of("ExponentPushToken[viejo]"), a.tokensInvalidosPorRecibos().block());
        assertEquals(1, pedidosRecibos.size());
        assertTrue(pedidosRecibos.getFirst().contains("ticket-1") && pedidosRecibos.getFirst().contains("ticket-2"));
        // Los leidos ya no se vuelven a pedir.
        assertEquals(0, a.recibosPendientes());
        assertEquals(List.of(), a.tokensInvalidosPorRecibos().block());
        assertEquals(1, pedidosRecibos.size());
    }

    @Test
    void unTicketDeMasDe24HorasSeDescarta() {
        EnvioPushAdapter a = adaptador();
        a.enviar(iphone("ExponentPushToken[x]"), new MensajeAviso("t", "c", null, Map.of())).block();
        ahora = ahora.plus(Duration.ofHours(25));
        assertEquals(List.of(), a.tokensInvalidosPorRecibos().block());
        assertEquals(0, a.recibosPendientes());
        assertTrue(pedidosRecibos.isEmpty());
    }
}
