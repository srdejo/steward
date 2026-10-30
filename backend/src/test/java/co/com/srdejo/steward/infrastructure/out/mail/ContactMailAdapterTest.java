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
