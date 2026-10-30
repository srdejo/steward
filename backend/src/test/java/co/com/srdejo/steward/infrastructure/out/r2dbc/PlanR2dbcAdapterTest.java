package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.Usuario;
import io.r2dbc.spi.ConnectionFactories;
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

/** Integracion de categorias, planes y pagos contra la Postgres local (base steward_test). */
class PlanR2dbcAdapterTest {

    private static final YearMonth OCT = YearMonth.of(2026, 10);

    private static DatabaseClient db;
    private CategoriaR2dbcAdapter categorias;
    private PlanR2dbcAdapter planes;
    private MovimientoR2dbcAdapter movimientos;
    private UUID daniel;
    private UUID hogar;
    private Categoria fijos;

    @BeforeAll
    static void base() {
        Flyway.configure().dataSource("jdbc:postgresql://localhost:5433/steward_test", "postgres", "postgres").load().migrate();
        db = DatabaseClient.create(ConnectionFactories.get("r2dbc:postgresql://postgres:postgres@localhost:5433/steward_test"));
    }

    @BeforeEach
    void preparar() {
        db.sql("TRUNCATE invitacion, miembro, hogar, usuario CASCADE").then().block();
        categorias = new CategoriaR2dbcAdapter(db);
        planes = new PlanR2dbcAdapter(db);
        movimientos = new MovimientoR2dbcAdapter(db);
        daniel = new UsuarioR2dbcAdapter(db).crearOObtener(new Usuario(UUID.randomUUID(), "daniel@ejemplo.com", "Daniel",
                Instant.now().truncatedTo(ChronoUnit.MICROS))).block().id();
        hogar = new HogarR2dbcAdapter(db).crear(new Hogar(UUID.randomUUID(), "Nuestra casa", false), daniel, LocalDate.of(2026, 10, 1))
                .block().id();
        categorias.crearTodas(Categoria.delSistema(hogar)).block();
        fijos = categorias.delHogar(hogar).filter(c -> c.tipo() == Categoria.Tipo.FIJO).blockFirst();
    }

    @Test
    void categoriasEnOrdenYSinRepetir() {
        StepVerifier.create(categorias.delHogar(hogar).map(Categoria::nombre))
                .expectNext("Diezmo", "Gastos fijos", "Tarjetas y cuotas", "Variables", "Créditos")
                .verifyComplete();
        Categoria repetida = new Categoria(UUID.randomUUID(), hogar, "variables", "#000", 5, Categoria.Tipo.OTRO, false);
        StepVerifier.create(categorias.crear(repetida))
                .expectErrorMatches(ex -> ex instanceof DomainException d && d.codigo().equals("DUPLICADA"))
                .verify();
    }

    @Test
    void elPlanSeArmaConSuOpcionEItemsYNoSeRepiteElMes() {
        PlanMes plan = planDeOctubre();
        planes.crear(plan).block();
        StepVerifier.create(planes.deMes(hogar, OCT))
                .expectNextMatches(p -> p.escenarios().size() == 1 && p.principal().letra().equals("A")
                        && p.principal().items().stream().map(ItemPlan::nombre).toList().equals(List.of("Internet", "Compra a cuotas"))
                        && p.principal().items().get(1).cuotaActual() == 4)
                .verifyComplete();
        StepVerifier.create(planes.crear(planDeOctubre()))
                .expectErrorMatches(ex -> ex instanceof DomainException d && d.codigo().equals("YA_EXISTE"))
                .verify();

        planes.usar(plan.id(), plan.escenarios().getFirst().id()).block();
        StepVerifier.create(planes.desde(hogar, OCT.minusMonths(2)))
                .expectNextMatches(p -> plan.escenarios().getFirst().id().equals(p.escenarioActivoId()))
                .verifyComplete();
        StepVerifier.create(planes.porIdEnHogar(plan.id(), UUID.randomUUID())).verifyComplete();
    }

    @Test
    void unFijoSePagaUnaVezPorMes() {
        PlanMes plan = planDeOctubre();
        planes.crear(plan).block();
        UUID internet = plan.escenarios().getFirst().items().getFirst().id();
        movimientos.registrar(pago(internet)).block();
        StepVerifier.create(movimientos.registrar(pago(internet)))
                .expectErrorMatches(ex -> ex instanceof DomainException d && d.codigo().equals("YA_PAGADO"))
                .verify();
        StepVerifier.create(movimientos.pagoDe(internet, OCT))
                .expectNextMatches(m -> m.origen() == Movimiento.Origen.EXTERNA && m.monto() == 100_000)
                .verifyComplete();
        StepVerifier.create(movimientos.hayDeItem(internet)).expectNext(true).verifyComplete();
    }

