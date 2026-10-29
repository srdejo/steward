package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.PlanMes;
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

    /** {@code tipo}: FIJO, VARIABLE, CUOTA o CREDITO. Cuota actual y total van juntas o ninguna. */
    /** {@code creditoId}: el credito del hogar al que corresponde; al editar, null conserva el que tenia. */
    record DatosItem(UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo, Integer cuotaActual,
                     Integer cuotaTotal, UUID creditoId) {
    }
}
