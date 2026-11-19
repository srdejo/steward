package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.spi.IComoUsuarioPort;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

/**
 * Corre una accion con la persona del identificador firmado como usuario de la sesion (design D5 de avisos-pagos): el
 * caso de uso de Finanzas lee al usuario del contexto de seguridad, como en cualquier peticion con sesion.
 */
public class ComoUsuarioAdapter implements IComoUsuarioPort {

    @Override
    public <T> Mono<T> como(UUID usuarioId, Mono<T> accion) {
        Jwt jwt = Jwt.withTokenValue("aviso").header("alg", "none").subject(usuarioId.toString())
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        return accion.contextWrite(ReactiveSecurityContextHolder.withAuthentication(new JwtAuthenticationToken(jwt)));
    }
}
