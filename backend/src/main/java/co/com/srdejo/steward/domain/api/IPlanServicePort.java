package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.UUID;

/** Categorias y plan del mes del hogar de la sesion (spec steward-plan-mes). */
public interface IPlanServicePort {

    Mono<Categoria> crearCategoria(String nombre);

    Mono<Categoria> renombrarCategoria(UUID id, String nombre);

    /** {@code modo}: COPIAR, FIJOS o CERO, como {@code crearMes} del dominio. */
    Mono<PlanMes> crearPlan(YearMonth ref, String modo);

    Mono<ItemPlan> agregarItem(UUID planId, UUID escenarioId, DatosItem datos);

    Mono<ItemPlan> editarItem(UUID planId, UUID escenarioId, UUID itemId, DatosItem datos);

    Mono<Void> quitarItem(UUID planId, UUID escenarioId, UUID itemId);

    /** "+ Ingreso": una linea OTRO en la opcion (design D8 de diezmo-como-gasto). */
    Mono<IngresoPlan> agregarIngreso(UUID planId, UUID escenarioId, DatosLinea datos);

    /** Editar una linea: conserva su tipo y su ingreso fijo. */
    Mono<IngresoPlan> editarIngreso(UUID planId, UUID escenarioId, UUID lineaId, DatosLinea datos);

    /** Una linea ya recibida en su mes no se quita ({@code INGRESO_RECIBIDO}). */
    Mono<Void> quitarIngreso(UUID planId, UUID escenarioId, UUID lineaId);

    /** "Usar opcion": queda como la que se ejecuta en el mes. */
    Mono<PlanMes> usar(UUID planId, UUID escenarioId);

    /** "+ Duplicar": copia la opcion {@code desde} con la siguiente letra libre (solo en Borrador). Devuelve el plan. */
    Mono<PlanMes> duplicar(UUID planId, UUID desde, String nota);

    /** "Quitar opcion": borra una opcion que ya no sirve (solo en Borrador). */
    Mono<Void> quitarOpcion(UUID planId, UUID escenarioId);

    /** "Probarlo como opcion de {mes}": una copia de la principal con el abono extra al credito. */
    Mono<OpcionNueva> probarAbono(UUID creditoId, YearMonth ref, long abono);

    record OpcionNueva(UUID planId, UUID escenarioId) {
    }

    /** {@code usuarioId}: la persona de la linea, opcional (miembro del hogar). */
    record DatosLinea(String nombre, long monto, UUID usuarioId) {
    }

    /** {@code tipo}: FIJO, VARIABLE, CUOTA, CREDITO o DIEZMO. Cuota actual y total van juntas o ninguna. */
    /** {@code creditoId}: el credito del hogar al que corresponde; al editar, null conserva el que tenia. */
    record DatosItem(UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo, Integer cuotaActual,
                     Integer cuotaTotal, UUID creditoId) {
    }
}
