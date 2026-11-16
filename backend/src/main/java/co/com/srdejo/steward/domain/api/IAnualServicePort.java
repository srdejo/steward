package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * El plan anual del hogar de la sesion (spec steward-plan-anual). Donde se pide {@code opcionId}, null es la opcion en uso
 * o, si no hay, la A (design D1 de anual-opciones-y-meses).
 */
public interface IAnualServicePort {

    /** "Crear plan anual {año}": vacio, con su Opcion A, para el año en curso o uno futuro. */
    Mono<PlanAnual> crear(int anio);

    Mono<Void> ponerCelda(int anio, UUID opcionId, UUID categoriaId, int mes, long monto);

    /** {@code categoriaId} solo en gastos (null: "Eventos del año"); {@code enAdelante}: de ese mes a diciembre. */
    Mono<Evento> agregarEvento(int anio, UUID opcionId, String nombre, int mes, long monto, String tipo, UUID usuarioId,
                               UUID categoriaId, boolean enAdelante);

    /** Corrige un evento con los mismos datos que al agregarlo; {@code EVENTO_NO_ENCONTRADO} si no es de ese anual. */
    Mono<Evento> editarEvento(int anio, UUID eventoId, String nombre, int mes, long monto, String tipo, UUID usuarioId,
                              UUID categoriaId, boolean enAdelante);

    Mono<Void> quitarEvento(int anio, UUID eventoId);

    /** "Borrar plan de {año}": el anual con sus opciones y los aportes proyectados del año; los meses ya creados no cambian. */
    Mono<Void> borrar(int anio);

    /**
     * "Replicar en los 12 meses" (spec steward-plan-anual, "Replicar el mes base"): {@code tipo} MES (con {@code base}),
     * FIJOS o CERO, en una opcion. Crea el anual si no existe y reemplaza las celdas de la opcion y las proyecciones del año;
     * conserva los eventos. Ya no se bloquea con los meses creados.
     */
    Mono<PlanAnual> replicar(int anio, String tipo, YearMonth base, UUID opcionId);

    /** El aporte proyectado de un miembro en un mes; 0 lo quita. */
    Mono<Void> ponerProyeccion(int anio, UUID usuarioId, int mes, long monto);

    /** "+ Duplicar Opción X": la siguiente letra, a nombre de quien duplica, con copia de celdas, eventos y base. */
    Mono<PlanAnual.Opcion> duplicarOpcion(int anio, UUID desdeId);

    /** "Quitar opción": no la ultima ni la que esta en uso ({@code OPCION_EN_USO}). */
    Mono<Void> quitarOpcion(int anio, UUID opcionId);

    /**
     * "Meses con la Opción X" (spec "Crear o actualizar los meses desde el plan anual"): crea los meses sin plan y reemplaza
     * los de {@code actualizar}; uno con registros o cerrado da {@code MES_CON_REGISTROS}. La opcion queda en uso.
     */
    Mono<List<MesDelAnual>> meses(int anio, UUID opcionId, List<Integer> actualizar);

    /** Un mes que se creo o se actualizo. */
    record MesDelAnual(YearMonth ref, Accion accion) {

        public enum Accion {
            CREADO,
            ACTUALIZADO
        }
    }
}
