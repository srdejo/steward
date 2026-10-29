package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.model.ReglaDiezmo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Las cifras y textos del diezmo, iguales a los del dominio compartido ({@code calcularDiezmo} y
 * {@code diezmosPendientes} de packages/domain), para que el backend reproduzca sus tests (design D3).
 */
public final class CalculoDiezmo {

    private static final BigDecimal CIEN = BigDecimal.valueOf(100);

    private CalculoDiezmo() {
    }

    /** El porcentaje sobre el bruto o el neto segun la base, al peso mas cercano (las mitades hacia arriba). */
    public static long monto(BigDecimal porcentaje, long bruto, long neto, ReglaDiezmo.Base base) {
        return sobre(porcentaje, base == ReglaDiezmo.Base.BRUTO ? bruto : neto);
    }

    /** El porcentaje sobre un monto (el de un aporte), al peso mas cercano. */
    public static long sobre(BigDecimal porcentaje, long monto) {
        return BigDecimal.valueOf(monto).multiply(porcentaje).divide(CIEN, 0, RoundingMode.HALF_UP).longValueExact();
    }

    /** {@code 10% de Salario Daniel · recibido 25 oct} */
    public static String detalle(BigDecimal porcentaje, String nombreIngreso, LocalDate recibido) {
        return Formato.porcentaje(porcentaje) + " de " + nombreIngreso + " · recibido " + Formato.fechaCorta(recibido);
    }

    /** {@code 10% del aporte · 26 oct} */
    public static String detalleAporte(BigDecimal porcentaje, LocalDate fecha) {
        return Formato.porcentaje(porcentaje) + " del aporte · " + Formato.fechaCorta(fecha);
    }

    public static String porcentaje(BigDecimal valor) {
        return Formato.porcentaje(valor);
    }

    public static String fechaCorta(LocalDate fecha) {
        return Formato.fechaCorta(fecha);
    }
}
