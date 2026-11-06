package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.model.IdentidadApple;
import co.com.srdejo.steward.domain.spi.IAppleIdentityPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import reactor.core.publisher.Mono;

import java.security.interfaces.RSAPublicKey;

/**
 * Verifica el identityToken de Sign in with Apple: firma con las llaves publicas de Apple, emisor, audiencia (el bundle id)
 * y vigencia. La revocacion va aparte, en {@link AppleRevocacion}, porque es lo unico que necesita la llave privada.
 */
public class AppleIdentityAdapter implements IAppleIdentityPort {

    public static final String APPLE_JWKS = "https://appleid.apple.com/auth/keys";
    private static final String ISSUER = "https://appleid.apple.com";
    private static final Logger log = LoggerFactory.getLogger(AppleIdentityAdapter.class);

    private final ReactiveJwtDecoder decoder;
    private final AppleRevocacion revocacion;

    private AppleIdentityAdapter(ReactiveJwtDecoder decoder, AppleRevocacion revocacion) {
        this.decoder = decoder;
        this.revocacion = revocacion;
    }

    public static AppleIdentityAdapter conJwksDeApple(String clientId, AppleRevocacion revocacion) {
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withJwkSetUri(APPLE_JWKS).build();
        decoder.setJwtValidator(validator(clientId));
        return new AppleIdentityAdapter(decoder, revocacion);
    }

    /** Perfil contract: una llave RSA local en lugar de Apple, con las mismas validaciones. */
    public static AppleIdentityAdapter conLlaveDePrueba(String clientId, RSAPublicKey llave, AppleRevocacion revocacion) {
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withPublicKey(llave).build();
        decoder.setJwtValidator(validator(clientId));
        return new AppleIdentityAdapter(decoder, revocacion);
    }

    static OAuth2TokenValidator<Jwt> validator(String clientId) {
        return new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                jwt -> check(ISSUER.equals(jwt.getClaimAsString("iss")), "issuer"),
                jwt -> check(jwt.getAudience() != null && jwt.getAudience().contains(clientId), "audience"),
                jwt -> check(jwt.getSubject() != null && !jwt.getSubject().isBlank(), "subject"));
    }

    @Override
    public Mono<IdentidadApple> verificar(String identityToken) {
        if (identityToken == null || identityToken.isBlank()) {
            return Mono.empty();
        }
        return decoder.decode(identityToken)
                // Apple manda email_verified como booleano o como texto.
                .map(jwt -> new IdentidadApple(jwt.getSubject(),
                        "true".equalsIgnoreCase(String.valueOf(jwt.getClaims().get("email_verified")))
                                ? jwt.getClaimAsString("email") : null))
                .onErrorResume(JwtException.class, ex -> {
                    log.warn("Token de Apple rechazado: {}", ex.getMessage());
                    return Mono.empty();
                });
    }

    @Override
    public Mono<Void> revocar(String authorizationCode) {
        return revocacion.revocar(authorizationCode);
    }

    private static OAuth2TokenValidatorResult check(boolean ok, String what) {
        return ok ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Apple " + what + " invalido", null));
    }
}
