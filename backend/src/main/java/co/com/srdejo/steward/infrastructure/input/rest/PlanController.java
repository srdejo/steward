package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.PlanDtos.CategoriaResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.CrearPlanRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.DuplicarRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.ItemRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.ItemResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.NombreRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.PlanResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.UsarRequest;
import co.com.srdejo.steward.domain.api.IPlanServicePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Categorias y plan del mes (spec steward-plan-mes). Como el resto, el hogar sale de la sesion; los ids de la URL se
 * buscan dentro de ese hogar.
 */
@RestController
public class PlanController {

    private final IPlanServicePort plan;
    private final IClockPort clock;

    public PlanController(IPlanServicePort plan, IClockPort clock) {
        this.plan = plan;
        this.clock = clock;
    }

    @PostMapping("/api/categorias")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CategoriaResponse> crearCategoria(@RequestBody NombreRequest r) {
        return plan.crearCategoria(r.nombre()).map(CategoriaResponse::de);
    }

    @PatchMapping("/api/categorias/{id}")
    public Mono<CategoriaResponse> renombrarCategoria(@PathVariable UUID id, @RequestBody NombreRequest r) {
        return plan.renombrarCategoria(id, r.nombre()).map(CategoriaResponse::de);
    }

    @PostMapping("/api/planes")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<PlanResponse> crearPlan(@RequestBody CrearPlanRequest r) {
        return plan.crearPlan(r.ref(), r.modo()).map(p -> PlanResponse.de(p, clock.hoy()));
    }

    @PostMapping("/api/planes/{id}/usar")
    public Mono<PlanResponse> usar(@PathVariable UUID id, @RequestBody UsarRequest r) {
        return plan.usar(id, r.escenarioId()).map(p -> PlanResponse.de(p, clock.hoy()));
    }

    @PostMapping("/api/planes/{id}/escenarios")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<PlanResponse> duplicar(@PathVariable UUID id, @RequestBody DuplicarRequest r) {
        return plan.duplicar(id, r.desde(), r.nota()).map(p -> PlanResponse.de(p, clock.hoy()));
    }

    @DeleteMapping("/api/planes/{id}/escenarios/{escenarioId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarOpcion(@PathVariable UUID id, @PathVariable UUID escenarioId) {
        return plan.quitarOpcion(id, escenarioId);
    }

    @PostMapping("/api/planes/{id}/escenarios/{escenarioId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<ItemResponse> agregarItem(@PathVariable UUID id, @PathVariable UUID escenarioId, @RequestBody ItemRequest r) {
        return plan.agregarItem(id, escenarioId, r.datos()).map(ItemResponse::de);
    }

    @PutMapping("/api/planes/{id}/escenarios/{escenarioId}/items/{itemId}")
    public Mono<ItemResponse> editarItem(@PathVariable UUID id, @PathVariable UUID escenarioId, @PathVariable UUID itemId,
                                         @RequestBody ItemRequest r) {
        return plan.editarItem(id, escenarioId, itemId, r.datos()).map(ItemResponse::de);
    }

    @DeleteMapping("/api/planes/{id}/escenarios/{escenarioId}/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarItem(@PathVariable UUID id, @PathVariable UUID escenarioId, @PathVariable UUID itemId) {
        return plan.quitarItem(id, escenarioId, itemId);
    }
}
