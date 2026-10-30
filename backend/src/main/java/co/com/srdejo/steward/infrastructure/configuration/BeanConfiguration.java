package co.com.srdejo.steward.infrastructure.configuration;

import co.com.srdejo.steward.domain.api.IAnualServicePort;
import co.com.srdejo.steward.domain.api.IAuthServicePort;
import co.com.srdejo.steward.domain.api.ICierreServicePort;
import co.com.srdejo.steward.domain.api.ICuentasServicePort;
import co.com.srdejo.steward.domain.api.IFinanzasServicePort;
import co.com.srdejo.steward.domain.api.IHogarServicePort;
import co.com.srdejo.steward.domain.api.IInvitacionServicePort;
import co.com.srdejo.steward.domain.api.IPlanServicePort;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICierrePersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IGoogleIdentityPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IInvitacionPersistencePort;
import co.com.srdejo.steward.domain.spi.IMailPort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITokenGeneratorPort;
import co.com.srdejo.steward.domain.spi.ITokenPort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import co.com.srdejo.steward.domain.usecase.AnualUseCase;
import co.com.srdejo.steward.domain.usecase.AuthUseCase;
import co.com.srdejo.steward.domain.usecase.CierreUseCase;
import co.com.srdejo.steward.domain.usecase.CuentasUseCase;
import co.com.srdejo.steward.domain.usecase.FinanzasUseCase;
import co.com.srdejo.steward.domain.usecase.HogarUseCase;
import co.com.srdejo.steward.domain.usecase.InvitacionUseCase;
import co.com.srdejo.steward.domain.usecase.PlanUseCase;
import co.com.srdejo.steward.infrastructure.out.mail.ContactMailAdapter;
import co.com.srdejo.steward.infrastructure.out.mail.LoggingMailAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.AnualR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.CategoriaR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.CierreR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.CreditoR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.CuentaR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.HogarR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.IngresoFijoR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.InvitacionR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.MovimientoR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.PlanR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.ReglaDiezmoR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.TransaccionAdapter;
import co.com.srdejo.steward.infrastructure.out.r2dbc.UsuarioR2dbcAdapter;
import co.com.srdejo.steward.infrastructure.security.GoogleIdentityAdapter;
import co.com.srdejo.steward.infrastructure.security.JwtTokenAdapter;
import co.com.srdejo.steward.infrastructure.security.SecureTokenGenerator;
import co.com.srdejo.steward.infrastructure.security.SecurityContextCurrentUserAdapter;
import co.com.srdejo.steward.infrastructure.security.SystemClockAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.io.ResourceLoader;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Conecta los casos de uso del dominio (sin anotaciones de Spring) con sus adaptadores. Lo comun (seguridad, correo,
 * errores) vive en infrastructure detras de puertos, para cambiarlo por srdejo-platform sin tocar el dominio (D10).
 */
@Configuration
@ImportRuntimeHints(NativeHints.class)
public class BeanConfiguration {

    private static final Logger log = LoggerFactory.getLogger(BeanConfiguration.class);

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
    IReglaDiezmoPersistencePort reglaDiezmoPersistencePort(DatabaseClient db) {
        return new ReglaDiezmoR2dbcAdapter(db);
    }

    @Bean
    IIngresoFijoPersistencePort ingresoFijoPersistencePort(DatabaseClient db) {
        return new IngresoFijoR2dbcAdapter(db);
    }

    @Bean
    ICuentaPersistencePort cuentaPersistencePort(DatabaseClient db) {
        return new CuentaR2dbcAdapter(db);
    }

    @Bean
    ICreditoPersistencePort creditoPersistencePort(DatabaseClient db) {
        return new CreditoR2dbcAdapter(db);
    }

    @Bean
    IAnualPersistencePort anualPersistencePort(DatabaseClient db) {
        return new AnualR2dbcAdapter(db);
    }

    @Bean
    ICierrePersistencePort cierrePersistencePort(DatabaseClient db) {
        return new CierreR2dbcAdapter(db);
    }

    @Bean
    IMovimientoPersistencePort movimientoPersistencePort(DatabaseClient db) {
        return new MovimientoR2dbcAdapter(db);
    }

    @Bean
    ICategoriaPersistencePort categoriaPersistencePort(DatabaseClient db) {
        return new CategoriaR2dbcAdapter(db);
    }

