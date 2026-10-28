package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.AuthDtos.AuthConfigResponse;
import co.com.srdejo.steward.application.dto.AuthDtos.DevLoginRequest;
import co.com.srdejo.steward.application.dto.AuthDtos.GoogleLoginRequest;
import co.com.srdejo.steward.application.dto.AuthDtos.PerfilRequest;
import co.com.srdejo.steward.application.dto.AuthDtos.SesionResponse;
import co.com.srdejo.steward.application.dto.AuthDtos.UsuarioResponse;
import co.com.srdejo.steward.domain.api.IAuthServicePort;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/** Acceso (spec steward-auth). Publicas: config y login con Google; el resto exige sesion. */
@RestController
public class AuthController {

    private final IAuthServicePort auth;

    public AuthController(IAuthServicePort auth) {
        this.auth = auth;
    }

    @GetMapping("/api/auth/config")
    public AuthConfigResponse config() {
        return new AuthConfigResponse(auth.googleClientId().orElse(null), auth.devLogin());
    }

    /** Acceso de desarrollo (solo local, design D5): 404 si esta apagado. */
    @PostMapping("/api/auth/dev")
    public Mono<SesionResponse> desarrollo(@Valid @RequestBody DevLoginRequest request) {
        return auth.loginDesarrollo(request.email(), request.nombre()).map(SesionResponse::de);
    }

    @PostMapping("/api/auth/google")
    public Mono<SesionResponse> google(@Valid @RequestBody GoogleLoginRequest request) {
        return auth.loginConGoogle(request.idToken()).map(SesionResponse::de);
    }

    @GetMapping("/api/sesion")
    public Mono<SesionResponse> sesion() {
        return auth.sesionActual().map(SesionResponse::de);
    }

    @PatchMapping("/api/perfil")
    public Mono<UsuarioResponse> perfil(@Valid @RequestBody PerfilRequest request) {
        return auth.cambiarNombre(request.nombre()).map(UsuarioResponse::de);
    }
}
