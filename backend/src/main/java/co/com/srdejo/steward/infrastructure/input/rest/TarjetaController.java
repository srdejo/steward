package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.FinanzasDtos.TarjetaRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.TarjetaResponse;
import co.com.srdejo.steward.domain.api.ITarjetasServicePort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Tarjetas de credito del hogar de la sesion (spec steward-tarjetas, design D6 de tarjetas-y-creditos). */
@RestController
public class TarjetaController {

    private final ITarjetasServicePort tarjetas;

    public TarjetaController(ITarjetasServicePort tarjetas) {
        this.tarjetas = tarjetas;
    }

    @GetMapping("/api/tarjetas")
    public Flux<TarjetaResponse> listar() {
        return tarjetas.delHogar().map(TarjetaResponse::de);
    }

    /** {@code itemId}: un item de Creditos del mes en curso que pasa a ser la linea de la tarjeta. */
    @PostMapping("/api/tarjetas")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<TarjetaResponse> crear(@RequestBody TarjetaRequest r) {
        return tarjetas.crear(r.datos(), r.itemId()).map(TarjetaResponse::de);
    }

    @PutMapping("/api/tarjetas/{id}")
    public Mono<TarjetaResponse> editar(@PathVariable UUID id, @RequestBody TarjetaRequest r) {
        return tarjetas.editar(id, r.datos()).map(TarjetaResponse::de);
    }

    @DeleteMapping("/api/tarjetas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitar(@PathVariable UUID id) {
        return tarjetas.quitar(id);
    }
}
