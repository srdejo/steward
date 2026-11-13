package co.com.srdejo.steward.domain.model;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * El plan anual del hogar, como {@code PlanAnual} del dominio compartido (design D2 de backend-plan-anual). Solo guarda
 * las celdas tocadas; las demas valen cero. Las vistas (cuadricula, KPI) las calcula el cliente. {@code base}: el mes que
 * se replico (design D1 de planear-anio-desde-un-mes); los meses creados copian sus items. Null si se lleno a mano.
 */
public record PlanAnual(UUID id, UUID hogarId, int anio, Estado estado, List<Celda> celdas, List<Evento> eventos, YearMonth base) {

    public static final int NOMBRE_EVENTO_MAX = 60;

    public PlanAnual {
        celdas = celdas == null ? List.of() : List.copyOf(celdas);
        eventos = eventos == null ? List.of() : List.copyOf(eventos);
    }

    public PlanAnual(UUID id, UUID hogarId, int anio, Estado estado, List<Celda> celdas, List<Evento> eventos) {
        this(id, hogarId, anio, estado, celdas, eventos, null);
    }

    public enum Estado {
        BORRADOR,
        CREADO
    }

    public record Celda(UUID categoriaId, int mes, long monto) {
    }

    /**
     * {@code usuarioId}: en un ingreso extra, la persona cuya regla de diezmo hereda. {@code categoriaId}: en un gasto, su
     * categoria (null: "Eventos del año"). {@code enAdelante}: se repite de su mes a diciembre (design D3 de
     * planear-anio-desde-un-mes).
     */
    public record Evento(UUID id, String nombre, int mes, long monto, Tipo tipo, UUID usuarioId, UUID categoriaId, boolean enAdelante) {

        public Evento(UUID id, String nombre, int mes, long monto, Tipo tipo, UUID usuarioId) {
            this(id, nombre, mes, monto, tipo, usuarioId, null, false);
        }

        /** Si el evento toca el mes: el suyo, o uno posterior si es "en adelante" ({@code eventosDelMes} del dominio). */
        public boolean aplica(int mesDelAnio) {
            return mes == mesDelAnio || (enAdelante && mes < mesDelAnio);
        }

        public enum Tipo {
            INGRESO,
            GASTO
        }
    }

    /** El aporte que una persona espera hacer en un mes. */
    public record Proyeccion(UUID usuarioId, int anio, int mes, long monto) {
    }
}
