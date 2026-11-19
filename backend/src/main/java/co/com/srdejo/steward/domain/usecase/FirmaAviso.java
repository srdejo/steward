package co.com.srdejo.steward.domain.usecase;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * El identificador firmado de las acciones de un aviso (design D5 de avisos-pagos): la persona, el hogar, el item, el mes,
 * la clave del aviso y hasta cuando vale, con HMAC-SHA256. Vale 7 dias; uno alterado o vencido no sirve.
 */
public final class FirmaAviso {

    public static final int DIAS_VALIDO = 7;
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder D64 = Base64.getUrlDecoder();

    /** Lo que lleva el identificador; {@code itemId} y {@code mes} son null en un aviso que no es un pago. */
    public record Accion(UUID usuarioId, UUID hogarId, UUID itemId, YearMonth mes, String clave, LocalDate vence) {
    }

    private final byte[] secreto;

    public FirmaAviso(String secreto) {
        this.secreto = secreto == null ? new byte[0] : secreto.getBytes(StandardCharsets.UTF_8);
    }

    public boolean configurada() {
        return secreto.length >= 16;
    }

    public String firmar(Accion a) {
        String datos = String.join("|", a.usuarioId().toString(), a.hogarId().toString(), a.itemId() == null ? "" : a.itemId().toString(),
                a.mes() == null ? "" : a.mes().toString(), a.clave(), a.vence().toString());
        String cuerpo = B64.encodeToString(datos.getBytes(StandardCharsets.UTF_8));
        return cuerpo + "." + B64.encodeToString(hmac(cuerpo));
    }

    /** La accion si la firma coincide y no vencio (hoy incluido); vacio si no. */
    public Optional<Accion> verificar(String token, LocalDate hoy) {
        if (!configurada() || token == null) return Optional.empty();
        int punto = token.indexOf('.');
        if (punto <= 0) return Optional.empty();
        String cuerpo = token.substring(0, punto);
        try {
            if (!MessageDigest.isEqual(hmac(cuerpo), D64.decode(token.substring(punto + 1)))) return Optional.empty();
            String[] p = new String(D64.decode(cuerpo), StandardCharsets.UTF_8).split("\\|", -1);
            if (p.length != 6) return Optional.empty();
            Accion a = new Accion(UUID.fromString(p[0]), UUID.fromString(p[1]), p[2].isEmpty() ? null : UUID.fromString(p[2]),
                    p[3].isEmpty() ? null : YearMonth.parse(p[3]), p[4], LocalDate.parse(p[5]));
            return a.vence().isBefore(hoy) ? Optional.empty() : Optional.of(a);
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }

    private byte[] hmac(String cuerpo) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secreto.length == 0 ? new byte[1] : secreto, "HmacSHA256"));
            return mac.doFinal(cuerpo.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
