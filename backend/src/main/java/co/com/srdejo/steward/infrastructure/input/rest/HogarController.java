package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.AuthDtos.SesionResponse;
import co.com.srdejo.steward.application.dto.HogarDtos.AceptarRequest;
import co.com.srdejo.steward.application.dto.HogarDtos.HogarResponse;
import co.com.srdejo.steward.application.dto.HogarDtos.InvitacionEnviadaResponse;
import co.com.srdejo.steward.application.dto.HogarDtos.InvitacionRecibidaResponse;
import co.com.srdejo.steward.application.dto.HogarDtos.InvitarRequest;
import co.com.srdejo.steward.application.dto.HogarDtos.MiInvitacionResponse;
import co.com.srdejo.steward.application.dto.HogarDtos.NombreHogarRequest;
import co.com.srdejo.steward.domain.api.IHogarServicePort;
import co.com.srdejo.steward.domain.api.IInvitacionServicePort;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Hogar e invitaciones (spec steward-hogar). Las rutas son de "mi hogar": el hogar sale de la sesion, nunca de la URL
 * (design D6). Publica solo la consulta de una invitacion por su token.
 */
@RestController
public class HogarController {

    private final IHogarServicePort hogar;
    private final IInvitacionServicePort invitaciones;

    public HogarController(IHogarServicePort hogar, IInvitacionServicePort invitaciones) {
        this.hogar = hogar;
        this.invitaciones = invitaciones;
    }

    @PostMapping("/api/hogar")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<HogarResponse> crear(@Valid @RequestBody NombreHogarRequest request) {
        return hogar.crear(request.nombre()).map(HogarResponse::de);
    }

    @GetMapping("/api/hogar")
    public Mono<HogarResponse> obtener() {
        return hogar.obtener().map(HogarResponse::de);
    }

    @PatchMapping("/api/hogar")
    public Mono<HogarResponse> renombrar(@Valid @RequestBody NombreHogarRequest request) {
        return hogar.renombrar(request.nombre()).map(HogarResponse::de);
    }

    @PostMapping("/api/hogar/onboarding-completo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> completarOnboarding() {
        return hogar.completarOnboarding();
    }

    @DeleteMapping("/api/hogar/miembros/yo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> salir() {
        return hogar.salir();
    }

    /** 201 si es nueva; 200 si ya habia una pendiente para ese correo y se reenvio. */
    @PostMapping("/api/hogar/invitaciones")
    public Mono<ResponseEntity<InvitacionEnviadaResponse>> invitar(@Valid @RequestBody InvitarRequest request) {
        return invitaciones.invitar(request.email())
                .map(enviada -> ResponseEntity.status(enviada.nueva() ? HttpStatus.CREATED : HttpStatus.OK)
                        .body(InvitacionEnviadaResponse.de(enviada)));
    }

    @PostMapping("/api/hogar/invitaciones/{id}/reenviar")
    public Mono<InvitacionEnviadaResponse> reenviar(@PathVariable UUID id) {
        return invitaciones.reenviar(id).map(InvitacionEnviadaResponse::de);
    }

    @PostMapping("/api/hogar/invitaciones/{id}/enlace")
    public Mono<InvitacionEnviadaResponse> enlace(@PathVariable UUID id) {
        return invitaciones.enlace(id).map(InvitacionEnviadaResponse::de);
    }

    @GetMapping("/api/invitaciones/{token}")
    public Mono<InvitacionRecibidaResponse> consultar(@PathVariable String token) {
        return invitaciones.consultar(token).map(InvitacionRecibidaResponse::de);
    }

    /** Invitaciones para el correo de la sesion: quien entra sin el enlace tambien puede unirse. */
    @GetMapping("/api/mis-invitaciones")
    public Flux<MiInvitacionResponse> misInvitaciones() {
        return invitaciones.paraMi().map(MiInvitacionResponse::de);
    }

    @PostMapping("/api/mis-invitaciones/{id}/aceptar")
    public Mono<SesionResponse> aceptarMia(@PathVariable UUID id, @Valid @RequestBody AceptarRequest request) {
        return invitaciones.aceptarParaMi(id, request.nombre(), request.diezmoAportes()).map(SesionResponse::de);
    }

    @PostMapping("/api/invitaciones/{token}/aceptar")
    public Mono<SesionResponse> aceptar(@PathVariable String token, @Valid @RequestBody AceptarRequest request) {
        return invitaciones.aceptar(token, request.nombre(), request.diezmoAportes()).map(SesionResponse::de);
    }
}
