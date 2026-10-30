package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Planes con SQL explicito (design D2). Un plan se arma con cuatro consultas: los planes, sus opciones, sus lineas de
 * ingreso y sus items (design D8 de diezmo-como-gasto). El
 * indice {@code plan_mes_uq} garantiza {@code YA_EXISTE}.
 */
public class PlanR2dbcAdapter implements IPlanPersistencePort {

    private static final String PLAN = "SELECT id, hogar_id, ref_anio, ref_mes, estado, escenario_activo_id FROM plan_mes ";
    private static final String ITEM = "id, escenario_id, categoria_id, nombre, monto, dia_vence, tipo, cuota_actual, cuota_total, orden, credito_id, "
            + "ingreso_fijo_id, aporte_id, ingreso_plan_id, ajustado_a_mano";
    private static final String INGRESO = "id, escenario_id, nombre, monto, usuario_id, tipo, ingreso_fijo_id, bruto, orden";

    private final DatabaseClient db;

    public PlanR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<PlanMes> crear(PlanMes plan) {
        var spec = db.sql("INSERT INTO plan_mes (id, hogar_id, ref_anio, ref_mes, estado, escenario_activo_id) "
                        + "VALUES (:id, :hogar, :anio, :mes, :estado, :activo)")
                .bind("id", plan.id())
                .bind("hogar", plan.hogarId())
                .bind("anio", (short) plan.ref().getYear())
                .bind("mes", (short) plan.ref().getMonthValue())
                .bind("estado", plan.estado().name());
        return Sql.opcional(spec, "activo", plan.escenarioActivoId(), UUID.class).then()
                .onErrorMap(ex -> Sql.violo(ex, "plan_mes_uq"),
                        ex -> DomainException.conflicto("YA_EXISTE", "Ese mes ya tiene plan"))
                .thenMany(Flux.fromIterable(plan.escenarios()).concatMap(this::insertarEscenario))
                .then(Mono.just(plan));
    }

    @Override
    public Mono<Escenario> crearEscenario(Escenario e) {
        return insertarEscenario(e)
                .onErrorMap(ex -> Sql.violo(ex, "escenario_plan_id_letra_key"),
                        ex -> DomainException.conflicto("LETRA_OCUPADA", "Esa letra ya la tomó otra opción"))
                .thenReturn(e);
    }

    @Override
    public Mono<Void> quitarEscenario(UUID escenarioId) {
        return db.sql("DELETE FROM escenario WHERE id = :id").bind("id", escenarioId).then();
    }

    private Mono<Void> insertarEscenario(Escenario e) {
        return db.sql("INSERT INTO escenario (id, plan_id, letra, creado_por, nota, archivado) "
                        + "VALUES (:id, :plan, :letra, :creadoPor, :nota, :archivado)")
                .bind("id", e.id())
                .bind("plan", e.planId())
                .bind("letra", e.letra())
                .bind("creadoPor", e.creadoPor())
                .bind("nota", e.nota())
                .bind("archivado", e.archivado())
                .then()
                .thenMany(Flux.fromIterable(e.ingresos()).concatMap(this::crearIngreso))
                .thenMany(Flux.fromIterable(e.items()).concatMap(this::crearItem))
                .then();
    }

    @Override
    public Mono<PlanMes> deMes(UUID hogarId, YearMonth ref) {
        return completos(db.sql(PLAN + "WHERE hogar_id = :hogar AND ref_anio = :anio AND ref_mes = :mes")
                .bind("hogar", hogarId)
                .bind("anio", (short) ref.getYear())
                .bind("mes", (short) ref.getMonthValue())
                .map(PlanR2dbcAdapter::plan)
                .all()).next();
    }

    @Override
    public Mono<PlanMes> porIdEnHogar(UUID planId, UUID hogarId) {
        return completos(db.sql(PLAN + "WHERE id = :id AND hogar_id = :hogar")
                .bind("id", planId)
                .bind("hogar", hogarId)
                .map(PlanR2dbcAdapter::plan)
                .all()).next();
    }

