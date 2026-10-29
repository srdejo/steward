package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.model.ReglaDiezmo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Las cifras y textos del diezmo, iguales a los del dominio compartido ({@code calcularDiezmo}, {@code formatPorcentaje}
 * y {@code formatFechaCorta} de packages/domain), para que el backend reproduzca sus tests (design D3).
 */
public final class CalculoDiezmo {

    private static final String[] MESES = {"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"};
    private static final BigDecimal CIEN = BigDecimal.valueOf(100);

    private CalculoDiezmo() {
    }

    /** El porcentaje sobre el bruto o el neto segun la base, al peso mas cercano (las mitades hacia arriba). */
    public static long monto(BigDecimal porcentaje, long bruto, long neto, ReglaDiezmo.Base base) {
        long sobre = base == ReglaDiezmo.Base.BRUTO ? bruto : neto;
        return BigDecimal.valueOf(sobre).multiply(porcentaje).divide(CIEN, 0, RoundingMode.HALF_UP).longValueExact();
    }

    /** {@code 10% de Salario Daniel · recibido 25 oct} */
    public static String detalle(BigDecimal porcentaje, String nombreIngreso, LocalDate recibido) {
        return porcentaje(porcentaje) + " de " + nombreIngreso + " · recibido " + fechaCorta(recibido);
    }

    /** {@code 10%}, {@code 12,5%}: sin ceros de mas y con coma decimal. */
    public static String porcentaje(BigDecimal valor) {
        BigDecimal limpio = valor.stripTrailingZeros();
        if (limpio.scale() < 0) {
            limpio = limpio.setScale(0);
        }
        return limpio.toPlainString().replace('.', ',') + "%";
    }

    /** {@code 25 oct}, {@code 5 sep}: el dia sin cero a la izquierda y el mes en tres letras. */
    public static String fechaCorta(LocalDate fecha) {
        return fecha.getDayOfMonth() + " " + MESES[fecha.getMonthValue() - 1];
    }
}
