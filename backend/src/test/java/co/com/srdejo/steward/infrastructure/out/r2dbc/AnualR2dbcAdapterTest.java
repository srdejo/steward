package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Celda;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import co.com.srdejo.steward.domain.model.PlanAnual.Proyeccion;
import co.com.srdejo.steward.domain.model.Usuario;
import io.r2dbc.spi.ConnectionFactories;
import io.r2dbc.spi.ConnectionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.test.StepVerifier;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Integracion del plan anual contra la Postgres local (design D2 de backend-plan-anual). */
class AnualR2dbcAdapterTest {

    private static DatabaseClient db;

    private AnualR2dbcAdapter anuales;
    private UUID daniel;
    private UUID hogar;
    private UUID fijos;

    @BeforeAll
    static void base() {
        Flyway.configure().dataSource("jdbc:postgresql://localhost:5433/steward_test", "postgres", "postgres").load().migrate();
        ConnectionFactory cf = ConnectionFactories.get("r2dbc:postgresql://postgres:postgres@localhost:5433/steward_test");
        db = DatabaseClient.create(cf);
    }

    @BeforeEach
    void preparar() {
        db.sql("TRUNCATE invitacion, miembro, hogar, usuario CASCADE").then().block();
        anuales = new AnualR2dbcAdapter(db);
        daniel = new UsuarioR2dbcAdapter(db).crearOObtener(new Usuario(UUID.randomUUID(), "daniel@ejemplo.com", "Daniel",
                Instant.now().truncatedTo(ChronoUnit.MILLIS))).block().id();
        hogar = new HogarR2dbcAdapter(db).crear(new Hogar(UUID.randomUUID(), "Nuestra casa", false), daniel,
                LocalDate.of(2026, 10, 29)).block().id();
        CategoriaR2dbcAdapter categorias = new CategoriaR2dbcAdapter(db);
        categorias.crearTodas(Categoria.delSistema(hogar)).block();
        fijos = categorias.delHogar(hogar).blockFirst().id();
    }

    @Test
    void crearLlenarYLeer() {
        PlanAnual a = anuales.crear(new PlanAnual(UUID.randomUUID(), hogar, 2027, PlanAnual.Estado.BORRADOR, List.of(), List.of())).block();
        anuales.ponerCelda(a.id(), fijos, 1, 800_000).block();
        anuales.ponerCelda(a.id(), fijos, 1, 900_000).block();
        anuales.agregarEvento(a.id(), new Evento(UUID.randomUUID(), "SOAT", 3, 1_200_000, Evento.Tipo.GASTO, null)).block();
        anuales.marcarCreado(a.id()).block();

        PlanAnual leido = anuales.deAnio(hogar, 2027).block();
        assertEquals(List.of(new Celda(fijos, 1, 900_000)), leido.celdas());
        assertEquals("SOAT", leido.eventos().getFirst().nombre());
        assertEquals(PlanAnual.Estado.CREADO, leido.estado());
        StepVerifier.create(anuales.desde(hogar, 2028)).verifyComplete();
        StepVerifier.create(anuales.crear(new PlanAnual(UUID.randomUUID(), hogar, 2027, PlanAnual.Estado.BORRADOR, List.of(), List.of())))
                .expectErrorMatches(ex -> ex instanceof DomainException d && d.codigo().equals("YA_EXISTE"))
                .verify();
    }

    @Test
    void proyeccionesQueSeReemplazanYSeQuitan() {
        anuales.ponerProyeccion(hogar, new Proyeccion(daniel, 2027, 1, 1_000_000)).block();
        anuales.ponerProyeccion(hogar, new Proyeccion(daniel, 2027, 1, 2_000_000)).block();
        anuales.ponerProyeccion(hogar, new Proyeccion(daniel, 2027, 2, 500_000)).block();
        StepVerifier.create(anuales.proyeccionesDesde(hogar, 2027).map(Proyeccion::monto)).expectNext(2_000_000L, 500_000L).verifyComplete();
        anuales.ponerProyeccion(hogar, new Proyeccion(daniel, 2027, 1, 0)).block();
        StepVerifier.create(anuales.proyeccionesDesde(hogar, 2027).map(Proyeccion::mes)).expectNext(2).verifyComplete();
    }
}
