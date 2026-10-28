package co.com.srdejo.steward.contract;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

/**
 * ID tokens "de Google" firmados con la llave de prueba (src/test/resources/contract). El perfil contract los valida con
 * la llave publica correspondiente, igual que validaria uno real.
 */
public final class GoogleDePrueba {

    public static final String CLIENT_ID = "contract-client-id";

    private static final NimbusJwtEncoder ENCODER;
    public static final RSAPublicKey LLAVE_PUBLICA;

    static {
        try (InputStream in = GoogleDePrueba.class.getResourceAsStream("/contract/google-test-private.pem")) {
            String pem = new String(in.readAllBytes(), StandardCharsets.US_ASCII)
                    .replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            KeyFactory rsa = KeyFactory.getInstance("RSA");
            RSAPrivateCrtKey privada = (RSAPrivateCrtKey) rsa.generatePrivate(
                    new PKCS8EncodedKeySpec(Base64.getDecoder().decode(pem)));
            LLAVE_PUBLICA = (RSAPublicKey) rsa.generatePublic(
                    new RSAPublicKeySpec(privada.getModulus(), privada.getPublicExponent()));
            RSAKey jwk = new RSAKey.Builder(LLAVE_PUBLICA).privateKey(privada).keyID("prueba").build();
            ENCODER = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk)));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private GoogleDePrueba() {
    }

    public static String token(String email, String nombre) {
        return token(email, nombre, CLIENT_ID, "https://accounts.google.com", true, Instant.now());
    }

    public static String token(String email, String nombre, String audiencia, String emisor, boolean verificado,
                               Instant emitido) {
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(emisor)
                .audience(List.of(audiencia))
                .subject("google-" + email)
                .issuedAt(emitido)
                .expiresAt(emitido.plus(Duration.ofHours(1)))
                .claim("email", email)
                .claim("email_verified", verificado);
        if (nombre != null) {
            claims.claim("name", nombre);
        }
        return ENCODER.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).keyId("prueba").build(),
                claims.build())).getTokenValue();
    }
}
