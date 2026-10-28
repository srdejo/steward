package co.com.srdejo.steward.infrastructure.configuration;

import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/** Lee una llave publica RSA en PEM (X.509). Solo la usa el perfil contract para el Google de prueba. */
final class LlavePublicaRsa {

    private LlavePublicaRsa() {
    }

    static RSAPublicKey leer(Resource pem) {
        try {
            String base64 = pem.getContentAsString(StandardCharsets.US_ASCII)
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            return (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer la llave de prueba " + pem, e);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Llave de prueba invalida: " + pem, e);
        }
    }
}
