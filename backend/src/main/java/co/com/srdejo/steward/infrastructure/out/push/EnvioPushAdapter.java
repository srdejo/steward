package co.com.srdejo.steward.infrastructure.out.push;

import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.MensajeAviso;
import co.com.srdejo.steward.domain.spi.IEnvioPushPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Envia los avisos (design D3 y D4 de avisos-pagos): a la app por la API de push de Expo, con {@code categoryId} para
 * "Ya lo pagué" y "Recordar mañana"; al navegador por Web Push con VAPID y {@code aes128gcm}. Un token que Expo reporta
 * como {@code DeviceNotRegistered}, o una suscripcion que responde 404 o 410, se quita.
 */
public class EnvioPushAdapter implements IEnvioPushPort {

    static final String EXPO = "https://exp.host/--/api/v2/push/send";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Logger log = LoggerFactory.getLogger(EnvioPushAdapter.class);

    private final WebClient client;
    private final String expoToken;
    private final String vapidPublica;
    private final byte[] vapidPrivada;
    private final String vapidSujeto;

    public EnvioPushAdapter(WebClient.Builder builder, String expoToken, String vapidPublica, String vapidPrivada, String vapidSujeto) {
        this.client = builder.build();
        this.expoToken = vacio(expoToken) ? null : expoToken;
        this.vapidPublica = vacio(vapidPublica) || vacio(vapidPrivada) ? null : vapidPublica;
        this.vapidPrivada = this.vapidPublica == null ? null : CifradoWebPush.b64(vapidPrivada);
        this.vapidSujeto = vacio(vapidSujeto) ? "https://steward.srdejo.com.co" : vapidSujeto;
    }

    private static boolean vacio(String s) {
        return s == null || s.isBlank();
    }

    @Override
    public String clavePublicaWeb() {
        return vapidPublica;
    }

    @Override
    public Mono<Boolean> enviar(DispositivoAviso d, MensajeAviso m) {
        return d.tipo() == DispositivoAviso.Tipo.EXPO ? expo(d, m) : web(d, m);
    }

