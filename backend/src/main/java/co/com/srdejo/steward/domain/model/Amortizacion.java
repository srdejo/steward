package co.com.srdejo.steward.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Las cuentas de un credito, como {@code rules/credito.ts} del dominio compartido (design D3 de tarjetas-y-creditos): la
 * cuota fija del plan de pagos, el saldo de su tabla y lo que baja el saldo al pagar una cuota segun el metodo. Los
 * redondeos son los de {@code Math.round} de JavaScript (las mitades suben), para que el backend y las apps den lo mismo.
 */
public final class Amortizacion {

    private Amortizacion() {
    }

    /** Tasa efectiva mensual equivalente a una efectiva anual, en porcentaje con dos decimales (12 % EA = 0,95 % EM). */
    public static BigDecimal emDeEa(BigDecimal ea) {
        double em = (Math.pow(1 + ea.doubleValue() / 100, 1.0 / 12) - 1) * 10_000;
        return BigDecimal.valueOf(Math.round(em)).movePointLeft(2).setScale(2, RoundingMode.UNNECESSARY);
    }

    /** Cuota fija (sistema frances) de {@code valor} en {@code n} cuotas a la tasa mensual {@code em} (porcentaje). */
    public static long cuotaFija(long valor, int n, BigDecimal em) {
        if (n <= 0) {
            return 0;
        }
        double r = em.doubleValue() / 100;
        if (r == 0) {
            return Math.round((double) valor / n);
        }
        return Math.round(valor * r / (1 - Math.pow(1 + r, -n)));
    }

    /** Saldo del plan de pagos despues de {@code pagadas} cuotas: la tabla desde el valor financiado. */
    public static long saldoPlan(long valor, int n, BigDecimal em, long cuota, int pagadas) {
        long saldo = valor;
        for (int k = 1; k <= pagadas && k <= n && saldo > 0; k++) {
            saldo -= capital(saldo, cuota, em, k == n);
        }
        return saldo;
    }

    /** Lo que va a capital de una cuota: la cuota menos el interes del mes, sin pasar del saldo; la ultima paga todo. */
    private static long capital(long saldo, long cuota, BigDecimal em, boolean ultima) {
        long interes = interes(saldo, em);
        return ultima ? saldo : Math.min(Math.max(0, cuota - interes), saldo);
    }

    public static long interes(long saldo, BigDecimal em) {
        return Math.round(saldo * em.doubleValue() / 100);
    }

    /** El credito despues de pagar una cuota de {@code monto}, y cuanto bajo su saldo (aplicarCuota del dominio). */
    public record Pagado(long saldo, int cuotasPagadas, long capital) {
    }

    public static Pagado pagarCuota(Credito c, long monto) {
        return switch (c.metodo()) {
            case MANUAL -> new Pagado(c.saldo(), c.cuotasPagadas(), 0);
            case TASA -> {
                long saldo = Math.max(0, c.saldo() - Math.max(0, monto - interes(c.saldo(), c.tasaEm())));
                yield new Pagado(saldo, c.cuotasPagadas() + 1, c.saldo() - saldo);
            }
            case PLAN -> {
                int n = c.numeroCuotas() == null ? 0 : c.numeroCuotas();
                long valor = c.valorFinanciado() == null ? 0 : c.valorFinanciado();
                boolean sigueLaTabla = Math.abs(saldoPlan(valor, n, c.tasaEm(), c.cuota(), c.cuotasPagadas()) - c.saldo()) <= 1;
                int k = c.cuotasPagadas() + 1;
                long saldo = c.saldo() <= 0 ? 0 : sigueLaTabla
                        ? saldoPlan(valor, n, c.tasaEm(), c.cuota(), k)
                        : c.saldo() - capital(c.saldo(), c.cuota(), c.tasaEm(), k >= n);
                yield new Pagado(saldo, Math.min(k, Math.max(n, 1)), c.saldo() - saldo);
            }
        };
    }
}
