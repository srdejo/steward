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

    /** {@code tipo}: FIJO, VARIABLE, CUOTA o CREDITO. Cuota actual y total van juntas o ninguna. */
    record DatosItem(UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo, Integer cuotaActual,
                     Integer cuotaTotal) {
    }
}
