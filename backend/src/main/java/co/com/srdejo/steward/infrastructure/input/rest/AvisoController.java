package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.AvisoDtos.AccionRequest;
import co.com.srdejo.steward.application.dto.AvisoDtos.AvisoResponse;
import co.com.srdejo.steward.application.dto.AvisoDtos.ClaveWebResponse;
import co.com.srdejo.steward.application.dto.AvisoDtos.DispositivoRequest;
import co.com.srdejo.steward.application.dto.AvisoDtos.PreferenciasDto;
import co.com.srdejo.steward.application.dto.AvisoDtos.TokenRequest;
import co.com.srdejo.steward.domain.api.IAvisosServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.DispositivoAviso;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.List;

/** Avisos de pagos de la persona con sesion (spec steward-avisos, "API de avisos"); la accion va sin sesion. */
@RestController
public class AvisoController {

    private final IAvisosServicePort avisos;

    public AvisoController(IAvisosServicePort avisos) {
        this.avisos = avisos;
    }

    @GetMapping("/api/avisos/proximos")
    public Mono<List<AvisoResponse>> proximos() {
        return avisos.proximos().map(l -> l.stream().map(AvisoResponse::de).toList());
    }

    @GetMapping("/api/avisos/preferencias")
    public Mono<PreferenciasDto> preferencias() {
        return avisos.preferencias().map(PreferenciasDto::de);
    }

    @PutMapping("/api/avisos/preferencias")
    public Mono<PreferenciasDto> guardarPreferencias(@RequestBody PreferenciasDto p) {
        return avisos.guardarPreferencias(p.dominio()).map(PreferenciasDto::de);
    }

    @PostMapping("/api/avisos/dispositivos")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> registrar(@RequestBody DispositivoRequest r) {
        DispositivoAviso.Tipo tipo;
        try {
            tipo = DispositivoAviso.Tipo.valueOf(String.valueOf(r.tipo()));
        } catch (IllegalArgumentException ex) {
            return Mono.error(DomainException.datosInvalidos("Falta el dispositivo"));
        }
        String token = tipo == DispositivoAviso.Tipo.WEB ? r.endpoint() : r.token();
        return avisos.registrarDispositivo(tipo, token, r.p256dh(), r.auth());
    }

    @PostMapping("/api/avisos/dispositivos/quitar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitar(@RequestBody TokenRequest r) {
        return avisos.quitarDispositivo(r.token());
    }

    @PostMapping("/api/avisos/prueba")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> probar() {
        return avisos.probar();
    }

    @GetMapping("/api/avisos/clave-web")
    public Mono<ClaveWebResponse> claveWeb() {
        return Mono.just(new ClaveWebResponse(avisos.claveWeb()));
    }

    /** Las acciones del aviso en el navegador: el service worker de Angular las pide con GET (design D9). */
    @GetMapping("/api/avisos/accion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> accionDesdeElNavegador(@org.springframework.web.bind.annotation.RequestParam String accion,
                                             @org.springframework.web.bind.annotation.RequestParam String que) {
        return avisos.accion(accion, que);
    }

    @PostMapping("/api/avisos/accion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> accion(@RequestBody AccionRequest r) {
        return avisos.accion(r.accion(), r.que());
    }
}
