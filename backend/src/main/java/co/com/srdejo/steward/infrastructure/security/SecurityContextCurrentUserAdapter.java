package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Lee el usuario del {@code SecurityContext}, que viaja en el {@code Context} de Reactor de cada peticion (design D6):
 * no hay estado compartido entre peticiones.
 */
public class SecurityContextCurrentUserAdapter implements ICurrentUserPort {

    @Override
    public Mono<UUID> usuarioId() {
        return ReactiveSecurityContextHolder.getContext()
                .mapNotNull(ctx -> ctx.getAuthentication())
                .filter(JwtAuthenticationToken.class::isInstance)
                .map(auth -> UUID.fromString(((JwtAuthenticationToken) auth).getToken().getSubject()))
                .switchIfEmpty(Mono.error(DomainException::noAutenticado));
    }
}
