package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.model.IdentidadGoogle;
import co.com.srdejo.steward.domain.spi.IGoogleIdentityPort;
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
import java.util.Optional;
import java.util.Set;

/**
 * Verifica el ID token de Google Identity Services: firma con las llaves publicas de Google, emisor, audiencia (el client
 * id de beauty, design D5), vigencia y correo verificado. Sin client secret. Mismo enfoque que denti-caja.
 */
public class GoogleIdentityAdapter implements IGoogleIdentityPort {

    public static final String GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");
    private static final Logger log = LoggerFactory.getLogger(GoogleIdentityAdapter.class);

    private final String clientId;
    private final ReactiveJwtDecoder decoder;

    GoogleIdentityAdapter(String clientId, ReactiveJwtDecoder decoder) {
        this.clientId = clientId;
        this.decoder = decoder;
    }

    /** Produccion: llaves de Google por JWKS. Sin client id el login con Google queda deshabilitado. */
    public static GoogleIdentityAdapter conJwksDeGoogle(String clientId) {
        String id = limpio(clientId);
        if (id == null) {
            return new GoogleIdentityAdapter(null, null);
        }
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withJwkSetUri(GOOGLE_JWKS).build();
        decoder.setJwtValidator(validator(id));
        return new GoogleIdentityAdapter(id, decoder);
    }

    /** Perfil contract (design D8): una llave RSA local en lugar de Google, con las mismas validaciones. */
    public static GoogleIdentityAdapter conLlaveDePrueba(String clientId, RSAPublicKey llave) {
        String id = limpio(clientId);
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withPublicKey(llave).build();
        decoder.setJwtValidator(validator(id));
        return new GoogleIdentityAdapter(id, decoder);
    }

    public static OAuth2TokenValidator<Jwt> validator(String clientId) {
        return new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                // El emisor puede venir sin esquema: no usar getIssuer().
                jwt -> check(ISSUERS.contains(jwt.getClaimAsString("iss")), "issuer"),
                jwt -> check(jwt.getAudience() != null && jwt.getAudience().contains(clientId), "audience"),
                jwt -> check(Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))
                        && jwt.getClaimAsString("email") != null, "email_verified"));
    }

    @Override
    public Optional<String> clientId() {
        return Optional.ofNullable(clientId);
    }

    @Override
    public Mono<IdentidadGoogle> verificar(String idToken) {
        if (decoder == null || idToken == null || idToken.isBlank()) {
            return Mono.empty();
        }
        return decoder.decode(idToken)
                .map(jwt -> new IdentidadGoogle(jwt.getClaimAsString("email"), jwt.getClaimAsString("name")))
                .onErrorResume(JwtException.class, ex -> {
                    log.warn("Token de Google rechazado: {}", ex.getMessage());
                    return Mono.empty();
                });
    }

    private static OAuth2TokenValidatorResult check(boolean ok, String what) {
        return ok ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Google " + what + " invalido", null));
    }

    private static String limpio(String clientId) {
        return clientId == null || clientId.isBlank() ? null : clientId.trim();
    }
}
