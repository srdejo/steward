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
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Envia los avisos (design D3 y D4 de avisos-pagos): a la app por la API de push de Expo, con {@code categoryId} para
 * "Ya lo pagué" y "Recordar mañana"; al navegador por Web Push con VAPID y {@code aes128gcm}. Un token que Expo reporta
 * como {@code DeviceNotRegistered}, o una suscripcion que responde 404 o 410, se quita. El ticket de Expo solo dice que
 * Expo recibio el envio: el recibo, que se pide en una corrida siguiente (15 minutos despues o mas), dice si Apple lo
 * entrego. Los tickets pendientes viven en memoria: Expo borra los recibos a las 24 horas, y un reinicio solo pierde
 * los de ese dia (el token se detecta igual en el envio siguiente).
 */
public class EnvioPushAdapter implements IEnvioPushPort {

    static final String EXPO = "https://exp.host/--/api/v2/push";
    /** Expo pide esperar unos 15 minutos antes de pedir un recibo, y lo borra a las 24 horas. */
    static final Duration ESPERA_RECIBO = Duration.ofMinutes(15);
    static final Duration VIDA_RECIBO = Duration.ofHours(24);
    static final int RECIBOS_POR_PEDIDO = 1000;
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Logger log = LoggerFactory.getLogger(EnvioPushAdapter.class);

    private final WebClient client;
    private final String expoToken;
    private final String vapidPublica;
    private final byte[] vapidPrivada;
    private final String vapidSujeto;
    private final String expoUrl;
    private final Clock reloj;
    /** Ticket de Expo → el token al que se envio y cuando. */
    private final Map<String, Pendiente> pendientes = new ConcurrentHashMap<>();

    record Pendiente(String token, Instant enviado) {
    }

    public EnvioPushAdapter(WebClient.Builder builder, String expoToken, String vapidPublica, String vapidPrivada, String vapidSujeto) {
        this(builder, expoToken, vapidPublica, vapidPrivada, vapidSujeto, EXPO, Clock.systemUTC());
    }

    EnvioPushAdapter(WebClient.Builder builder, String expoToken, String vapidPublica, String vapidPrivada, String vapidSujeto,
                     String expoUrl, Clock reloj) {
        this.expoUrl = expoUrl;
        this.reloj = reloj;
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
        return pedidoExpo("/send").bodyValue(cuerpo).retrieve().bodyToMono(Map.class).timeout(TIMEOUT)
                .map(r -> {
                    Object datos = r.get("data");
                    Map<String, Object> ticket = datos instanceof List<?> l && !l.isEmpty() ? (Map<String, Object>) l.getFirst()
                            : datos instanceof Map<?, ?> mapa ? (Map<String, Object>) mapa : Map.of();
                    if (!"error".equals(ticket.get("status"))) {
                        // Expo lo recibio; el recibo dira si llego al iPhone.
                        if (ticket.get("id") instanceof String id) pendientes.put(id, new Pendiente(d.token(), reloj.instant()));
                        return false;
                    }
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

    private WebClient.RequestBodySpec pedidoExpo(String ruta) {
        var pedido = client.post().uri(expoUrl + ruta).contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON);
        if (expoToken != null) pedido = pedido.header("Authorization", "Bearer " + expoToken);
        return pedido;
    }

    /**
     * Pide los recibos de los tickets con 15 minutos o mas, de a 1000. {@code DeviceNotRegistered} devuelve su token; un
     * recibo leido o un ticket de mas de 24 horas sale de la lista. Si Expo no responde, se intenta en la corrida siguiente.
     */
    @Override
    @SuppressWarnings("unchecked")
    public Mono<List<String>> tokensInvalidosPorRecibos() {
        Instant ahora = reloj.instant();
        pendientes.entrySet().removeIf(e -> e.getValue().enviado().plus(VIDA_RECIBO).isBefore(ahora));
        List<String> listos = pendientes.entrySet().stream()
                .filter(e -> !e.getValue().enviado().plus(ESPERA_RECIBO).isAfter(ahora)).map(Map.Entry::getKey).toList();
        if (listos.isEmpty()) return Mono.just(List.of());
        List<List<String>> lotes = new ArrayList<>();
        for (int i = 0; i < listos.size(); i += RECIBOS_POR_PEDIDO) lotes.add(listos.subList(i, Math.min(listos.size(), i + RECIBOS_POR_PEDIDO)));
        return reactor.core.publisher.Flux.fromIterable(lotes)
                .concatMap(ids -> pedidoExpo("/getReceipts").bodyValue(Map.of("ids", ids)).retrieve().bodyToMono(Map.class).timeout(TIMEOUT)
                        .map(r -> {
                            List<String> invalidos = new ArrayList<>();
                            if (r.get("data") instanceof Map<?, ?> recibos) {
                                recibos.forEach((id, recibo) -> {
                                    Pendiente p = pendientes.remove(String.valueOf(id));
                                    if (p != null && recibo instanceof Map<?, ?> rm && "error".equals(rm.get("status"))) {
                                        if (rm.get("details") instanceof Map<?, ?> det && "DeviceNotRegistered".equals(det.get("error"))) invalidos.add(p.token());
                                        else log.warn("[avisos] Recibo de Expo con error: {}", rm.get("message"));
                                    }
                                });
                            }
                            return invalidos;
                        })
                        .onErrorResume(ex -> {
                            log.warn("[avisos] No se pudieron leer los recibos de Expo: {}", ex.getMessage());
                            return Mono.just(List.of());
                        }))
                .flatMapIterable(l -> l).distinct().collectList();
    }

    /** Cuantos tickets esperan su recibo (para pruebas). */
    int recibosPendientes() {
        return pendientes.size();
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
