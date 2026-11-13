package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** El plan anual del hogar de la sesion (spec steward-plan-anual). */
public interface IAnualServicePort {

    /** "Crear plan anual {año}": vacio, para el año en curso o uno futuro. */
    Mono<PlanAnual> crear(int anio);

    Mono<Void> ponerCelda(int anio, UUID categoriaId, int mes, long monto);

    /** {@code categoriaId} solo en gastos (null: "Eventos del año"); {@code enAdelante}: de ese mes a diciembre. */
    Mono<Evento> agregarEvento(int anio, String nombre, int mes, long monto, String tipo, UUID usuarioId, UUID categoriaId,
                               boolean enAdelante);

    /** Corrige un evento con los mismos datos que al agregarlo; {@code EVENTO_NO_ENCONTRADO} si no es de ese anual. */
    Mono<Evento> editarEvento(int anio, UUID eventoId, String nombre, int mes, long monto, String tipo, UUID usuarioId,
                              UUID categoriaId, boolean enAdelante);

    Mono<Void> quitarEvento(int anio, UUID eventoId);

    /** "Borrar plan de {año}": el anual y los aportes proyectados del año; los meses ya creados no cambian. */
    Mono<Void> borrar(int anio);

    /**
     * "Replicar en los 12 meses" (spec steward-plan-anual, "Replicar el mes base"): {@code tipo} MES (con {@code base}),
     * FIJOS o CERO. Crea el anual si no existe, reemplaza celdas y proyecciones del año y conserva los eventos.
     */
    Mono<PlanAnual> replicar(int anio, String tipo, YearMonth base);

    /** El aporte proyectado de un miembro en un mes; 0 lo quita. */
    Mono<Void> ponerProyeccion(int anio, UUID usuarioId, int mes, long monto);

    /** "Crear meses desde este plan": los meses creados. */
    Mono<List<YearMonth>> crearMeses(int anio);
}
