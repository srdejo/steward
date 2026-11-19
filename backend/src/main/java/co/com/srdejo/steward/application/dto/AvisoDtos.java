package co.com.srdejo.steward.application.dto;

import co.com.srdejo.steward.domain.model.Aviso;
import co.com.srdejo.steward.domain.model.PreferenciasAviso;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Cuerpos de /api/avisos (spec steward-avisos, "API de avisos"), con la forma de Aviso del dominio compartido. */
public final class AvisoDtos {

    private AvisoDtos() {
    }

    public record MesDto(int anio, int mes) {
        static MesDto de(YearMonth ref) {
            return ref == null ? null : new MesDto(ref.getYear(), ref.getMonthValue());
        }
    }

    public record PagoDto(UUID itemId, MesDto ref) {
    }

    public record DestinoDto(String tipo, MesDto ref, UUID cuentaId) {
    }

    public record AvisoResponse(String clave, String tipo, LocalDate fecha, String nombre, String detalle, Long monto, boolean corte,
                                String grupo, PagoDto pago, DestinoDto destino) {
        public static AvisoResponse de(Aviso a) {
            return new AvisoResponse(a.clave(), a.tipo().name(), a.fecha(), a.nombre(), a.detalle(), a.monto(), a.corte(), a.grupo().name(),
                    a.pago() == null ? null : new PagoDto(a.pago().itemId(), MesDto.de(a.pago().ref())),
                    a.destino() == null ? null : new DestinoDto(a.destino().tipo(), MesDto.de(a.destino().ref()), a.destino().cuentaId()));
        }
    }

    public record PreferenciasDto(List<String> tiposApagados, boolean correo, boolean noMolestar) {
        public static PreferenciasDto de(PreferenciasAviso p) {
            return new PreferenciasDto(p.tiposApagados().stream().sorted().toList(), p.correo(), p.noMolestar());
        }

        public PreferenciasAviso dominio() {
            return new PreferenciasAviso(tiposApagados == null ? java.util.Set.of() : java.util.Set.copyOf(tiposApagados), correo, noMolestar);
        }
    }

    /** EXPO: {@code token}; WEB: {@code endpoint}, {@code p256dh} y {@code auth}. */
    public record DispositivoRequest(String tipo, String token, String endpoint, String p256dh, String auth) {
    }

    public record TokenRequest(String token) {
    }

    public record AccionRequest(String accion, String que) {
    }

    public record ClaveWebResponse(String clave) {
    }
}
