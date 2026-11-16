package co.com.srdejo.steward.domain.model;

import java.util.UUID;

/**
 * Tarjeta de credito del hogar, como {@code Tarjeta} del dominio compartido (spec steward-tarjetas): fechas, uso y como se
 * paga. No lleva deuda ni compras.
 *
 * @param uso       "Mercado", "Gasolina"; vacio = sin uso.
 * @param pagoMonto el pago fijo o, si se paga completa, el ultimo valor pagado (el monto de su linea en los meses nuevos).
 */
public record Tarjeta(UUID id, UUID hogarId, String nombre, int diaCorte, int diaPago, String uso, Pago pagoTipo,
                      long pagoMonto) {

    public static final int NOMBRE_MAX = 40;

    public enum Pago {
        COMPLETA,
        FIJO
    }

    /** "Tarjeta Nu · Mercado": el nombre de su linea en el plan. */
    public String nombreLinea() {
        return "Tarjeta " + nombre + (uso == null || uso.isEmpty() ? "" : " · " + uso);
    }

    public Tarjeta conPagoMonto(long monto) {
        return new Tarjeta(id, hogarId, nombre, diaCorte, diaPago, uso, pagoTipo, monto);
    }
}
