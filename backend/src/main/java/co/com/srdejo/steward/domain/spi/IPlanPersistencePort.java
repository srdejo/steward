package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
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

    /** El plan completo mas reciente anterior a ese mes; vacio si no hay. */
    Mono<PlanMes> ultimoAntesDe(UUID hogarId, YearMonth ref);

    /** Los planes completos desde ese mes en adelante, en orden. */
    Flux<PlanMes> desde(UUID hogarId, YearMonth desde);

    Mono<ItemPlan> crearItem(ItemPlan item);

    Mono<ItemPlan> actualizarItem(ItemPlan item);

    Mono<Void> quitarItem(UUID itemId);

    Mono<Void> usar(UUID planId, UUID escenarioId);

    /**
     * Agrega una opcion con sus items. Si su letra ya la tomo otra opcion del mismo plan (dos a la vez), falla con
     * {@code LETRA_OCUPADA} para que el caso de uso reintente (design D3 de backend-opciones-mes).
     */
    Mono<Escenario> crearEscenario(Escenario escenario);

    /** Borra la opcion con sus items (design D5 de backend-opciones-mes). */
    Mono<Void> quitarEscenario(UUID escenarioId);
}
