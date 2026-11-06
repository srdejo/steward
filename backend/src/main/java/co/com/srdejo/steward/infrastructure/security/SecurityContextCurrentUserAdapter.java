package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Lee el usuario del {@code SecurityContext}, que viaja en el {@code Context} de Reactor de cada peticion (design D6):
 * no hay estado compartido entre peticiones.
 */
public class SecurityContextCurrentUserAdapter implements ICurrentUserPort {

    private final IUsuarioPersistencePort usuarios;

    public SecurityContextCurrentUserAdapter(IUsuarioPersistencePort usuarios) {
        this.usuarios = usuarios;
    }

    @Override
    public Mono<UUID> usuarioId() {
        return ReactiveSecurityContextHolder.getContext()
                .mapNotNull(ctx -> ctx.getAuthentication())
                .filter(JwtAuthenticationToken.class::isInstance)
                .map(auth -> UUID.fromString(((JwtAuthenticationToken) auth).getToken().getSubject()))
                // El token de una cuenta eliminada sigue firmado: se comprueba que la cuenta exista.
                .flatMap(id -> usuarios.porId(id).map(Usuario::id))
                .switchIfEmpty(Mono.error(DomainException::noAutenticado));
    }
}
