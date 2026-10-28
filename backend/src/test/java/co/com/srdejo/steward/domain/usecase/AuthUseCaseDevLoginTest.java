package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.EstadoHogar;
import co.com.srdejo.steward.domain.model.IdentidadGoogle;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.IGoogleIdentityPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.lang.reflect.Proxy;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/** Spec steward-auth, "Acceso de desarrollo": apagado (lo normal fuera de local) responde 404 y no crea nada. */
class AuthUseCaseDevLoginTest {

    private final AtomicInteger creados = new AtomicInteger();

    private final IUsuarioPersistencePort usuarios = new IUsuarioPersistencePort() {
        @Override
        public Mono<Usuario> porId(java.util.UUID id) {
            return Mono.empty();
        }

        @Override
        public Mono<Usuario> porEmail(String email) {
            return Mono.empty();
        }

        @Override
        public Mono<Usuario> crearOObtener(Usuario usuario) {
            creados.incrementAndGet();
            return Mono.just(usuario);
        }

        @Override
        public Mono<Usuario> actualizarNombre(java.util.UUID id, String nombre) {
            return Mono.empty();
        }
    };

    private final IGoogleIdentityPort google = new IGoogleIdentityPort() {
        @Override
        public Optional<String> clientId() {
            return Optional.empty();
        }

        @Override
        public Mono<IdentidadGoogle> verificar(String idToken) {
            return Mono.empty();
        }
    };

    private final IClockPort reloj = new IClockPort() {
        @Override
        public Instant ahora() {
            return Instant.parse("2026-10-28T15:00:00Z");
        }

        @Override
        public LocalDate hoy() {
            return LocalDate.of(2026, 10, 28);
        }
    };

    /** Solo se usa estadoDe en este flujo. */
    private final IHogarPersistencePort hogares = (IHogarPersistencePort) Proxy.newProxyInstance(
            getClass().getClassLoader(), new Class<?>[]{IHogarPersistencePort.class},
            (p, m, a) -> m.getName().equals("estadoDe") ? Mono.just(EstadoHogar.SIN_HOGAR) : Flux.empty());

    private AuthUseCase conDevLogin(boolean encendido) {
        return new AuthUseCase(google, usuarios, hogares, id -> "token-" + id, () -> Mono.empty(), reloj, encendido);
    }

    @Test
    void apagadoResponde404YNoCreaNada() {
        AuthUseCase auth = conDevLogin(false);
        assert !auth.devLogin();
        StepVerifier.create(auth.loginDesarrollo("daniel@ejemplo.com", "Daniel"))
                .expectErrorMatches(e -> e instanceof DomainException d && d.tipo() == DomainException.Tipo.NO_ENCONTRADO)
                .verify();
        if (creados.get() != 0) {
            throw new AssertionError("Apagado no debe crear usuarios");
        }
    }

    @Test
    void encendidoCreaElUsuarioYDaSesion() {
        StepVerifier.create(conDevLogin(true).loginDesarrollo("daniel@ejemplo.com", "Daniel"))
                .expectNextMatches(s -> s.token().startsWith("token-") && s.usuario().nombre().equals("Daniel") && !s.tieneHogar())
                .verifyComplete();
        if (creados.get() != 1) {
            throw new AssertionError("Debia crear un usuario");
        }
    }
}
