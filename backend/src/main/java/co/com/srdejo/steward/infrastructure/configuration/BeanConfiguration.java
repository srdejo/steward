package co.com.srdejo.steward.infrastructure.configuration;

import co.com.srdejo.steward.domain.api.IAuthServicePort;
import co.com.srdejo.steward.domain.api.IHogarServicePort;
import co.com.srdejo.steward.domain.api.IInvitacionServicePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IGoogleIdentityPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IInvitacionPersistencePort;
import co.com.srdejo.steward.domain.spi.IMailPort;
import co.com.srdejo.steward.domain.spi.ITokenGeneratorPort;
import co.com.srdejo.steward.domain.spi.ITokenPort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import co.com.srdejo.steward.domain.usecase.AuthUseCase;
import co.com.srdejo.steward.domain.usecase.HogarUseCase;
import co.com.srdejo.steward.domain.usecase.InvitacionUseCase;
import co.com.srdejo.steward.infrastructure.out.mail.ContactMailAdapter;
import co.com.srdejo.steward.infrastructure.out.mail.LoggingMailAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.HogarR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.InvitacionR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.TransaccionAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.UsuarioR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.security.GoogleIdentityAdapter;
import co.com.srdejo.steward.infrastructure.security.JwtTokenAdapter;
import co.com.srdejo.steward.infrastructure.security.SecureTokenGenerator;
import co.com.srdejo.steward.infrastructure.security.SecurityContextCurrentUserAdapter;
import co.com.srdejo.steward.infrastructure.security.SystemClockAdapter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ResourceLoader;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Conecta los casos de uso del dominio (sin anotaciones de Spring) con sus adaptadores. Lo comun (seguridad, correo,
 * errores) vive en infrastructure detras de puertos, para cambiarlo por srdejo-platform sin tocar el dominio (D10).
 */
@Configuration
public class BeanConfiguration {

    @Bean
    IClockPort clockPort(StewardProperties properties) {
        return SystemClockAdapter.enZona(properties.zone());
    }

    @Bean
    ITokenPort tokenPort(StewardProperties properties, IClockPort clock) {
        return new JwtTokenAdapter(properties.security().jwtSecret(), properties.security().jwtTtl(), clock);
    }

    @Bean
    ICurrentUserPort currentUserPort() {
        return new SecurityContextCurrentUserAdapter();
    }

    /** Google real por JWKS; con {@code google-test-public-key} (solo perfil contract), una llave RSA de prueba. */
    @Bean
    IGoogleIdentityPort googleIdentityPort(StewardProperties properties, ResourceLoader recursos) {
        StewardProperties.Security security = properties.security();
        String llaveDePrueba = security.googleTestPublicKey();
        if (llaveDePrueba == null || llaveDePrueba.isBlank()) {
            return GoogleIdentityAdapter.conJwksDeGoogle(security.googleClientId());
        }
        return GoogleIdentityAdapter.conLlaveDePrueba(security.googleClientId(),
                LlavePublicaRsa.leer(recursos.getResource(llaveDePrueba)));
    }

    @Bean
    IUsuarioPersistencePort usuarioPersistencePort(DatabaseClient db) {
        return new UsuarioR2dbcAdapter(db);
    }

    @Bean
    IHogarPersistencePort hogarPersistencePort(DatabaseClient db) {
        return new HogarR2dbcAdapter(db);
    }

    @Bean
    IInvitacionPersistencePort invitacionPersistencePort(DatabaseClient db) {
        return new InvitacionR2dbcAdapter(db);
    }

    @Bean
    ITransaccionPort transaccionPort(TransactionalOperator operator) {
        return new TransaccionAdapter(operator);
    }

    @Bean
    ITokenGeneratorPort tokenGeneratorPort() {
        return new SecureTokenGenerator();
    }

    /** Todos los correos salen por la API contact (design D7); en dev y en los tests, el enlace va al log. */
    @Bean
    IMailPort mailPort(WebClient.Builder builder, StewardProperties properties) {
        return properties.mail().porContact()
                ? new ContactMailAdapter(builder, properties.contactApiUrl())
                : new LoggingMailAdapter();
    }

    @Bean
    IHogarServicePort hogarServicePort(IHogarPersistencePort hogares, IInvitacionPersistencePort invitaciones,
                                       ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock) {
        return new HogarUseCase(hogares, invitaciones, usuarioActual, transaccion, clock);
    }

    @Bean
    IInvitacionServicePort invitacionServicePort(IHogarPersistencePort hogares, IInvitacionPersistencePort invitaciones,
                                                 IUsuarioPersistencePort usuarios, ITokenGeneratorPort tokens,
                                                 IMailPort correo, ICurrentUserPort usuarioActual,
                                                 ITransaccionPort transaccion, IClockPort clock,
                                                 StewardProperties properties) {
        return new InvitacionUseCase(hogares, invitaciones, usuarios, tokens, correo, usuarioActual, transaccion, clock,
                properties.publicUrl());
    }

    @Bean
    IAuthServicePort authServicePort(IGoogleIdentityPort google, IUsuarioPersistencePort usuarios,
                                     IHogarPersistencePort hogares, ITokenPort tokens, ICurrentUserPort usuarioActual,
                                     IClockPort clock) {
        return new AuthUseCase(google, usuarios, hogares, tokens, usuarioActual, clock);
    }
}