    @Bean
    IPlanPersistencePort planPersistencePort(DatabaseClient db) {
        return new PlanR2dbcAdapter(db);
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
                                       IIngresoFijoPersistencePort ingresos, ICuentaPersistencePort cuentas,
                                       ICategoriaPersistencePort categorias, ICurrentUserPort usuarioActual,
                                       ITransaccionPort transaccion, IClockPort clock) {
        return new HogarUseCase(hogares, invitaciones, ingresos, cuentas, categorias, usuarioActual, transaccion, clock);
    }

    @Bean
    IInvitacionServicePort invitacionServicePort(IHogarPersistencePort hogares, IInvitacionPersistencePort invitaciones,
                                                 IUsuarioPersistencePort usuarios, IReglaDiezmoPersistencePort reglas,
                                                 ITokenGeneratorPort tokens,
                                                 IMailPort correo, ICurrentUserPort usuarioActual,
                                                 ITransaccionPort transaccion, IClockPort clock,
                                                 StewardProperties properties) {
        return new InvitacionUseCase(hogares, invitaciones, usuarios, reglas, tokens, correo, usuarioActual, transaccion, clock,
                properties.publicUrl());
    }

    @Bean
    IFinanzasServicePort finanzasServicePort(IHogarPersistencePort hogares, IReglaDiezmoPersistencePort reglas,
                                             IIngresoFijoPersistencePort ingresos, ICuentaPersistencePort cuentas,
                                             IMovimientoPersistencePort movimientos, ICategoriaPersistencePort categorias,
                                             IPlanPersistencePort planes, ICreditoPersistencePort creditos,
                                             ICierrePersistencePort cierres, IAnualPersistencePort anuales,
                                             IUsuarioPersistencePort usuarios, ICurrentUserPort usuarioActual,
                                             ITransaccionPort transaccion, IClockPort clock) {
        return new FinanzasUseCase(hogares, reglas, ingresos, cuentas, movimientos, categorias, planes, creditos, cierres,
                anuales, usuarios, usuarioActual, transaccion, clock);
    }

    @Bean
    IAnualServicePort anualServicePort(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas, IAnualPersistencePort anuales,
                                       ICategoriaPersistencePort categorias, IPlanPersistencePort planes,
                                       ICierrePersistencePort cierres, IIngresoFijoPersistencePort ingresos,
                                       IReglaDiezmoPersistencePort reglas, IMovimientoPersistencePort movimientos,
                                       ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock) {
        return new AnualUseCase(hogares, cuentas, anuales, categorias, planes, cierres, ingresos, reglas, movimientos,
                usuarioActual, transaccion, clock);
    }

    @Bean
    ICierreServicePort cierreServicePort(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas,
                                         ICierrePersistencePort cierres, IMovimientoPersistencePort movimientos,
                                         ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock) {
        return new CierreUseCase(hogares, cuentas, cierres, movimientos, usuarioActual, transaccion, clock);
    }

    @Bean
    ICuentasServicePort cuentasServicePort(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas,
                                           IMovimientoPersistencePort movimientos, ICreditoPersistencePort creditos,
                                           IPlanPersistencePort planes, ICategoriaPersistencePort categorias,
                                           ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock) {
        return new CuentasUseCase(hogares, cuentas, movimientos, creditos, planes, categorias, usuarioActual, transaccion,
                clock);
    }

    @Bean
    IPlanServicePort planServicePort(IHogarPersistencePort hogares, ICategoriaPersistencePort categorias,
                                     IPlanPersistencePort planes, IMovimientoPersistencePort movimientos,
                                     ICreditoPersistencePort creditos, ICierrePersistencePort cierres,
                                     IIngresoFijoPersistencePort ingresos, IReglaDiezmoPersistencePort reglas,
                                     IAnualPersistencePort anuales,
                                     ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock) {
        return new PlanUseCase(hogares, categorias, planes, movimientos, creditos, cierres, ingresos, reglas, anuales,
                usuarioActual, transaccion,
                clock);
    }

    @Bean
    IAuthServicePort authServicePort(IGoogleIdentityPort google, IUsuarioPersistencePort usuarios,
                                     IHogarPersistencePort hogares, ITokenPort tokens, ICurrentUserPort usuarioActual,
                                     IClockPort clock, StewardProperties properties) {
        boolean devLogin = properties.security().devLogin();
        if (devLogin) {
            log.warn("Acceso de desarrollo ENCENDIDO (steward.security.dev-login): se entra sin Google. Nunca en el VPS.");
        }
        return new AuthUseCase(google, usuarios, hogares, tokens, usuarioActual, clock, devLogin);
    }
}