    @SuppressWarnings("unchecked")
    private Mono<Boolean> expo(DispositivoAviso d, MensajeAviso m) {
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("to", d.token());
        cuerpo.put("title", m.titulo());
        cuerpo.put("body", m.cuerpo());
        cuerpo.put("sound", "default");
        cuerpo.put("data", m.datos());
        if (m.categoria() != null) cuerpo.put("categoryId", m.categoria());
        var pedido = client.post().uri(EXPO).contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON);
        if (expoToken != null) pedido = pedido.header("Authorization", "Bearer " + expoToken);
        return pedido.bodyValue(cuerpo).retrieve().bodyToMono(Map.class).timeout(TIMEOUT)
                .map(r -> {
                    Object datos = r.get("data");
                    Map<String, Object> ticket = datos instanceof List<?> l && !l.isEmpty() ? (Map<String, Object>) l.getFirst()
                            : datos instanceof Map<?, ?> mapa ? (Map<String, Object>) mapa : Map.of();
                    if (!"error".equals(ticket.get("status"))) return false;
                    Object detalles = ticket.get("details");
                    boolean invalido = detalles instanceof Map<?, ?> dm && "DeviceNotRegistered".equals(dm.get("error"));
                    if (!invalido) log.warn("[avisos] Expo no envio: {}", ticket.get("message"));
                    return invalido;
                })
                .onErrorResume(ex -> {
                    log.warn("[avisos] Expo fallo: {}", ex.getMessage());
                    return Mono.just(false);
                });
    }

    private Mono<Boolean> web(DispositivoAviso d, MensajeAviso m) {
        if (vapidPublica == null) return Mono.just(false);
        return Mono.fromCallable(() -> {
                    String json = cargaWeb(m);
                    byte[] cifrado = CifradoWebPush.cifrar(json.getBytes(StandardCharsets.UTF_8), CifradoWebPush.b64(d.p256dh()), CifradoWebPush.b64(d.auth()));
                    String vapid = CifradoWebPush.autorizacionVapid(d.token(), vapidSujeto, vapidPrivada, vapidPublica,
                            Instant.now().plus(Duration.ofHours(12)).getEpochSecond());
                    return new Object[]{cifrado, vapid};
                })
                .flatMap(x -> client.post().uri(java.net.URI.create(d.token()))
                        .header("Content-Encoding", "aes128gcm").header("TTL", "86400").header("Urgency", "normal")
                        .header("Authorization", (String) x[1]).contentType(MediaType.APPLICATION_OCTET_STREAM)
                        .bodyValue(x[0]).retrieve().toBodilessEntity().timeout(TIMEOUT).thenReturn(false))
                .onErrorResume(WebClientResponseException.class, ex -> {
                    boolean invalido = ex.getStatusCode().isSameCodeAs(HttpStatus.GONE) || ex.getStatusCode().isSameCodeAs(HttpStatus.NOT_FOUND);
                    if (!invalido) log.warn("[avisos] Web Push respondio {}", ex.getStatusCode());
                    return Mono.just(invalido);
                })
                .onErrorResume(ex -> {
                    log.warn("[avisos] Web Push fallo: {}", ex.getMessage());
                    return Mono.just(false);
                });
    }

    /**
     * El contenido con la forma del service worker de Angular ({@code notification} con {@code actions} y
     * {@code data.onActionClick}): tocar el aviso abre Avisos (u Hoy), y "Ya lo pagué" y "Recordar mañana" piden la accion
     * firmada sin abrir la app (design D9 de avisos-pagos).
     */
    static String cargaWeb(MensajeAviso m) {
        String destino = "hoy".equals(m.datos().get("destino")) ? "/hoy" : "/avisos";
        String accion = m.datos().get("accion");
        StringBuilder clic = new StringBuilder("{\"default\":{\"operation\":\"navigateLastFocusedOrOpen\",\"url\":" + json(destino) + "}");
        String acciones = "";
        if ("pago".equals(m.categoria()) && accion != null) {
            String base = "/api/avisos/accion?accion=" + java.net.URLEncoder.encode(accion, StandardCharsets.UTF_8) + "&que=";
            clic.append(",\"pagado\":{\"operation\":\"sendRequest\",\"url\":").append(json(base + "PAGADO")).append('}')
                    .append(",\"manana\":{\"operation\":\"sendRequest\",\"url\":").append(json(base + "MANANA")).append('}');
            acciones = ",\"actions\":[{\"action\":\"pagado\",\"title\":\"Ya lo pagué\"},{\"action\":\"manana\",\"title\":\"Recordar mañana\"}]";
        }
        clic.append('}');
        return "{\"notification\":{\"title\":" + json(m.titulo()) + ",\"body\":" + json(m.cuerpo())
                + ",\"icon\":\"/icons/apple-touch-icon.png\",\"badge\":\"/favicon.png\",\"lang\":\"es\""
                + acciones + ",\"data\":{\"onActionClick\":" + clic + "}}}";
    }

    /** JSON minimo para textos y mapas de textos (sin dependencias de reflexion en la imagen nativa). */
    static String json(Object valor) {
        if (valor instanceof Map<?, ?> m) {
            StringBuilder s = new StringBuilder("{");
            m.forEach((k, v) -> s.append(s.length() > 1 ? "," : "").append(json(String.valueOf(k))).append(':').append(json(v)));
            return s.append('}').toString();
        }
        String t = String.valueOf(valor);
        StringBuilder s = new StringBuilder("\"");
        for (char c : t.toCharArray()) {
            switch (c) {
                case '"' -> s.append("\\\"");
                case '\\' -> s.append("\\\\");
                case '\n' -> s.append("\\n");
                case '\r' -> s.append("\\r");
                case '\t' -> s.append("\\t");
                default -> {
                    if (c < 0x20) s.append(String.format("\\u%04x", (int) c));
                    else s.append(c);
                }
            }
        }
        return s.append('"').toString();
    }
}
