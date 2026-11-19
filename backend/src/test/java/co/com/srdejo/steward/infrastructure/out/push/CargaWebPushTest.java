package co.com.srdejo.steward.infrastructure.out.push;

import co.com.srdejo.steward.domain.model.MensajeAviso;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** El contenido de Web Push con la forma del service worker de Angular (design D9 de avisos-pagos). */
class CargaWebPushTest {

    @Test
    void unPagoConSusAccionesYElClicAAvisos() {
        String json = EnvioPushAdapter.cargaWeb(new MensajeAviso("Nu · Mercado", "En 2 días · $320.000", "pago", Map.of("destino", "avisos", "accion", "abc.def")));
        assertTrue(json.startsWith("{\"notification\":{\"title\":\"Nu · Mercado\""), json);
        assertTrue(json.contains("{\"action\":\"pagado\",\"title\":\"Ya lo pagué\"}"), json);
        assertTrue(json.contains("\"default\":{\"operation\":\"navigateLastFocusedOrOpen\",\"url\":\"/avisos\"}"), json);
        assertTrue(json.contains("\"url\":\"/api/avisos/accion?accion=abc.def&que=PAGADO\""), json);
    }

    @Test
    void loDelOtroMiembroAbreHoySinAcciones() {
        String json = EnvioPushAdapter.cargaWeb(new MensajeAviso("Esposa pagó Recibo Luz", "$38.000", null, Map.of("destino", "hoy")));
        assertTrue(json.contains("\"url\":\"/hoy\"") && !json.contains("actions"), json);
    }
}
