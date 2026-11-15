package co.com.srdejo.steward.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Credito del hogar, como {@code Credito} del dominio compartido. Sus ultimos pagos no se guardan aparte: salen de los
 * movimientos con su credito (design D4 de backend-cuentas-creditos).
 *
 * @param tasaEm          tasa efectiva mensual en porcentaje (1.6 = 1,6 % EM).
 * @param metodo          como baja el saldo (design D3 de tarjetas-y-creditos).
 * @param numeroCuotas    PLAN: el numero total de cuotas de la tabla; null en los otros.
 * @param cuotasPagadas   cuotas ya pagadas (PLAN; en TASA, si se conoce).
 * @param valorFinanciado PLAN: el valor del que sale la tabla; null en los otros.
 */
public record Credito(UUID id, UUID hogarId, String nombre, String entidad, long saldo, LocalDate saldoActualizadoEn,
                      long cuota, BigDecimal tasaEm, int diaPago, long totalOriginal, List<Pago> pagos, Metodo metodo,
                      Integer numeroCuotas, int cuotasPagadas, Long valorFinanciado) {

    public static final int NOMBRE_MAX = 40;
    public static final BigDecimal TASA_MAX = BigDecimal.TEN;
    /** Cuantos pagos recientes trae cada credito en la lectura de finanzas. */
    public static final int ULTIMOS_PAGOS = 6;

    public enum Metodo {
        TASA,
        PLAN,
        MANUAL
    }

    public Credito {
        pagos = pagos == null ? List.of() : List.copyOf(pagos);
        metodo = metodo == null ? Metodo.TASA : metodo;
    }

    /** Con la tasa, como antes de tarjetas-y-creditos. */
    public Credito(UUID id, UUID hogarId, String nombre, String entidad, long saldo, LocalDate saldoActualizadoEn, long cuota,
                   BigDecimal tasaEm, int diaPago, long totalOriginal, List<Pago> pagos) {
        this(id, hogarId, nombre, entidad, saldo, saldoActualizadoEn, cuota, tasaEm, diaPago, totalOriginal, pagos, Metodo.TASA,
                null, 0, null);
    }

    public Credito conPagos(List<Pago> nuevos) {
        return new Credito(id, hogarId, nombre, entidad, saldo, saldoActualizadoEn, cuota, tasaEm, diaPago, totalOriginal,
                nuevos, metodo, numeroCuotas, cuotasPagadas, valorFinanciado);
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
