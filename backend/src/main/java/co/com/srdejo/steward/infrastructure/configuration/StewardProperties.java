package co.com.srdejo.steward.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Configuracion propia de steward ({@code steward.*} en application.yml). Lo que cambia entre entornos (correo, Google
 * de prueba) se decide con estas propiedades en tiempo de ejecucion y no con {@code @Profile}: la preparacion AOT de la
 * imagen nativa congela las condiciones de los beans al compilar (design D2).
 */
@ConfigurationProperties("steward")
public record StewardProperties(String zone, String publicUrl, String contactApiUrl, Mail mail, Security security) {

    /** {@code contact}: los correos salen por la API contact. {@code log}: el enlace queda en el log (dev y tests). */
    public record Mail(String modo) {

        public boolean porContact() {
            return !"log".equalsIgnoreCase(modo);
        }
    }

    /**
     * {@code googleTestPublicKey}: solo el perfil contract. Si tiene valor, Google se valida con esa llave RSA local en
     * lugar del JWKS real. {@code devLogin}: acceso de desarrollo sin Google, solo local (apagado por defecto).
     * {@code googleIosClientId}: el client de la app. {@code appleClientId}: su bundle id; el equipo, la llave y su .p8 solo
     * hacen falta para revocar (design D3 a D5 de app-movil-conectada). {@code appleTestPublicKey}: solo el perfil contract.
     */
    public record Security(String jwtSecret, Duration jwtTtl, String googleClientId, String googleIosClientId, String googleTestPublicKey,
                           String appleClientId, String appleTeamId, String appleKeyId, String applePrivateKey, String appleTestPublicKey,
                           boolean devLogin) {
    }
}
