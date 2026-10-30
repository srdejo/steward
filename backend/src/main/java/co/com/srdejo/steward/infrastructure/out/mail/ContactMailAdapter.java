package co.com.srdejo.steward.infrastructure.out.mail;

import co.com.srdejo.steward.domain.spi.IMailPort;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.HtmlUtils;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

/**
 * Envia los correos por la API interna {@code contact} del workspace ({@code POST /api/send}, solo loopback). Steward no
 * tiene SMTP ni credenciales de correo: {@code contact} es quien entrega (design D7).
 */
public class ContactMailAdapter implements IMailPort {

    static final Duration TIMEOUT = Duration.ofSeconds(5);
    static final String FROM_NAME = "Presupuesto Hogar";
    private static final String BRAND = "#2F5D50";

    private final WebClient client;

    public ContactMailAdapter(WebClient.Builder builder, String contactApiUrl) {
        this.client = builder.baseUrl(stripSlash(contactApiUrl)).build();
    }

    @Override
    public Mono<Void> enviarInvitacion(String para, String quienInvita, String hogar, String enlace) {
        String html = "<div style=\"font-family:Inter,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto;color:#1F2421\">"
                + "<h2 style=\"color:" + BRAND + "\">" + escape(quienInvita) + " te invitó a " + escape(hogar) + "</h2>"
                + "<p>Presupuesto Hogar es donde planean juntos el mes: lo que entra, lo que se paga y lo que queda libre.</p>"
                + "<p><a href=\"" + escape(enlace) + "\" style=\"display:inline-block;background:" + BRAND
                + ";color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600\">Unirme al hogar</a></p>"
                + "<p style=\"color:#5B6663;font-size:13px\">El enlace vence en 7 días y sirve una sola vez. "
                + "Si no esperabas esta invitación, ignora este correo.</p></div>";
        return client.post()
                .uri("/api/send")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("to", para, "subject", quienInvita + " te invitó a " + hogar + " · Presupuesto Hogar",
                        "html", html, "fromName", FROM_NAME))
                .retrieve()
                .toBodilessEntity()
                .timeout(TIMEOUT)
                .then();
    }

    private static String escape(String value) {
        return value == null ? "" : HtmlUtils.htmlEscape(value);
    }

    private static String stripSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