    @Override
    public Mono<PlanMes> ultimoAntesDe(UUID hogarId, YearMonth ref) {
        return completos(db.sql(PLAN + "WHERE hogar_id = :hogar AND (ref_anio * 12 + ref_mes) < :ref ORDER BY ref_anio DESC, ref_mes DESC LIMIT 1")
                .bind("hogar", hogarId)
                .bind("ref", ref.getYear() * 12 + ref.getMonthValue())
                .map(PlanR2dbcAdapter::plan)
                .all()).next();
    }

    @Override
    public Flux<PlanMes> desde(UUID hogarId, YearMonth desde) {
        return completos(db.sql(PLAN + "WHERE hogar_id = :hogar AND (ref_anio * 12 + ref_mes) >= :desde ORDER BY ref_anio, ref_mes")
                .bind("hogar", hogarId)
                .bind("desde", desde.getYear() * 12 + desde.getMonthValue())
                .map(PlanR2dbcAdapter::plan)
                .all());
    }

    /** Llena opciones e items de los planes, con una consulta para cada nivel. */
    private Flux<PlanMes> completos(Flux<PlanMes> planes) {
        return planes.collectList().flatMapMany(lista -> {
            if (lista.isEmpty()) {
                return Flux.empty();
            }
            UUID[] planIds = lista.stream().map(PlanMes::id).toArray(UUID[]::new);
            return db.sql("SELECT id, plan_id, letra, creado_por, nota, archivado FROM escenario WHERE plan_id = ANY(:planes) ORDER BY letra")
                    .bind("planes", planIds)
                    .map(PlanR2dbcAdapter::escenario)
                    .all()
                    .collectList()
                    .flatMapMany(escenarios -> {
                        UUID[] escIds = escenarios.stream().map(Escenario::id).toArray(UUID[]::new);
                        Mono<Map<UUID, List<ItemPlan>>> items = escIds.length == 0 ? Mono.just(Map.of())
                                : db.sql("SELECT " + ITEM + " FROM item_plan WHERE escenario_id = ANY(:escenarios) ORDER BY orden, id")
                                .bind("escenarios", escIds)
                                .map(PlanR2dbcAdapter::item)
                                .all()
                                .collect(Collectors.groupingBy(ItemPlan::escenarioId));
                        Mono<Map<UUID, List<IngresoPlan>>> ingresos = escIds.length == 0 ? Mono.just(Map.of())
                                : db.sql("SELECT " + INGRESO + " FROM ingreso_plan WHERE escenario_id = ANY(:escenarios) ORDER BY orden, id")
                                .bind("escenarios", escIds)
                                .map(PlanR2dbcAdapter::ingreso)
                                .all()
                                .collect(Collectors.groupingBy(IngresoPlan::escenarioId));
                        return Mono.zip(items, ingresos).flatMapMany(t -> {
                            Map<UUID, List<ItemPlan>> porEscenario = t.getT1();
                            Map<UUID, List<IngresoPlan>> lineas = t.getT2();
                            Map<UUID, List<Escenario>> porPlan = escenarios.stream()
                                    .map(e -> e.conItems(porEscenario.getOrDefault(e.id(), List.of()))
                                            .conIngresos(lineas.getOrDefault(e.id(), List.of())))
                                    .collect(Collectors.groupingBy(Escenario::planId));
                            return Flux.fromIterable(lista).map(p -> p.conEscenarios(porPlan.getOrDefault(p.id(), List.of())));
                        });
                    });
        });
    }

    @Override
    public Mono<ItemPlan> crearItem(ItemPlan item) {
        return valores(db.sql("INSERT INTO item_plan (" + ITEM + ") VALUES (:id, :escenario, :categoria, :nombre, :monto, "
                + ":dia, :tipo, :cuotaActual, :cuotaTotal, :orden, :credito, :ingreso, :aporte, :linea, :ajustado)"), item).then().thenReturn(item);
    }

