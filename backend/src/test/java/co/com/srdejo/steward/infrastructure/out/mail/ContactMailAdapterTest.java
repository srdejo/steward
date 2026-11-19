package co.com.srdejo.steward.infrastructure.out.mail;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.test.StepVerifier;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

/** Los correos salen por POST /api/send de contact (design D7); se prueba contra un servidor HTTP falso. */
class ContactMailAdapterTest {

    private HttpServer servidor;
    private final AtomicReference<String> recibido = new AtomicReference<>();
    private volatile int estado = 200;
    private volatile long demoraMs = 0;

    @BeforeEach
    void levantar() throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/api/send", exchange -> {
            recibido.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            try {
                Thread.sleep(demoraMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            exchange.sendResponseHeaders(estado, -1);
            exchange.close();
        });
        servidor.start();
    }

    @AfterEach
    void bajar() {
        servidor.stop(0);
    }

    private ContactMailAdapter adapter() {
        return new ContactMailAdapter(WebClient.builder(), "http://127.0.0.1:" + servidor.getAddress().getPort() + "/");
    }

    @Test
    void enviaInvitacionAContact() {
        StepVerifier.create(adapter().enviarInvitacion("esposa@ejemplo.com", "Daniel", "Nuestra casa",
                        "http://steward.test/invitacion/abc"))
                .verifyComplete();
        String body = recibido.get();
        for (String esperado : new String[]{"\"to\":\"esposa@ejemplo.com\"", "Daniel te invit", "Nuestra casa",
                "http://steward.test/invitacion/abc", "\"fromName\":\"Presupuesto Hogar\""}) {
            if (!body.contains(esperado)) {
                throw new AssertionError("Falta " + esperado + " en " + body);
            }
        }
    }

    @Test
    void resumenDeAvisosConLaPlantillaLibretaClara() {
        StepVerifier.create(adapter().enviarResumenAvisos("daniel@ejemplo.com", "Daniel", java.util.List.of(
                        new co.com.srdejo.steward.domain.model.FilaResumenAviso("20 oct", "Compra a cuotas", "Cuota 4 de 12 · hace 6 días", 375_000, true),
                        new co.com.srdejo.steward.domain.model.FilaResumenAviso("28 oct", "Nu · Mercado", "En 2 días", 320_000, false),
                        new co.com.srdejo.steward.domain.model.FilaResumenAviso("30 oct", "Mastercard", "En 4 días", 1_500_000, false)),
                2_195_000, "https://steward.test/avisos"))
                .verifyComplete();
        String body = recibido.get();
        for (String esperado : new String[]{"Esta semana: 3 pagos · $2.195.000", "Pagos de la semana", "Compra a cuotas", "$1.500.000",
                "#F6F5F1", "#1F4D3B", "Space Grotesk", "https://steward.test/avisos", "Uno ya se venció"}) {
            if (!body.contains(esperado)) {
                throw new AssertionError("Falta " + esperado + " en " + body);
            }
        }
    }

    @Test
    void escapaElHtml() {
        adapter().enviarInvitacion("x@ejemplo.com", "<b>Dani</b>", "Casa", "http://steward.test/invitacion/abc").block();
        // El asunto es texto plano (una aparicion literal); en el cuerpo HTML el nombre llega escapado.
        String body = recibido.get();
        int literales = body.split("<b>Dani</b>", -1).length - 1;
        if (literales != 1 || !body.contains("&lt;b&gt;Dani&lt;/b&gt; te invit")) {
            throw new AssertionError("El nombre no se escapo en el HTML: " + body);
        }
    }

    @Test
    void errorDeContactPropagaElFallo() {
        estado = 500;
        StepVerifier.create(adapter().enviarInvitacion("x@ejemplo.com", "D", "Casa", "http://e/invitacion/a"))
                .verifyError();
    }

    @Test
    void contactLentoCortaPorTimeout() {
        demoraMs = ContactMailAdapter.TIMEOUT.toMillis() + 1500;
        StepVerifier.create(adapter().enviarInvitacion("x@ejemplo.com", "D", "Casa", "http://e/invitacion/a"))
                .verifyError(java.util.concurrent.TimeoutException.class);
    }
}
