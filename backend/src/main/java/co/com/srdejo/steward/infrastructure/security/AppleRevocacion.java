package co.com.srdejo.steward.infrastructure.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * Revoca el acceso con Apple al eliminar una cuenta (design D5 de app-movil-conectada): cambia el authorizationCode por un
 * token y lo revoca con su REST API, firmando con la llave .p8. No se guarda ningun token. Sin llave configurada, o si
 * Apple falla, solo se registra: la cuenta se elimina igual.
 */
public class AppleRevocacion {

    static final String BASE = "https://appleid.apple.com";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final Logger log = LoggerFactory.getLogger(AppleRevocacion.class);

    private final WebClient client;
    private final String clientId;
    private final String teamId;
    private final String keyId;
    private final String llavePem;

    public AppleRevocacion(WebClient.Builder builder, String baseUrl, String clientId, String teamId, String keyId, String llavePem) {
        this.client = builder.baseUrl(baseUrl).build();
        this.clientId = clientId;
        this.teamId = teamId;
        this.keyId = keyId;
        this.llavePem = llavePem;
    }

    public static AppleRevocacion deApple(WebClient.Builder builder, String clientId, String teamId, String keyId, String llavePem) {
        return new AppleRevocacion(builder, BASE, clientId, teamId, keyId, llavePem);
    }

    public Mono<Void> revocar(String authorizationCode) {
        if (authorizationCode == null || authorizationCode.isBlank()) {
            return Mono.empty();
        }
        if (vacio(teamId) || vacio(keyId) || vacio(llavePem)) {
            log.warn("Sign in with Apple sin llave configurada: no se revoco el acceso");
            return Mono.empty();
        }
        return Mono.fromCallable(this::clientSecret)
                .flatMap(secreto -> client.post().uri("/auth/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(BodyInserters.fromFormData("client_id", clientId).with("client_secret", secreto)
                                .with("code", authorizationCode).with("grant_type", "authorization_code"))
                        .retrieve()
                        .bodyToMono(Map.class)
                        .timeout(TIMEOUT)
                        .flatMap(t -> {
                            boolean refresh = t.get("refresh_token") != null;
                            String token = String.valueOf(t.get(refresh ? "refresh_token" : "access_token"));
                            return client.post().uri("/auth/revoke")
                                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                    .body(BodyInserters.fromFormData("client_id", clientId).with("client_secret", secreto)
                                            .with("token", token).with("token_type_hint", refresh ? "refresh_token" : "access_token"))
                                    .retrieve()
                                    .toBodilessEntity()
                                    .timeout(TIMEOUT);
                        }))
                .then()
                .onErrorResume(ex -> {
                    log.warn("No se pudo revocar el acceso con Apple: {}", ex.getMessage());
                    return Mono.empty();
                });
    }

    /** JWT ES256 que Apple pide como client_secret. */
    String clientSecret() throws GeneralSecurityException, JOSEException {
        Instant ahora = Instant.now();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(keyId).build(),
                new JWTClaimsSet.Builder().issuer(teamId).subject(clientId).audience(BASE)
                        .issueTime(Date.from(ahora)).expirationTime(Date.from(ahora.plus(Duration.ofMinutes(5)))).build());
        jwt.sign(new ECDSASigner(llave()));
        return jwt.serialize();
    }

    private ECPrivateKey llave() throws GeneralSecurityException {
        // En variables de entorno, los saltos de linea del .p8 pueden venir como \n.
        String base64 = llavePem.replace("\\n", "\n").replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "").replaceAll("\\s", "");
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
    }

    private static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }
}
