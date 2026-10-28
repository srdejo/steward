package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.infrastructure.configuration.StewardProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * Seguridad de la API. Superficie publica minima (spec steward-backend-plataforma): salud, login con Google y su
 * configuracion, y la consulta de una invitacion por token. Todo lo demas exige una sesion valida (design D4); sin ella
 * responde 401 con el mismo cuerpo que el {@code ControllerAdvisor}.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    ReactiveJwtDecoder sessionJwtDecoder(StewardProperties properties) {
        return JwtTokenAdapter.decoder(properties.security().jwtSecret());
    }

    @Bean
    SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http, ReactiveJwtDecoder sessionJwtDecoder) {
        ServerAuthenticationEntryPoint noAutenticado = noAutenticado();
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .logout(ServerHttpSecurity.LogoutSpec::disable)
                .requestCache(ServerHttpSecurity.RequestCacheSpec::disable)
                .authorizeExchange(exchange -> exchange
                        .pathMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        .pathMatchers(HttpMethod.GET, "/api/auth/config").permitAll()
                        .pathMatchers(HttpMethod.POST, "/api/auth/google").permitAll()
                        // Acceso de desarrollo: si esta apagado, el endpoint responde 404 (design D5).
                        .pathMatchers(HttpMethod.POST, "/api/auth/dev").permitAll()
                        .pathMatchers(HttpMethod.GET, "/api/invitaciones/*").permitAll()
                        .anyExchange().authenticated())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.jwtDecoder(sessionJwtDecoder))
                        .authenticationEntryPoint(noAutenticado))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(noAutenticado))
                .build();
    }

    private static ServerAuthenticationEntryPoint noAutenticado() {
        byte[] body = ("{\"codigo\":\"NO_AUTENTICADO\",\"mensaje\":\"Inicia sesión para continuar\"}")
                .getBytes(StandardCharsets.UTF_8);
        return (exchange, ex) -> {
            var response = exchange.getResponse();
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
            DataBuffer buffer = response.bufferFactory().wrap(body);
            return response.writeWith(Mono.just(buffer));
        };
    }
}
