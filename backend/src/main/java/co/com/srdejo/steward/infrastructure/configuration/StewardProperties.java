package co.com.srdejo.steward.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/** Configuracion propia de steward ({@code steward.*} en application.yml). */
@ConfigurationProperties("steward")
public record StewardProperties(String zone, String publicUrl, String contactApiUrl, Security security) {

    public record Security(String jwtSecret, Duration jwtTtl, String googleClientId) {
    }
}
