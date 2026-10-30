package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import co.com.srdejo.steward.domain.model.Usuario;
import io.r2dbc.spi.ConnectionFactories;
import io.r2dbc.spi.ConnectionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.connection.R2dbcTransactionManager;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.transaction.reactive.TransactionalOperator;
import reactor.test.StepVerifier;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/** Integracion de los adaptadores de finanzas contra la Postgres local (base steward_test), sin H2. */
class FinanzasR2dbcAdapterTest {

    private static final YearMonth OCT = YearMonth.of(2026, 10);
    private static final LocalDate DIA_25 = LocalDate.of(2026, 10, 25);

    private static DatabaseClient db;
    private static TransactionalOperator tx;

    private ReglaDiezmoR2dbcAdapter reglas;
    private IngresoFijoR2dbcAdapter ingresos;
    private CuentaR2dbcAdapter cuentas;
    private MovimientoR2dbcAdapter movimientos;
    private HogarR2dbcAdapter hogares;
    private UUID daniel;
    private UUID esposa;
    private UUID hogar;

    @BeforeAll
    static void base() {
        Flyway.configure().dataSource("jdbc:postgresql://localhost:5433/steward_test", "postgres", "postgres").load().migrate();
        ConnectionFactory cf = ConnectionFactories.get("r2dbc:postgresql://postgres:postgres@localhost:5433/steward_test");
        db = DatabaseClient.create(cf);
        tx = TransactionalOperator.create(new R2dbcTransactionManager(cf));
    }

    @BeforeEach
    void preparar() {
        db.sql("TRUNCATE invitacion, miembro, hogar, usuario CASCADE").then().block();
        reglas = new ReglaDiezmoR2dbcAdapter(db);
        ingresos = new IngresoFijoR2dbcAdapter(db);
        cuentas = new CuentaR2dbcAdapter(db);
        movimientos = new MovimientoR2dbcAdapter(db);
        hogares = new HogarR2dbcAdapter(db);
        UsuarioR2dbcAdapter usuarios = new UsuarioR2dbcAdapter(db);
        daniel = usuarios.crearOObtener(usuario("daniel@ejemplo.com", "Daniel")).block().id();
        esposa = usuarios.crearOObtener(usuario("esposa@ejemplo.com", "Esposa")).block().id();
        hogar = hogares.crear(new Hogar(UUID.randomUUID(), "Nuestra casa", false), daniel, DIA_25).block().id();
        hogares.unir(hogar, esposa, DIA_25).block();
    }

    @Test
    void guardarLaReglaLaReemplaza() {
        reglas.guardar(new ReglaDiezmo(daniel, true, BigDecimal.TEN, ReglaDiezmo.Base.BRUTO, false)).block();
        reglas.guardar(new ReglaDiezmo(daniel, true, new BigDecimal("12.5"), ReglaDiezmo.Base.NETO, true)).block();
        StepVerifier.create(reglas.dePersona(daniel))
                .expectNextMatches(r -> r.porcentaje().compareTo(new BigDecimal("12.5")) == 0
                        && r.base() == ReglaDiezmo.Base.NETO && r.aplicaAportes())
                .verifyComplete();
        StepVerifier.create(reglas.dePersonas(List.of(daniel, esposa))).expectNextCount(1).verifyComplete();
    }

    @Test
    void alUnirseCreaOSoloCambiaLosAportes() {
        reglas.alUnirse(esposa, false).block();
        StepVerifier.create(reglas.dePersona(esposa)).verifyComplete();

        reglas.alUnirse(esposa, true).block();
        StepVerifier.create(reglas.dePersona(esposa))
                .expectNext(new ReglaDiezmo(esposa, true, new BigDecimal("10.00"), ReglaDiezmo.Base.BRUTO, true))
                .verifyComplete();

        reglas.guardar(new ReglaDiezmo(daniel, false, new BigDecimal("5.00"), ReglaDiezmo.Base.NETO, true)).block();
        reglas.alUnirse(daniel, false).block();
        StepVerifier.create(reglas.dePersona(daniel))
                .expectNext(new ReglaDiezmo(daniel, false, new BigDecimal("5.00"), ReglaDiezmo.Base.NETO, false))
                .verifyComplete();
    }

    @Test
    void ingresosYCuentasDelHogar() {
        Cuenta davivienda = cuentas.crear(new Cuenta(UUID.randomUUID(), hogar, "Davivienda", daniel, 4_000_000, DIA_25, false)).block();
        cuentas.crear(new Cuenta(UUID.randomUUID(), hogar, "Efectivo", null, 200_000, DIA_25, false)).block();
        cuentas.crear(new Cuenta(UUID.randomUUID(), hogar, "Ahorros Esposa", esposa, 1_000_000, DIA_25, false)).block();
        IngresoFijo salario = ingresos.crear(salario(davivienda.id())).block();
        ingresos.crear(new IngresoFijo(UUID.randomUUID(), hogar, esposa, "Salario Esposa", 3_000_000, 3_000_000, 30, null, true)).block();

        ingresos.actualizar(new IngresoFijo(salario.id(), hogar, daniel, "Salario Daniel", 7_000_000, 6_500_000, 25,
                davivienda.id(), true)).block();
        StepVerifier.create(ingresos.porIdEnHogar(salario.id(), hogar))
                .expectNextMatches(i -> i.neto() == 6_500_000 && i.cuentaId().equals(davivienda.id()))
                .verifyComplete();
        StepVerifier.create(ingresos.porIdEnHogar(salario.id(), UUID.randomUUID())).verifyComplete();

        ingresos.desactivarDe(hogar, esposa).block();
        cuentas.quitarPropias(hogar, esposa).block();
        StepVerifier.create(ingresos.delHogar(hogar).filter(IngresoFijo::activo).map(IngresoFijo::nombre))
                .expectNext("Salario Daniel")
                .verifyComplete();
        StepVerifier.create(cuentas.delHogar(hogar).map(Cuenta::nombre))
                .expectNext("Davivienda", "Efectivo")
                .verifyComplete();
    }

    @Test
    void recibidoDosVecesEnElMesEsYaRecibido() {
        IngresoFijo salario = ingresos.crear(salario(null)).block();
        movimientos.registrarRecibido(recibido(salario)).block();
        StepVerifier.create(movimientos.registrarRecibido(recibido(salario)))
                .expectErrorMatches(ex -> ex instanceof DomainException d && d.codigo().equals("YA_RECIBIDO"))
                .verify();
        // Otro mes si se puede.
        Movimiento noviembre = new Movimiento(UUID.randomUUID(), hogar, Movimiento.Tipo.INGRESO_FIJO, OCT.plusMonths(1),
                6_288_000, DIA_25.plusMonths(1), daniel, daniel, null, salario.id(), 7_000_000L, true, null);
        movimientos.registrarRecibido(noviembre).block();
        StepVerifier.create(movimientos.delMes(hogar, OCT)).expectNextCount(1).verifyComplete();
    }

    private IngresoFijo salario(UUID cuenta) {
        return new IngresoFijo(UUID.randomUUID(), hogar, daniel, "Salario Daniel", 7_000_000, 6_288_000, 25, cuenta, true);
    }

    private Movimiento recibido(IngresoFijo ingreso) {
        return new Movimiento(UUID.randomUUID(), hogar, Movimiento.Tipo.INGRESO_FIJO, OCT, ingreso.neto(), DIA_25,
                ingreso.usuarioId(), daniel, ingreso.cuentaId(), ingreso.id(), ingreso.bruto(), true, null);
    }

    private static Usuario usuario(String email, String nombre) {
        return new Usuario(UUID.randomUUID(), email, nombre, Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
}