    @Test
    void lasLineasDeIngresoSeGuardanYUnaLineaSeRecibeUnaVez() {
        PlanMes plan = planDeOctubre();
        planes.crear(plan).block();
        Escenario a = plan.escenarios().getFirst();
        IngresoPlan venta = planes.crearIngreso(new IngresoPlan(UUID.randomUUID(), a.id(), "Venta bicicleta", 400_000, null,
                IngresoPlan.Tipo.OTRO, null, 400_000, 2)).block();
        planes.actualizarIngreso(new IngresoPlan(venta.id(), a.id(), "Venta bici", 450_000, daniel, IngresoPlan.Tipo.OTRO, null, 500_000, 2)).block();
        StepVerifier.create(planes.deMes(hogar, OCT).map(p -> p.principal().ingresos().stream()
                        .map(l -> l.nombre() + ":" + l.monto() + ":" + l.bruto() + ":" + l.tipo()).toList()))
                .expectNext(List.of("Salario Daniel:6288000:6288000:OTRO", "Venta bici:450000:500000:OTRO"))
                .verifyComplete();

        movimientos.registrarRecibido(recibido(venta.id())).block();
        StepVerifier.create(movimientos.registrarRecibido(recibido(venta.id())))
                .expectErrorMatches(ex -> ex instanceof DomainException d && d.codigo().equals("YA_RECIBIDO"))
                .verify();
        StepVerifier.create(movimientos.lineaRecibida(venta.id(), null, OCT)).expectNext(true).verifyComplete();
        StepVerifier.create(movimientos.delMes(hogar, OCT).map(Movimiento::ingresoPlanId)).expectNext(venta.id()).verifyComplete();
        planes.quitarIngreso(a.ingresos().getFirst().id()).block();
        StepVerifier.create(planes.deMes(hogar, OCT).map(p -> p.principal().ingresos().size())).expectNext(1).verifyComplete();
    }

    @Test
    void elItemDeDiezmoGuardaSuEnlace() {
        PlanMes plan = planDeOctubre();
        planes.crear(plan).block();
        UUID diezmo = categorias.delHogar(hogar).filter(c -> c.tipo() == Categoria.Tipo.DIEZMO).blockFirst().id();
        Movimiento aporte = movimientos.registrar(new Movimiento(UUID.randomUUID(), hogar, Movimiento.Tipo.APORTE, OCT, 2_000_000,
                LocalDate.of(2026, 10, 26), daniel, daniel, null, null, null, true, null, null, "", Movimiento.Origen.NINGUNO)).block();
        planes.crearItem(new ItemPlan(UUID.randomUUID(), plan.escenarios().getFirst().id(), diezmo, "Diezmo · aporte 26 oct", 200_000,
                null, ItemPlan.Tipo.DIEZMO, null, null, 3, null, null, aporte.id(), null, false)).block();
        StepVerifier.create(planes.deMes(hogar, OCT).map(p -> p.principal().items().getLast()))
                .expectNextMatches(i -> i.tipo() == ItemPlan.Tipo.DIEZMO && aporte.id().equals(i.aporteId()) && i.ingresoFijoId() == null)
                .verifyComplete();
        // El diezmo de una linea guarda su enlace y si se ajusto a mano (design D1 de usabilidad-plan).
        IngresoPlan salario = plan.escenarios().getFirst().ingresos().getFirst();
        ItemPlan deSalario = planes.crearItem(new ItemPlan(UUID.randomUUID(), plan.escenarios().getFirst().id(), diezmo, "Diezmo · Salario Daniel",
                628_800, null, ItemPlan.Tipo.DIEZMO, null, null, 4, null, null, null, salario.id(), false)).block();
        planes.actualizarItem(deSalario.conMonto(deSalario.nombre(), 700_000, true)).block();
        StepVerifier.create(planes.deMes(hogar, OCT).map(p -> p.principal().items().getLast()))
                .expectNextMatches(i -> salario.id().equals(i.ingresoPlanId()) && i.ajustadoAMano() && i.monto() == 700_000)
                .verifyComplete();
    }

    private PlanMes planDeOctubre() {
        UUID planId = UUID.randomUUID();
        UUID escId = UUID.randomUUID();
        List<ItemPlan> items = List.of(
                new ItemPlan(UUID.randomUUID(), escId, fijos.id(), "Internet", 120_000, 15, ItemPlan.Tipo.FIJO, null, null, 1),
                new ItemPlan(UUID.randomUUID(), escId, fijos.id(), "Compra a cuotas", 375_000, 20, ItemPlan.Tipo.CUOTA, 4, 12, 2));
        List<IngresoPlan> ingresos = List.of(new IngresoPlan(UUID.randomUUID(), escId, "Salario Daniel", 6_288_000, daniel,
                IngresoPlan.Tipo.OTRO, null, 6_288_000, 1));
        return new PlanMes(planId, hogar, OCT, PlanMes.Estado.BORRADOR, null,
                List.of(new Escenario(escId, planId, "A", daniel, "", false, ingresos, items)));
    }

    private Movimiento recibido(UUID linea) {
        return new Movimiento(UUID.randomUUID(), hogar, Movimiento.Tipo.INGRESO_FIJO, OCT, 400_000, LocalDate.of(2026, 10, 26),
                daniel, daniel, null, null, null, false, null).conLinea(linea);
    }

    private Movimiento pago(UUID item) {
        return new Movimiento(UUID.randomUUID(), hogar, Movimiento.Tipo.PAGO, OCT, 100_000, LocalDate.of(2026, 10, 26), daniel,
                daniel, null, null, null, false, null, item, "", Movimiento.Origen.EXTERNA);
    }
}
