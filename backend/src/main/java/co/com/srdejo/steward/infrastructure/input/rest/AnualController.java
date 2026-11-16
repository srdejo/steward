package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.PlanDtos.AnualRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.CeldaRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.EventoRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.EventoResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.ProyeccionRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.ReplicarRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.AnualResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.CopiarMesBaseRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.ItemRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.ItemResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.DuplicarOpcionAnualRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.MesesAnualRequest;
import co.com.srdejo.steward.application.dto.PlanDtos.MesDelAnualResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.OpcionAnualResponse;
import co.com.srdejo.steward.domain.api.IAnualServicePort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.UUID;

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

    /** "Borrar plan de {año}" (planear-anio-desde-un-mes). */
    @DeleteMapping("/api/anuales/{anio}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> borrar(@PathVariable int anio) {
        return anual.borrar(anio);
    }

    @PutMapping("/api/anuales/{anio}/celdas")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> ponerCelda(@PathVariable int anio, @RequestBody CeldaRequest r) {
        return anual.ponerCelda(anio, r.opcionId(), r.categoriaId(), r.mes(), r.monto());
    }

    @PostMapping("/api/anuales/{anio}/eventos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<EventoResponse> agregarEvento(@PathVariable int anio, @RequestBody EventoRequest r) {
        return anual.agregarEvento(anio, r.opcionId(), r.nombre(), r.mes(), r.monto(), r.tipo(), r.usuarioId(), r.categoriaId(), r.adelante())
                .map(EventoResponse::de);
    }

    @PutMapping("/api/anuales/{anio}/eventos/{eventoId}")
    public Mono<EventoResponse> editarEvento(@PathVariable int anio, @PathVariable UUID eventoId, @RequestBody EventoRequest r) {
        return anual.editarEvento(anio, eventoId, r.nombre(), r.mes(), r.monto(), r.tipo(), r.usuarioId(), r.categoriaId(), r.adelante())
                .map(EventoResponse::de);
    }

    @DeleteMapping("/api/anuales/{anio}/eventos/{eventoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarEvento(@PathVariable int anio, @PathVariable UUID eventoId) {
        return anual.quitarEvento(anio, eventoId);
    }

    /** "Replicar en los 12 meses" (design D1 de planear-anio-desde-un-mes). */
    @PostMapping("/api/anuales/{anio}/replicar")
    public Mono<AnualResponse> replicar(@PathVariable int anio, @RequestBody ReplicarRequest r) {
        YearMonth base = r.anio() == null || r.mes() == null || r.mes() < 1 || r.mes() > 12 ? null : YearMonth.of(r.anio(), r.mes());
        return anual.replicar(anio, r.tipo(), base, r.opcionId()).map(AnualResponse::de);
    }

    @PutMapping("/api/anuales/{anio}/proyecciones")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> ponerProyeccion(@PathVariable int anio, @RequestBody ProyeccionRequest r) {
        return anual.ponerProyeccion(anio, r.usuarioId(), r.mes(), r.monto());
    }

    /** "+ Duplicar Opción X" (design D2 de anual-opciones-y-meses). */
    @PostMapping("/api/anuales/{anio}/opciones")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<OpcionAnualResponse> duplicarOpcion(@PathVariable int anio, @RequestBody DuplicarOpcionAnualRequest r) {
        // Con {@code desde}, una opcion nueva desde un mes base (anual-mes-base-editable); si no, duplicar.
        return (r.desde() != null ? anual.nuevaOpcion(anio, r.desde().fuente()) : anual.duplicarOpcion(anio, r.desdeId()))
                .map(OpcionAnualResponse::de);
    }

    /** "Copiar otro mes" en el mes base de una opcion (design D3 de anual-mes-base-editable). */
    @PutMapping("/api/anuales/{anio}/opciones/{opcionId}/base")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> copiarMesBase(@PathVariable int anio, @PathVariable UUID opcionId, @RequestBody CopiarMesBaseRequest r) {
        return anual.copiarMesBase(anio, opcionId, r.desde() == null ? null : r.desde().fuente());
    }

    @PostMapping("/api/anuales/{anio}/opciones/{opcionId}/base/items")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<ItemResponse> agregarItemBase(@PathVariable int anio, @PathVariable UUID opcionId, @RequestBody ItemRequest r) {
        return anual.agregarItemBase(anio, opcionId, r.datos()).map(ItemResponse::de);
    }

    @PutMapping("/api/anuales/{anio}/opciones/{opcionId}/base/items/{itemId}")
    public Mono<ItemResponse> editarItemBase(@PathVariable int anio, @PathVariable UUID opcionId, @PathVariable UUID itemId,
                                             @RequestBody ItemRequest r) {
        return anual.editarItemBase(anio, opcionId, itemId, r.datos()).map(ItemResponse::de);
    }

    @DeleteMapping("/api/anuales/{anio}/opciones/{opcionId}/base/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarItemBase(@PathVariable int anio, @PathVariable UUID opcionId, @PathVariable UUID itemId) {
        return anual.quitarItemBase(anio, opcionId, itemId);
    }

    /** "Usar este mes en los 12 meses". */
    @PostMapping("/api/anuales/{anio}/opciones/{opcionId}/base/usar")
    public Mono<AnualResponse> usarMesBase(@PathVariable int anio, @PathVariable UUID opcionId) {
        return anual.usarMesBase(anio, opcionId).map(AnualResponse::de);
    }

    @DeleteMapping("/api/anuales/{anio}/opciones/{opcionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarOpcion(@PathVariable int anio, @PathVariable UUID opcionId) {
        return anual.quitarOpcion(anio, opcionId);
    }

    /** "Meses con la Opción X": crea los meses sin plan y actualiza los pedidos (design D3 de anual-opciones-y-meses). */
    @PostMapping("/api/anuales/{anio}/meses")
    public Flux<MesDelAnualResponse> meses(@PathVariable int anio, @RequestBody MesesAnualRequest r) {
        return anual.meses(anio, r.opcionId(), r.actualizar()).flatMapMany(Flux::fromIterable)
                .map(m -> new MesDelAnualResponse(m.ref().getYear(), m.ref().getMonthValue(), m.accion().name()));
    }
}
