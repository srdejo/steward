package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.IdentidadApple;
import reactor.core.publisher.Mono;

/** Sign in with Apple (design D4 y D5 de app-movil-conectada). */
public interface IAppleIdentityPort {

    /** La identidad del token si es valido para nuestra app; vacio si no. */
    Mono<IdentidadApple> verificar(String identityToken);

    /** Revoca el acceso de la cuenta con un authorizationCode reciente. Nunca falla: un error solo se registra. */
    Mono<Void> revocar(String authorizationCode);
}
