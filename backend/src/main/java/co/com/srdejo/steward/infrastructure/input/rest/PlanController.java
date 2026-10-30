package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.PlanDtos.CategoriaResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.ConteoBorradoResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.CrearPlanRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.DuplicarRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.ItemRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.ItemResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.LineaRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.LineaResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.NombreRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.PlanResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.UsarRequest;
import co.com.srdejo.steward.domain.api.IPlanServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.spi.IClockPort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
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

    @PostMapping("/api/planes/{id}/escenarios/{escenarioId}/items/{itemId}/recalcular")
    public Mono<ItemResponse> recalcularDiezmo(@PathVariable UUID id, @PathVariable UUID escenarioId, @PathVariable UUID itemId) {
        return plan.recalcularDiezmo(id, escenarioId, itemId).map(ItemResponse::de);
    }

    /** Lo que se borra con el plan del mes ({@code 2026-10}), para la confirmacion (design D4 de usabilidad-plan). */
    @GetMapping("/api/meses/{ref}/borrado")
    public Mono<ConteoBorradoResponse> conteoBorrado(@PathVariable String ref) {
        return Mono.fromCallable(() -> mes(ref)).flatMap(plan::conteoBorrado).map(ConteoBorradoResponse::de);
    }

    /** "Borrar plan de {mes}": tambien sirve para un mes cerrado sin plan. */
    @DeleteMapping("/api/meses/{ref}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> borrarPlan(@PathVariable String ref) {
        return Mono.fromCallable(() -> mes(ref)).flatMap(plan::borrarPlan);
    }

    private static YearMonth mes(String ref) {
        try {
            return YearMonth.parse(ref);
        } catch (DateTimeParseException e) {
            throw DomainException.datosInvalidos("El mes va como 2026-10");
        }
    }

    @DeleteMapping("/api/planes/{id}/escenarios/{escenarioId}/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarItem(@PathVariable UUID id, @PathVariable UUID escenarioId, @PathVariable UUID itemId) {
        return plan.quitarItem(id, escenarioId, itemId);
    }

    @PostMapping("/api/planes/{id}/escenarios/{escenarioId}/ingresos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<LineaResponse> agregarIngreso(@PathVariable UUID id, @PathVariable UUID escenarioId, @RequestBody LineaRequest r) {
        return plan.agregarIngreso(id, escenarioId, r.datos()).map(LineaResponse::de);
    }

    @PutMapping("/api/planes/{id}/escenarios/{escenarioId}/ingresos/{ingresoId}")
    public Mono<LineaResponse> editarIngreso(@PathVariable UUID id, @PathVariable UUID escenarioId, @PathVariable UUID ingresoId,
                                             @RequestBody LineaRequest r) {
        return plan.editarIngreso(id, escenarioId, ingresoId, r.datos()).map(LineaResponse::de);
    }

    @DeleteMapping("/api/planes/{id}/escenarios/{escenarioId}/ingresos/{ingresoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarIngreso(@PathVariable UUID id, @PathVariable UUID escenarioId, @PathVariable UUID ingresoId) {
        return plan.quitarIngreso(id, escenarioId, ingresoId);
    }
}
