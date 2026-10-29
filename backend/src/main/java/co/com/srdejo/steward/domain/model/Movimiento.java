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
 * @param cuentaDestinoId TRANSFERENCIA: la cuenta a la que llega (la de origen va en {@code cuentaId}).
 * @param creditoId     PAGO de un item enlazado a un credito, y ABONO_CREDITO.
 * @param seq           orden de registro, que asigna la base (0 antes de guardarlo): el saldo estimado suma lo
 *                      registrado despues del ultimo cuadre (design D1 de backend-cuentas-creditos).
 */
public record Movimiento(UUID id, UUID hogarId, Tipo tipo, YearMonth ref, long monto, LocalDate fecha, UUID usuarioId,
                         UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                         List<UUID> diezmoDe, UUID itemId, String nota, Origen origen, UUID cuentaDestinoId,
                         UUID creditoId, long seq) {

    public enum Tipo {
        INGRESO_FIJO,
        DIEZMO_ENTREGADO,
        APORTE,
        PAGO,
        GASTO,
        AJUSTE_CUADRE,
        TRANSFERENCIA,
        ABONO_CREDITO
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

    /** Los de Hoy (Etapa 4): sin cuenta destino ni credito. */
    public Movimiento(UUID id, UUID hogarId, Tipo tipo, YearMonth ref, long monto, LocalDate fecha, UUID usuarioId,
                      UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                      List<UUID> diezmoDe, UUID itemId, String nota, Origen origen) {
        this(id, hogarId, tipo, ref, monto, fecha, usuarioId, creadoPor, cuentaId, ingresoFijoId, bruto, aplicaDiezmo,
                diezmoDe, itemId, nota, origen, null, null, 0);
    }

    public Movimiento conSeq(long nuevo) {
        return new Movimiento(id, hogarId, tipo, ref, monto, fecha, usuarioId, creadoPor, cuentaId, ingresoFijoId, bruto,
                aplicaDiezmo, diezmoDe, itemId, nota, origen, cuentaDestinoId, creditoId, nuevo);
    }

    public Movimiento conCredito(UUID credito) {
        return new Movimiento(id, hogarId, tipo, ref, monto, fecha, usuarioId, creadoPor, cuentaId, ingresoFijoId, bruto,
                aplicaDiezmo, diezmoDe, itemId, nota, origen, cuentaDestinoId, credito, seq);
    }

    /** Los de ingresos y diezmo (Etapa 3): sin item ni nota, y el origen sale de la cuenta. */
    public Movimiento(UUID id, UUID hogarId, Tipo tipo, YearMonth ref, long monto, LocalDate fecha, UUID usuarioId,
                      UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                      List<UUID> diezmoDe) {
        this(id, hogarId, tipo, ref, monto, fecha, usuarioId, creadoPor, cuentaId, ingresoFijoId, bruto, aplicaDiezmo,
                diezmoDe, null, "", null);
    }
}
