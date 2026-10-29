package co.com.srdejo.steward.domain.usecase;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Los textos que el backend arma igual que el dominio compartido ({@code formatPorcentaje} y {@code formatFechaCorta} de
 * packages/domain/src/format): detalles del diezmo y "Ya lo pago {nombre} el {dd mmm}".
 */
public final class Formato {

    private static final String[] MESES = {"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"};

    private Formato() {
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