    @Override
    public Mono<ItemPlan> actualizarItem(ItemPlan item) {
        return valores(db.sql("UPDATE item_plan SET categoria_id = :categoria, nombre = :nombre, monto = :monto, "
                + "dia_vence = :dia, tipo = :tipo, cuota_actual = :cuotaActual, cuota_total = :cuotaTotal, orden = :orden, credito_id = :credito, "
                + "ingreso_fijo_id = :ingreso, aporte_id = :aporte, ingreso_plan_id = :linea, ajustado_a_mano = :ajustado "
                + "WHERE id = :id AND escenario_id = :escenario"), item).then().thenReturn(item);
    }

    private static DatabaseClient.GenericExecuteSpec valores(DatabaseClient.GenericExecuteSpec spec, ItemPlan i) {
        DatabaseClient.GenericExecuteSpec conValores = spec.bind("id", i.id())
                .bind("escenario", i.escenarioId())
                .bind("categoria", i.categoriaId())
                .bind("nombre", i.nombre())
                .bind("monto", i.monto())
                .bind("tipo", i.tipo().name())
                .bind("orden", i.orden())
                .bind("ajustado", i.ajustadoAMano());
        conValores = Sql.opcional(conValores, "dia", corto(i.diaVence()), Short.class);
        conValores = Sql.opcional(conValores, "linea", i.ingresoPlanId(), UUID.class);
        conValores = Sql.opcional(conValores, "cuotaActual", corto(i.cuotaActual()), Short.class);
        conValores = Sql.opcional(conValores, "cuotaTotal", corto(i.cuotaTotal()), Short.class);
        conValores = Sql.opcional(conValores, "ingreso", i.ingresoFijoId(), UUID.class);
        conValores = Sql.opcional(conValores, "aporte", i.aporteId(), UUID.class);
        return Sql.opcional(conValores, "credito", i.creditoId(), UUID.class);
    }

    @Override
    public Mono<IngresoPlan> crearIngreso(IngresoPlan linea) {
        return valores(db.sql("INSERT INTO ingreso_plan (" + INGRESO + ") VALUES (:id, :escenario, :nombre, :monto, :usuario, "
                + ":tipo, :ingreso, :bruto, :orden)"), linea).then().thenReturn(linea);
    }

    @Override
    public Mono<IngresoPlan> actualizarIngreso(IngresoPlan linea) {
        return valores(db.sql("UPDATE ingreso_plan SET nombre = :nombre, monto = :monto, usuario_id = :usuario, tipo = :tipo, "
                + "ingreso_fijo_id = :ingreso, bruto = :bruto, orden = :orden WHERE id = :id AND escenario_id = :escenario"), linea).then().thenReturn(linea);
    }

    @Override
    public Mono<Void> quitarIngreso(UUID lineaId) {
        return db.sql("DELETE FROM ingreso_plan WHERE id = :id").bind("id", lineaId).then();
    }

    private static DatabaseClient.GenericExecuteSpec valores(DatabaseClient.GenericExecuteSpec spec, IngresoPlan l) {
        DatabaseClient.GenericExecuteSpec conValores = spec.bind("id", l.id())
                .bind("escenario", l.escenarioId())
                .bind("nombre", l.nombre())
                .bind("monto", l.monto())
                .bind("tipo", l.tipo().name())
                .bind("bruto", l.bruto())
                .bind("orden", l.orden());
        conValores = Sql.opcional(conValores, "usuario", l.usuarioId(), UUID.class);
        return Sql.opcional(conValores, "ingreso", l.ingresoFijoId(), UUID.class);
    }

    private static Short corto(Integer valor) {
        return valor == null ? null : valor.shortValue();
    }

