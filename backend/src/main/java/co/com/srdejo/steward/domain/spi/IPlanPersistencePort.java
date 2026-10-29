package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.UUID;

/** Planes de los meses con sus opciones e items. Toda busqueda lleva el hogar del usuario. */
public interface IPlanPersistencePort {

    /** Crea el plan con sus opciones e items. Si el mes ya tiene plan, falla con {@code YA_EXISTE} (indice unico). */
    Mono<PlanMes> crear(PlanMes plan);

    /** El plan completo (opciones e items) de ese mes; vacio si no tiene. */
    Mono<PlanMes> deMes(UUID hogarId, YearMonth ref);

    Mono<PlanMes> porIdEnHogar(UUID planId, UUID hogarId);

    /** Los planes completos desde ese mes en adelante, en orden. */
    Flux<PlanMes> desde(UUID hogarId, YearMonth desde);

    Mono<ItemPlan> crearItem(ItemPlan item);

    Mono<ItemPlan> actualizarItem(ItemPlan item);

    Mono<Void> quitarItem(UUID itemId);

    Mono<Void> usar(UUID planId, UUID escenarioId);
}
