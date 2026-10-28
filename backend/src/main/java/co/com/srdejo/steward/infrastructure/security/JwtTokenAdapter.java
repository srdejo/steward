package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ITokenPort;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Token de sesion: JWT HS256 con {@code sub} = id del usuario, {@code iat} y {@code exp} (design D4). El backend no guarda
 * estado de sesion; el mismo secreto firma y valida.
 */
public class JwtTokenAdapter implements ITokenPort {

    static final int MIN_SECRET_LENGTH = 64;

    private final NimbusJwtEncoder encoder;
    private final Duration ttl;
    private final IClockPort clock;

    public JwtTokenAdapter(String secret, Duration ttl, IClockPort clock) {
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key(secret)));
        this.ttl = ttl;
        this.clock = clock;
    }

    @Override
    public String emitir(UUID usuarioId) {
        Instant ahora = clock.ahora();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(usuarioId.toString())
                .issuedAt(ahora)
                .expiresAt(ahora.plus(ttl))
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    /** Decoder de la sesion: misma clave y HS256; la vigencia la valida el validador por defecto de Spring. */
    public static ReactiveJwtDecoder decoder(String secret) {
        return NimbusReactiveJwtDecoder.withSecretKey(key(secret)).macAlgorithm(MacAlgorithm.HS256).build();
    }

    static SecretKey key(String secret) {
        if (secret == null || secret.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException("steward.security.jwt-secret (JWT_SECRET) debe tener al menos "
                    + MIN_SECRET_LENGTH + " caracteres");
        }
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }
}