    @Override
    public Mono<Void> quitarItem(UUID itemId) {
        return db.sql("DELETE FROM item_plan WHERE id = :id").bind("id", itemId).then();
    }

    @Override
    public Mono<Void> borrar(UUID planId) {
        // En cascada: opciones, lineas e items. Los pagos del mes se borran antes (design D4 de usabilidad-plan).
        return db.sql("DELETE FROM plan_mes WHERE id = :id").bind("id", planId).then();
    }

    @Override
    public Mono<Void> empezarDeNuevo(UUID hogarId) {
        // Primero lo registrado (los items no se borran mientras tengan pagos), luego planes, cierres, anuales y proyecciones.
        return Flux.just("DELETE FROM movimiento WHERE hogar_id = :hogar", "DELETE FROM plan_mes WHERE hogar_id = :hogar",
                        "DELETE FROM cierre_mes WHERE hogar_id = :hogar", "DELETE FROM plan_anual WHERE hogar_id = :hogar",
                        "DELETE FROM proyeccion_aporte WHERE hogar_id = :hogar")
                .concatMap(sql -> db.sql(sql).bind("hogar", hogarId).then())
                .then();
    }

    @Override
    public Mono<Void> usar(UUID planId, UUID escenarioId) {
        // "Usar esta": queda como el plan del mes; las demas se archivan, no se borran (usarEscenario del dominio).
        return db.sql("UPDATE plan_mes SET escenario_activo_id = :escenario WHERE id = :plan")
                .bind("plan", planId)
                .bind("escenario", escenarioId)
                .then()
                .then(db.sql("UPDATE escenario SET archivado = (id <> :escenario) WHERE plan_id = :plan")
                        .bind("plan", planId)
                        .bind("escenario", escenarioId)
                        .then());
    }

    private static PlanMes plan(Readable row) {
        return new PlanMes(row.get("id", UUID.class), row.get("hogar_id", UUID.class),
                YearMonth.of(row.get("ref_anio", Short.class), row.get("ref_mes", Short.class)),
                PlanMes.Estado.valueOf(row.get("estado", String.class)), row.get("escenario_activo_id", UUID.class), List.of());
    }

    private static Escenario escenario(Readable row) {
        return new Escenario(row.get("id", UUID.class), row.get("plan_id", UUID.class), row.get("letra", String.class),
                row.get("creado_por", UUID.class), row.get("nota", String.class),
                Boolean.TRUE.equals(row.get("archivado", Boolean.class)), List.of(), List.of());
    }

    private static ItemPlan item(Readable row) {
        Short dia = row.get("dia_vence", Short.class);
        Short actual = row.get("cuota_actual", Short.class);
        Short total = row.get("cuota_total", Short.class);
        return new ItemPlan(row.get("id", UUID.class), row.get("escenario_id", UUID.class), row.get("categoria_id", UUID.class),
                row.get("nombre", String.class), row.get("monto", Long.class), dia == null ? null : dia.intValue(),
                ItemPlan.Tipo.valueOf(row.get("tipo", String.class)), actual == null ? null : actual.intValue(),
                total == null ? null : total.intValue(), row.get("orden", Integer.class), row.get("credito_id", UUID.class),
                row.get("ingreso_fijo_id", UUID.class), row.get("aporte_id", UUID.class), row.get("ingreso_plan_id", UUID.class),
                Boolean.TRUE.equals(row.get("ajustado_a_mano", Boolean.class)));
    }

    private static IngresoPlan ingreso(Readable row) {
        return new IngresoPlan(row.get("id", UUID.class), row.get("escenario_id", UUID.class), row.get("nombre", String.class),
                row.get("monto", Long.class), row.get("usuario_id", UUID.class),
                IngresoPlan.Tipo.valueOf(row.get("tipo", String.class)), row.get("ingreso_fijo_id", UUID.class),
                row.get("bruto", Long.class), row.get("orden", Integer.class));
    }
}
