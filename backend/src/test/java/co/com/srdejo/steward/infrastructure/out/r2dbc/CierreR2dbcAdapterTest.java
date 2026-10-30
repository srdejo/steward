package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.CierreMes;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort.DelMes;
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
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Integracion de los cierres contra la Postgres local (design D2 y D3 de backend-cierre-mes). */
class CierreR2dbcAdapterTest {

    private static final YearMonth OCT = YearMonth.of(2026, 10);
    private static final LocalDate DIA_31 = LocalDate.of(2026, 10, 31);

    private static DatabaseClient db;

    private CierreR2dbcAdapter cierres;
    private MovimientoR2dbcAdapter movimientos;
    private UUID daniel;
    private UUID hogar;

    @BeforeAll
    static void base() {
        Flyway.configure().dataSource("jdbc:postgresql://localhost:5433/steward_test", "postgres", "postgres").load().migrate();
        ConnectionFactory cf = ConnectionFactories.get("r2dbc:postgresql://postgres:postgres@localhost:5433/steward_test");
        db = DatabaseClient.create(cf);
    }

    @BeforeEach
    void preparar() {
        db.sql("TRUNCATE invitacion, miembro, hogar, usuario CASCADE").then().block();
        cierres = new CierreR2dbcAdapter(db);
        movimientos = new MovimientoR2dbcAdapter(db);
        daniel = new UsuarioR2dbcAdapter(db).crearOObtener(new Usuario(UUID.randomUUID(), "daniel@ejemplo.com", "Daniel",
                Instant.now().truncatedTo(ChronoUnit.MILLIS))).block().id();
        hogar = new HogarR2dbcAdapter(db).crear(new Hogar(UUID.randomUUID(), "Nuestra casa", false), daniel, DIA_31).block().id();
    }

    @Test
    void guardarCierraElPlanYSeLeeConSusFilas() {
        db.sql("INSERT INTO plan_mes (id, hogar_id, ref_anio, ref_mes, estado) VALUES (gen_random_uuid(), :h, 2026, 10, 'ACTIVO')")
                .bind("h", hogar).then().block();
        StepVerifier.create(cierres.estaCerrado(hogar, OCT)).expectNext(false).verifyComplete();

        cierres.guardar(octubre()).block();

        StepVerifier.create(cierres.estaCerrado(hogar, OCT)).expectNext(true).verifyComplete();
        StepVerifier.create(db.sql("SELECT estado FROM plan_mes").map(r -> r.get("estado", String.class)).one())
                .expectNext("CERRADO").verifyComplete();
        CierreMes leido = cierres.desde(hogar, OCT.minusMonths(3)).blockLast();
        assertEquals(octubre().filas(), leido.filas());
        assertEquals(3_166_000, leido.sobrante());
        assertEquals(1_166_000, leido.aSiguiente());
        StepVerifier.create(cierres.desde(hogar, OCT.plusMonths(1))).verifyComplete();
    }

    @Test
    void unMesSinPlanTambienQuedaCerradoYNoSeCierraDosVeces() {
        cierres.guardar(octubre()).block();
        StepVerifier.create(cierres.estaCerrado(hogar, OCT)).expectNext(true).verifyComplete();
        StepVerifier.create(cierres.guardar(octubre()))
                .expectErrorMatches(ex -> ex instanceof DomainException d && d.codigo().equals("MES_CERRADO"))
                .verify();
    }

    @Test
    void ajustesYUltimoRegistroDelMes() {
        StepVerifier.create(movimientos.paraCierre(hogar, OCT)).expectNext(new DelMes(0, 0)).verifyComplete();
        movimientos.registrar(mov(Movimiento.Tipo.AJUSTE_CUADRE, 50_000, OCT)).block();
        movimientos.registrar(mov(Movimiento.Tipo.AJUSTE_CUADRE, -10_000, OCT)).block();
        Movimiento ultimo = movimientos.registrar(mov(Movimiento.Tipo.GASTO, 85_000, OCT)).block();
        movimientos.registrar(mov(Movimiento.Tipo.GASTO, 1, OCT.plusMonths(1))).block();
        StepVerifier.create(movimientos.paraCierre(hogar, OCT)).expectNext(new DelMes(40_000, ultimo.seq())).verifyComplete();
    }

    private CierreMes octubre() {
        return new CierreMes(UUID.randomUUID(), hogar, OCT,
                List.of(new CierreMes.Fila("Ingresos", 9_000_000L, 9_000_000), new CierreMes.Fila("No estaba planeado", null, 85_000)),
                50_000, 3_166_000, 2_000_000, 1_166_000, daniel, DIA_31);
    }

    private Movimiento mov(Movimiento.Tipo tipo, long monto, YearMonth mes) {
        return new Movimiento(UUID.randomUUID(), hogar, tipo, mes, monto, DIA_31, daniel, daniel, null, null, null, false,
                List.of(), null, "", Movimiento.Origen.NINGUNO);
    }
}
