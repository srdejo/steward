package co.com.srdejo.steward.domain.model;

import java.util.List;
import java.util.UUID;

/**
 * El plan anual del hogar, como {@code PlanAnual} del dominio compartido (design D2 de backend-plan-anual). Solo guarda
 * las celdas tocadas; las demas valen cero. Las vistas (cuadricula, KPI) las calcula el cliente.
 */
public record PlanAnual(UUID id, UUID hogarId, int anio, Estado estado, List<Celda> celdas, List<Evento> eventos) {

    public static final int NOMBRE_EVENTO_MAX = 60;

    public PlanAnual {
        celdas = celdas == null ? List.of() : List.copyOf(celdas);
        eventos = eventos == null ? List.of() : List.copyOf(eventos);
    }

    public enum Estado {
        BORRADOR,
        CREADO
    }

    public record Celda(UUID categoriaId, int mes, long monto) {
    }

    /** {@code usuarioId}: en un ingreso extra, la persona cuya regla de diezmo hereda. */
    public record Evento(UUID id, String nombre, int mes, long monto, Tipo tipo, UUID usuarioId) {

        public enum Tipo {
            INGRESO,
            GASTO
        }
    }

    /** El aporte que una persona espera hacer en un mes. */
    public record Proyeccion(UUID usuarioId, int anio, int mes, long monto) {
    }
}
