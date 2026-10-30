package co.com.srdejo.steward.infrastructure.security;

import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.test.StepVerifier;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Design D5 de app-movil-conectada: cambia el code por un token y lo revoca; un fallo de Apple no se propaga. */
class AppleRevocacionTest {

    private HttpServer servidor;
    private final List<String> recibidos = Collections.synchronizedList(new ArrayList<>());
    private volatile int estadoToken = 200;

    @BeforeEach
    void levantar() throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/auth/token", ex -> {
            recibidos.add("token " + new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] r = "{\"refresh_token\":\"r-1\",\"access_token\":\"a-1\"}".getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(estadoToken, r.length);
            ex.getResponseBody().write(r);
            ex.close();
        });
        servidor.createContext("/auth/revoke", ex -> {
            recibidos.add("revoke " + new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            ex.sendResponseHeaders(200, -1);
            ex.close();
        });
        servidor.start();
    }

    @AfterEach
    void bajar() {
        servidor.stop(0);
    }

    private AppleRevocacion revocacion(String llave) {
        return new AppleRevocacion(WebClient.builder(), "http://127.0.0.1:" + servidor.getAddress().getPort(),
                "com.ejemplo.app", "EQUIPO", "LLAVE", llave);
    }

    private static String llavePem() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        return "-----BEGIN PRIVATE KEY-----\\n" + Base64.getEncoder().encodeToString(g.generateKeyPair().getPrivate().getEncoded())
                + "\\n-----END PRIVATE KEY-----";
    }

    @Test
    void cambiaElCodeYRevocaElToken() throws Exception {
        StepVerifier.create(revocacion(llavePem()).revocar("code-1")).verifyComplete();
        assertEquals(2, recibidos.size());
        assertTrue(recibidos.get(0).contains("code=code-1") && recibidos.get(0).contains("grant_type=authorization_code"));
        assertTrue(recibidos.get(1).contains("token=r-1") && recibidos.get(1).contains("token_type_hint=refresh_token"));
    }

    @Test
    void elClientSecretEsUnJwtDeApple() throws Exception {
        SignedJWT jwt = SignedJWT.parse(revocacion(llavePem()).clientSecret());
        assertEquals("LLAVE", jwt.getHeader().getKeyID());
        assertEquals("EQUIPO", jwt.getJWTClaimsSet().getIssuer());
        assertEquals("com.ejemplo.app", jwt.getJWTClaimsSet().getSubject());
    }

    @Test
    void unFalloDeAppleNoSePropaga() throws Exception {
        estadoToken = 400;
        StepVerifier.create(revocacion(llavePem()).revocar("code-1")).verifyComplete();
        assertEquals(1, recibidos.size());
    }

    @Test
    void sinLlaveNoLlamaAApple() {
        StepVerifier.create(revocacion("").revocar("code-1")).verifyComplete();
        assertTrue(recibidos.isEmpty());
    }
}
