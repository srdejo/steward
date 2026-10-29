package co.com.srdejo.steward.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Credito del hogar, como {@code Credito} del dominio compartido. Sus ultimos pagos no se guardan aparte: salen de los
 * movimientos con su credito (design D4 de backend-cuentas-creditos).
 *
 * @param tasaEm tasa efectiva mensual en porcentaje (1.6 = 1,6 % EM).
 */
public record Credito(UUID id, UUID hogarId, String nombre, String entidad, long saldo, LocalDate saldoActualizadoEn,
                      long cuota, BigDecimal tasaEm, int diaPago, long totalOriginal, List<Pago> pagos) {

    public static final int NOMBRE_MAX = 40;
    public static final BigDecimal TASA_MAX = BigDecimal.TEN;
    /** Cuantos pagos recientes trae cada credito en la lectura de finanzas. */
    public static final int ULTIMOS_PAGOS = 6;

    public Credito {
        pagos = pagos == null ? List.of() : List.copyOf(pagos);
    }

    public Credito conPagos(List<Pago> nuevos) {
        return new Credito(id, hogarId, nombre, entidad, saldo, saldoActualizadoEn, cuota, tasaEm, diaPago, totalOriginal,
                nuevos);
    }

    /** "Cuota libre inversión": el nombre del item de su cuota en el plan. */
    public String nombreCuota() {
        return "Cuota " + nombre.toLowerCase(java.util.Locale.ROOT);
    }

    public record Pago(LocalDate fecha, long monto, Tipo tipo) {

        public enum Tipo {
            CUOTA,
            ABONO
        }
    }
}
