package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * Un registro del mes, como {@code Movimiento} del dominio compartido: los campos opcionales dependen del tipo. La Etapa 4
 * suma pagos, gastos y aportes.
 *
 * @param ingresoFijoId INGRESO_FIJO: cual ingreso se recibio.
 * @param bruto         INGRESO_FIJO: el bruto del ingreso al recibirlo (base del diezmo).
 * @param aplicaDiezmo  INGRESO_FIJO: si el dueno tenia la regla activa al recibir.
 * @param diezmoDe      DIEZMO_ENTREGADO: los movimientos cuyas obligaciones cubre.
 */
public record Movimiento(UUID id, UUID hogarId, Tipo tipo, YearMonth ref, long monto, LocalDate fecha, UUID usuarioId,
                         UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                         List<UUID> diezmoDe) {

    public enum Tipo {
        INGRESO_FIJO,
        DIEZMO_ENTREGADO
    }

    public Movimiento {
        diezmoDe = diezmoDe == null ? List.of() : List.copyOf(diezmoDe);
    }
}
