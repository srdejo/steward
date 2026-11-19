package co.com.srdejo.steward.infrastructure.out.mail;

import co.com.srdejo.steward.domain.model.FilaResumenAviso;
import co.com.srdejo.steward.domain.spi.IMailPort;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static co.com.srdejo.steward.infrastructure.out.mail.PlantillaCorreo.boton;
import static co.com.srdejo.steward.infrastructure.out.mail.PlantillaCorreo.cop;
import static co.com.srdejo.steward.infrastructure.out.mail.PlantillaCorreo.e;
import static co.com.srdejo.steward.infrastructure.out.mail.PlantillaCorreo.marco;
import static co.com.srdejo.steward.infrastructure.out.mail.PlantillaCorreo.parrafo;

/**
 * Envia los correos por la API interna {@code contact} del workspace ({@code POST /api/send}, solo loopback). Steward no
 * tiene SMTP ni credenciales de correo: {@code contact} es quien entrega (design D7). Todos usan la plantilla Libreta
 * clara ({@link PlantillaCorreo}).
 */
public class ContactMailAdapter implements IMailPort {

    static final Duration TIMEOUT = Duration.ofSeconds(5);
    static final String FROM_NAME = "Presupuesto Hogar";

    private final WebClient client;
    /** El logo de la app (el icono de la PWA) para el encabezado de los correos. */
    private final String logo;

    public ContactMailAdapter(WebClient.Builder builder, String contactApiUrl) {
        this(builder, contactApiUrl, "https://steward.srdejo.com.co");
    }

    public ContactMailAdapter(WebClient.Builder builder, String contactApiUrl, String publicUrl) {
        this.client = builder.baseUrl(stripSlash(contactApiUrl)).build();
        this.logo = stripSlash(publicUrl) + "/icons/apple-touch-icon.png";
    }

    @Override
    public Mono<Void> enviarInvitacion(String para, String quienInvita, String hogar, String enlace) {
        String contenido = parrafo("Presupuesto Hogar es donde planean juntos el mes: lo que entra, lo que se paga y lo que queda libre.")
                + boton("Unirme al hogar", enlace);
        String pie = "El enlace vence en 7 días y sirve una sola vez. Si no esperabas esta invitación, ignora este correo.";
        String html = marco(logo, "Únete a " + hogar + " en Presupuesto Hogar", quienInvita + " te invitó a " + hogar, contenido, e(pie));
        return enviar(para, quienInvita + " te invitó a " + hogar + " · Presupuesto Hogar", html);
    }

    @Override
    public Mono<Void> enviarResumenAvisos(String para, String nombre, List<FilaResumenAviso> filas, long total, String enlace) {
        long vencidos = filas.stream().filter(FilaResumenAviso::vencido).count();
        String intro = filas.size() == 1 ? "Esta semana tienen 1 pago." : "Esta semana tienen " + filas.size() + " pagos.";
        if (vencidos > 0) intro += vencidos == 1 ? " Uno ya se venció." : " " + vencidos + " ya se vencieron.";
        String contenido = parrafo(e("Hola, " + nombre + ". " + intro)) + PlantillaCorreo.filas(filas, total) + boton("Ver avisos", enlace);
        String pie = "Te llega cada lunes a las 7:30 con los pagos de la semana. Lo apagas en Avisos · Configurar.";
        String asunto = "Esta semana: " + filas.size() + (filas.size() == 1 ? " pago · " : " pagos · ") + cop(total);
        return enviar(para, asunto + " · Presupuesto Hogar", marco(logo, asunto, "Pagos de la semana", contenido, e(pie)));
    }

    private Mono<Void> enviar(String para, String asunto, String html) {
        return client.post()
                .uri("/api/send")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("to", para, "subject", asunto, "html", html, "fromName", FROM_NAME))
                .retrieve()
                .toBodilessEntity()
                .timeout(TIMEOUT)
                .then();
    }

    private static String stripSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
