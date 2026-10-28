package co.com.srdejo.steward.infrastructure.configuration;

import co.com.srdejo.steward.domain.spi.IGoogleIdentityPort;
import co.com.srdejo.steward.infrastructure.security.GoogleIdentityAdapter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Solo para los tests de contrato (design D8), en JVM y contra el binario: Google se reemplaza por una llave RSA de
 * prueba, con las mismas validaciones de emisor, audiencia, vigencia y correo verificado. Nunca se activa en el VPS.
 */
@Configuration
@Profile("contract")
public class ContractConfiguration {

    @Bean
    IGoogleIdentityPort googleIdentityPort(StewardProperties properties,
                                           @Value("${contract.google-public-key}") Resource llave)
            throws IOException, GeneralSecurityException {
        String pem = llave.getContentAsString(StandardCharsets.US_ASCII)
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        RSAPublicKey publica = (RSAPublicKey) KeyFactory.getInstance("RSA")
                .generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(pem)));
        return GoogleIdentityAdapter.conLlaveDePrueba(properties.security().googleClientId(), publica);
    }
}
