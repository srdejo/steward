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

    Mono<Evento> agregarEvento(int anio, String nombre, int mes, long monto, String tipo, UUID usuarioId);

    /** El aporte proyectado de un miembro en un mes; 0 lo quita. */
    Mono<Void> ponerProyeccion(int anio, UUID usuarioId, int mes, long monto);

    /** "Crear meses desde este plan": los meses creados. */
    Mono<List<YearMonth>> crearMeses(int anio);
}
