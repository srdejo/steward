package co.com.srdejo.steward.domain.model;

import java.util.Map;

/**
 * Lo que llega al dispositivo: titulo, cuerpo y datos ({@code accion}: el identificador firmado de "Ya lo pagué" y
 * "Recordar mañana"; {@code destino}: avisos u hoy). {@code categoria} = "pago" activa las acciones en la app.
 */
public record MensajeAviso(String titulo, String cuerpo, String categoria, Map<String, String> datos) {

    public MensajeAviso {
        datos = datos == null ? Map.of() : Map.copyOf(datos);
    }
}
