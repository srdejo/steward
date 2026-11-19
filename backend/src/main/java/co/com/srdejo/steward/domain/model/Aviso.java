package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

/**
 * Un aviso de Avisos y del push (spec steward-avisos, "Qué se avisa"), como {@code Aviso} del dominio compartido.
 * {@code clave} ({@code tipo:id:yyyy-mm}) es lo que no se repite al enviar (design D2 de avisos-pagos).
 */
public record Aviso(String clave, Tipo tipo, LocalDate fecha, String nombre, String detalle, Long monto, boolean corte,
                    Grupo grupo, Pago pago, Destino destino) {

    public enum Tipo {
        PAGO,
        TARJETA,
        CUOTA,
        INGRESO,
        PLAN,
        CUADRAR
    }

    public enum Grupo {
        VENCIDO,
        SEMANA,
        ADELANTE,
        NO_OLVIDAR
    }

    /** Un pago que se marca desde el aviso. */
    public record Pago(UUID itemId, YearMonth ref) {
    }

    /** A donde lleva un aviso que no es un pago: CIERRE y COMPARAR con su mes, CUENTA con su cuenta, HOY. */
    public record Destino(String tipo, YearMonth ref, UUID cuentaId) {
    }
}
