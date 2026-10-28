package co.com.srdejo.steward.infrastructure.configuration;

import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.ITokenPort;
import co.com.srdejo.steward.infrastructure.security.JwtTokenAdapter;
import co.com.srdejo.steward.infrastructure.security.SecurityContextCurrentUserAdapter;
import co.com.srdejo.steward.infrastructure.security.SystemClockAdapter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Conecta los casos de uso del dominio (sin anotaciones de Spring) con sus adaptadores. Lo comun (seguridad, correo,
 * errores) vive en infrastructure detras de puertos, para cambiarlo por srdejo-platform sin tocar el dominio (D10).
 */
@Configuration
public class BeanConfiguration {

    @Bean
    @ConditionalOnMissingBean
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
}
