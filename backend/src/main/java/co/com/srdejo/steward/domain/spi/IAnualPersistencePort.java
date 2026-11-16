package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import co.com.srdejo.steward.domain.model.PlanAnual.Proyeccion;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Planes anuales, sus opciones y los aportes proyectados del hogar (design D2 de backend-plan-anual y de anual-opciones-y-meses). */
public interface IAnualPersistencePort {

    /** Crea el anual con sus opciones. Si el año ya tiene, falla con {@code YA_EXISTE} (indice unico). */
    Mono<PlanAnual> crear(PlanAnual anual);

    /** El anual del año con sus opciones (celdas y eventos); vacio si no tiene. */
    Mono<PlanAnual> deAnio(UUID hogarId, int anio);

    /** Los anuales desde ese año en adelante, completos. */
    Flux<PlanAnual> desde(UUID hogarId, int anio);

    /** Pone el monto de una celda de una opcion (reemplaza el anterior). */
    Mono<Void> ponerCelda(UUID anualId, UUID opcionId, UUID categoriaId, int mes, long monto);

    Mono<Evento> agregarEvento(UUID anualId, UUID opcionId, Evento evento);

    /** Pone un aporte proyectado; con 0 lo quita. */
    Mono<Void> ponerProyeccion(UUID hogarId, Proyeccion proyeccion);

    Flux<Proyeccion> proyeccionesDesde(UUID hogarId, int anio);

    /** "Meses con la Opción X": la opcion queda en uso y el anual, Creado. */
    Mono<Void> usarOpcion(UUID anualId, UUID opcionId);

    /** Borra el anual con sus opciones, celdas y eventos (en cascada). */
    Mono<Void> borrar(UUID anualId);

    /** Replicar en una opcion: reemplaza sus celdas y guarda su mes base (design D4 de anual-opciones-y-meses). */
    Mono<Void> replicar(UUID anualId, UUID opcionId, List<PlanAnual.Celda> celdas, YearMonth base);

    /** Una opcion nueva con sus celdas y eventos (duplicar). */
    Mono<PlanAnual.Opcion> crearOpcion(UUID anualId, PlanAnual.Opcion opcion);

    /** Quita una opcion con sus celdas y eventos. */
    Mono<Void> quitarOpcion(UUID opcionId);

    /** Reemplaza los aportes proyectados del año del hogar. */
    Mono<Void> reemplazarProyecciones(UUID hogarId, int anio, List<Proyeccion> proyecciones);

    /** Corrige un evento del anual (de cualquiera de sus opciones); false si no es de ese anual. */
    Mono<Boolean> editarEvento(UUID anualId, Evento evento);

    /** Quita un evento del anual; false si no es de ese anual. */
    Mono<Boolean> quitarEvento(UUID anualId, UUID eventoId);
}
