package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.PlanDtos.CierreRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.CierreResponse;
import co.com.srdejo.steward.domain.api.ICierreServicePort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/** "Cerrar {mes}" (spec steward-plan-mes, design D1 de backend-cierre-mes). El hogar sale de la sesion. */
@RestController
public class CierreController {

    private final ICierreServicePort cierres;

    public CierreController(ICierreServicePort cierres) {
        this.cierres = cierres;
    }

    @PostMapping("/api/cierres")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CierreResponse> cerrar(@RequestBody CierreRequest r) {
        return Mono.fromCallable(r::datos).flatMap(cierres::cerrar).map(CierreResponse::de);
    }
}
