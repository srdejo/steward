package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.PlanDtos.AnualRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.CeldaRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.EventoRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.EventoResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.MesCreadoResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.ProyeccionRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.AnualResponse;
import co.com.srdejo.steward.domain.api.IAnualServicePort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** El plan anual del hogar (spec steward-plan-anual, design D3 de backend-plan-anual). El hogar sale de la sesion. */
@RestController
public class AnualController {

    private final IAnualServicePort anual;

    public AnualController(IAnualServicePort anual) {
        this.anual = anual;
    }

    @PostMapping("/api/anuales")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<AnualResponse> crear(@RequestBody AnualRequest r) {
        return anual.crear(r.anio()).map(AnualResponse::de);
    }

    @PutMapping("/api/anuales/{anio}/celdas")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> ponerCelda(@PathVariable int anio, @RequestBody CeldaRequest r) {
        return anual.ponerCelda(anio, r.categoriaId(), r.mes(), r.monto());
    }

    @PostMapping("/api/anuales/{anio}/eventos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<EventoResponse> agregarEvento(@PathVariable int anio, @RequestBody EventoRequest r) {
        return anual.agregarEvento(anio, r.nombre(), r.mes(), r.monto(), r.tipo(), r.usuarioId()).map(EventoResponse::de);
    }

    @PutMapping("/api/anuales/{anio}/proyecciones")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> ponerProyeccion(@PathVariable int anio, @RequestBody ProyeccionRequest r) {
        return anual.ponerProyeccion(anio, r.usuarioId(), r.mes(), r.monto());
    }

    @PostMapping("/api/anuales/{anio}/crear-meses")
    public Flux<MesCreadoResponse> crearMeses(@PathVariable int anio) {
        return anual.crearMeses(anio).flatMapMany(Flux::fromIterable).map(m -> new MesCreadoResponse(m.getYear(), m.getMonthValue()));
    }
}
