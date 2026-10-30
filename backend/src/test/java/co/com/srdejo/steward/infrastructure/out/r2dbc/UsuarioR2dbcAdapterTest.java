package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Usuario;
import io.r2dbc.spi.ConnectionFactories;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/** Integracion contra la Postgres local (base steward_test), sin H2 (design D8). */
class UsuarioR2dbcAdapterTest {

    private static DatabaseClient db;
    private UsuarioR2dbcAdapter adapter;

    @BeforeAll
    static void base() {
        Flyway.configure().dataSource("jdbc:postgresql://localhost:5433/steward_test", "postgres", "postgres").load().migrate();
        db = DatabaseClient.create(ConnectionFactories.get("r2dbc:postgresql://postgres:postgres@localhost:5433/steward_test"));
    }

    @BeforeEach
    void limpiar() {
        db.sql("TRUNCATE invitacion, miembro, hogar, usuario CASCADE").then().block();
        adapter = new UsuarioR2dbcAdapter(db);
    }

    @Test
    void buscaPorCorreoSinDistinguirMayusculas() {
        adapter.crearOObtener(usuario("daniel@ejemplo.com")).block();
        StepVerifier.create(adapter.porEmail("Daniel@Ejemplo.COM"))
                .expectNextMatches(u -> u.email().equals("daniel@ejemplo.com"))
                .verifyComplete();
    }

    @Test
    void elMismoCorreoNoSeDuplicaAunqueLleguenJuntos() {
        Usuario primero = usuario("esposa@ejemplo.com");
        Usuario segundo = usuario("ESPOSA@ejemplo.com");
        StepVerifier.create(Flux.merge(adapter.crearOObtener(primero), adapter.crearOObtener(segundo)).map(Usuario::id).distinct())
                .expectNextCount(1)
                .verifyComplete();
        StepVerifier.create(db.sql("SELECT count(*) AS n FROM usuario").map(r -> r.get("n", Long.class)).one())
                .expectNext(1L)
                .verifyComplete();
    }

    @Test
    void cambiaElNombreSinTocarElCorreo() {
        Usuario creado = adapter.crearOObtener(usuario("d@ejemplo.com")).block();
        StepVerifier.create(adapter.actualizarNombre(creado.id(), "dani"))
                .expectNextMatches(u -> u.nombre().equals("dani") && u.email().equals("d@ejemplo.com") && u.inicial().equals("D"))
                .verifyComplete();
    }

    private static Usuario usuario(String email) {
        return new Usuario(UUID.randomUUID(), email, "Daniel", Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
}
