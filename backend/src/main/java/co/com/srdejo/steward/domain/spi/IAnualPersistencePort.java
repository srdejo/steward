package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import co.com.srdejo.steward.domain.model.PlanAnual.Proyeccion;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Planes anuales y aportes proyectados del hogar (design D2 de backend-plan-anual). */
public interface IAnualPersistencePort {

    /** Crea el anual vacio. Si el año ya tiene, falla con {@code YA_EXISTE} (indice unico). */
    Mono<PlanAnual> crear(PlanAnual anual);

    /** El anual del año con sus celdas y eventos; vacio si no tiene. */
    Mono<PlanAnual> deAnio(UUID hogarId, int anio);

    /** Los anuales desde ese año en adelante, completos. */
    Flux<PlanAnual> desde(UUID hogarId, int anio);

    /** Pone el monto de una celda (reemplaza el anterior). */
    Mono<Void> ponerCelda(UUID anualId, UUID categoriaId, int mes, long monto);

    Mono<Evento> agregarEvento(UUID anualId, Evento evento);

    /** Pone un aporte proyectado; con 0 lo quita. */
    Mono<Void> ponerProyeccion(UUID hogarId, Proyeccion proyeccion);

    Flux<Proyeccion> proyeccionesDesde(UUID hogarId, int anio);

    Mono<Void> marcarCreado(UUID anualId);
}
