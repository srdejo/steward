package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.Movimiento.Origen;
import co.com.srdejo.steward.domain.model.Movimiento.Tipo;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort.Saldo;
import io.r2dbc.spi.ConnectionFactories;
import io.r2dbc.spi.ConnectionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.test.StepVerifier;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integracion de cuentas, saldo estimado y creditos contra la Postgres local (design D1 a D4 de backend-cuentas-creditos).
 * Las cifras del saldo estimado siguen {@code efecto()} de {@code packages/domain/src/rules/cuentas.ts}.
 */
class CuentasCreditosR2dbcAdapterTest {

    private static final YearMonth OCT = YearMonth.of(2026, 10);
    private static final LocalDate DIA_25 = LocalDate.of(2026, 10, 25);

    private static DatabaseClient db;

    private CuentaR2dbcAdapter cuentas;
    private MovimientoR2dbcAdapter movimientos;
    private CreditoR2dbcAdapter creditos;
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
        cuentas = new CuentaR2dbcAdapter(db);
        movimientos = new MovimientoR2dbcAdapter(db);
        creditos = new CreditoR2dbcAdapter(db);
        HogarR2dbcAdapter hogares = new HogarR2dbcAdapter(db);
        daniel = new UsuarioR2dbcAdapter(db).crearOObtener(new Usuario(UUID.randomUUID(), "daniel@ejemplo.com", "Daniel",
                Instant.now().truncatedTo(ChronoUnit.MILLIS))).block().id();
        hogar = hogares.crear(new Hogar(UUID.randomUUID(), "Nuestra casa", false), daniel, DIA_25).block().id();
    }

    @Test
    void elSaldoEstimadoSigueCadaTipoYOrigen() {
        Cuenta a = cuenta("Davivienda", 1_000_000);
        Cuenta b = cuenta("Efectivo", 0);
        registrar(Tipo.INGRESO_FIJO, 100, a, null);
        registrar(Tipo.APORTE, 50, a, null);
        registrar(Tipo.APORTE, 999, null, null);
        registrar(Tipo.PAGO, 10, a, null);
        registrar(Tipo.GASTO, 20, a, null);
        registrar(Tipo.DIEZMO_ENTREGADO, 30, a, null);
        registrar(Tipo.ABONO_CREDITO, 40, a, null);
        registrar(Tipo.TRANSFERENCIA, 200, a, b);
        registrar(Tipo.TRANSFERENCIA, 70, b, a);
        registrar(Tipo.AJUSTE_CUADRE, 500, a, null);
        Movimiento ultimo = registrar(Tipo.GASTO, 5, b, null);

        StepVerifier.create(movimientos.saldoEstimado(a))
                .expectNext(new Saldo(999_920, ultimo.seq()))
                .verifyComplete();
        StepVerifier.create(movimientos.saldoEstimado(b).map(Saldo::saldo)).expectNext(125L).verifyComplete();
    }

    @Test
    void cuadrarDejaFueraLoDeAntes() {
        Cuenta a = cuenta("Davivienda", 1_000_000);
        registrar(Tipo.GASTO, 50_000, a, null);
        Saldo antes = movimientos.saldoEstimado(a).block();
        Cuenta cuadrada = cuentas.cuadrar(cuentas.paraCuadrar(a.id(), hogar).block(), 900_000, DIA_25, antes.ultimoSeq()).block();
        assertTrue(cuadrada.cuadrada());
        registrar(Tipo.GASTO, 120_000, a, null);
        StepVerifier.create(movimientos.saldoEstimado(cuadrada).map(Saldo::saldo)).expectNext(780_000L).verifyComplete();
        StepVerifier.create(cuentas.paraCuadrar(a.id(), UUID.randomUUID())).verifyComplete();
    }

    @Test
    void laLecturaTraeLoViejoQueSigueContando() {
        Cuenta a = cuenta("Davivienda", 1_000_000);
        Movimiento junio = movimientos.registrar(movimiento(Tipo.GASTO, 50_000, a, null, YearMonth.of(2026, 6))).block();
        StepVerifier.create(movimientos.desde(hogar, OCT.minusMonths(2)).map(Movimiento::id)).expectNext(junio.id()).verifyComplete();

        Saldo saldo = movimientos.saldoEstimado(a).block();
        cuentas.cuadrar(a, 950_000, DIA_25, saldo.ultimoSeq()).block();
        StepVerifier.create(movimientos.desde(hogar, OCT.minusMonths(2))).verifyComplete();
    }

    @Test
    void unaCuentaNuevaEmpiezaDespuesDeLoRegistrado() {
        Cuenta a = cuenta("Davivienda", 1_000_000);
        Movimiento gasto = registrar(Tipo.GASTO, 50_000, a, null);
        Cuenta nueva = cuenta("Nu", 300_000);
        assertEquals(gasto.seq(), nueva.seqCuadre());
    }

    @Test
    void cuotaYAbonosBajanElSaldo() {
        Credito c = creditos.crear(new Credito(UUID.randomUUID(), hogar, "Libre inversión", "Bancolombia", 14_250_000, DIA_25,
                500_000, new BigDecimal("1.6"), 15, 20_000_000, List.of())).block();

        creditos.pagarCuota(c.id(), 500_000).block();
        StepVerifier.create(creditos.porIdEnHogar(c.id(), hogar).map(Credito::saldo)).expectNext(13_978_000L).verifyComplete();

        StepVerifier.create(creditos.abonar(c.id(), 14_000_000, DIA_25)).verifyComplete();
        StepVerifier.create(creditos.abonar(c.id(), 978_000, DIA_25).map(Credito::saldo)).expectNext(13_000_000L).verifyComplete();
        StepVerifier.create(creditos.porIdEnHogar(c.id(), UUID.randomUUID())).verifyComplete();
    }

    @Test
    void ultimosPagosPorCredito() {
        Credito c = creditos.crear(new Credito(UUID.randomUUID(), hogar, "Moto", "", 1_000_000, DIA_25, 100_000,
                BigDecimal.ZERO, 5, 1_000_000, List.of())).block();
        for (int i = 1; i <= 8; i++) {
            movimientos.registrar(movimiento(Tipo.ABONO_CREDITO, i, null, null, OCT).conCredito(c.id())).block();
        }
        StepVerifier.create(movimientos.ultimosDeCreditos(hogar, 6).map(Movimiento::monto).collectList())
                .expectNext(List.of(8L, 7L, 6L, 5L, 4L, 3L))
                .verifyComplete();
    }

    private Cuenta cuenta(String nombre, long saldo) {
        return cuentas.crear(new Cuenta(UUID.randomUUID(), hogar, nombre, null, saldo, DIA_25, false)).block();
    }

    private Movimiento registrar(Tipo tipo, long monto, Cuenta desde, Cuenta hacia) {
        Movimiento m = movimientos.registrar(movimiento(tipo, monto, desde, hacia, OCT)).block();
        assertTrue(m.seq() > 0);
        return m;
    }

    private Movimiento movimiento(Tipo tipo, long monto, Cuenta desde, Cuenta hacia, YearMonth mes) {
        return new Movimiento(UUID.randomUUID(), hogar, tipo, mes, monto, DIA_25, daniel, daniel,
                desde == null ? null : desde.id(), null, null, false, List.of(), null, "",
                desde == null ? Origen.EXTERNA : Origen.CUENTA, hacia == null ? null : hacia.id(), null, null, null, 0);
    }
}
