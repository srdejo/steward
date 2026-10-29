package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * Un registro del mes, como {@code Movimiento} del dominio compartido: los campos opcionales dependen del tipo.
 *
 * @param cuentaId      la cuenta del hogar de la que salio o a la que llego el dinero, con {@code origen} CUENTA.
 * @param ingresoFijoId INGRESO_FIJO: cual ingreso se recibio.
 * @param bruto         INGRESO_FIJO: el bruto del ingreso al recibirlo (base del diezmo).
 * @param aplicaDiezmo  INGRESO_FIJO y APORTE: si genera diezmo.
 * @param diezmoDe      DIEZMO_ENTREGADO: los movimientos cuyas obligaciones cubre.
 * @param itemId        PAGO y GASTO: el item del plan (null = "No estaba planeado").
 * @param nota          GASTO: la nota.
 * @param origen        EXTERNA = "Su cuenta", fuera de la app: un pago o gasto asi es un aporte implicito.
 */
public record Movimiento(UUID id, UUID hogarId, Tipo tipo, YearMonth ref, long monto, LocalDate fecha, UUID usuarioId,
                         UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                         List<UUID> diezmoDe, UUID itemId, String nota, Origen origen) {

    public enum Tipo {
        INGRESO_FIJO,
        DIEZMO_ENTREGADO,
        APORTE,
        PAGO,
        GASTO
    }

    public enum Origen {
        CUENTA,
        EXTERNA,
        NINGUNO
    }

    public Movimiento {
        diezmoDe = diezmoDe == null ? List.of() : List.copyOf(diezmoDe);
        nota = nota == null ? "" : nota;
        // Una cuenta quitada del hogar deja el movimiento sin cuenta: ya no es CUENTA.
        if (origen == null || (origen == Origen.CUENTA && cuentaId == null)) {
            origen = cuentaId == null ? Origen.NINGUNO : Origen.CUENTA;
        }
    }

    /** Los de ingresos y diezmo (Etapa 3): sin item ni nota, y el origen sale de la cuenta. */
    public Movimiento(UUID id, UUID hogarId, Tipo tipo, YearMonth ref, long monto, LocalDate fecha, UUID usuarioId,
                      UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                      List<UUID> diezmoDe) {
        this(id, hogarId, tipo, ref, monto, fecha, usuarioId, creadoPor, cuentaId, ingresoFijoId, bruto, aplicaDiezmo,
                diezmoDe, null, "", null);
    }
}
