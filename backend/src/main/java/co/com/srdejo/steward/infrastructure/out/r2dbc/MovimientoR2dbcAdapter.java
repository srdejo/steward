package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Movimientos con SQL explicito (design D2 de backend-ingresos-diezmo y backend-plan-mes-hoy). Las garantias de
 * concurrencia son de la base: los indices {@code movimiento_recibido_uq} y {@code movimiento_recibido_linea_uq}
 * ({@code YA_RECIBIDO}) y {@code movimiento_pago_uq} ({@code YA_PAGADO}). Las entregas de diezmo ya no se registran: se leen
 * como historia, con lo que cubrian (design D3 de diezmo-como-gasto).
 *
 * <p>El saldo estimado (design D3 de backend-cuentas-creditos) reproduce {@code efecto()} de
 * {@code packages/domain/src/rules/cuentas.ts}: si cambia uno, cambia el otro.
 */
public class MovimientoR2dbcAdapter implements IMovimientoPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, tipo, ref_anio, ref_mes, monto, fecha, usuario_id, creado_por, "
            + "cuenta_id, ingreso_fijo_id, bruto, aplica_diezmo, item_id, nota, origen, cuenta_destino_id, credito_id, ingreso_plan_id, capital";
    private static final String SELECT = "SELECT " + COLUMNAS + ", seq, (SELECT array_agg(d.movimiento_id ORDER BY d.movimiento_id) "
            + "FROM diezmo_cubierto d WHERE d.entrega_id = m.id) AS diezmo_de FROM movimiento m ";

    private final DatabaseClient db;

    public MovimientoR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Movimiento> registrarRecibido(Movimiento recibido) {
        return insertar(recibido)
                .onErrorMap(ex -> Sql.violo(ex, "movimiento_recibido_uq") || Sql.violo(ex, "movimiento_recibido_linea_uq"),
                        ex -> DomainException.conflicto("YA_RECIBIDO", "Ese ingreso ya se marcó como recibido este mes"));
    }

    @Override
    public Mono<Movimiento> registrar(Movimiento movimiento) {
        return insertar(movimiento)
                // El caso de uso arma el mensaje con quien y cuando pago (lo vuelve a leer).
                .onErrorMap(ex -> Sql.violo(ex, "movimiento_pago_uq"),
                        ex -> DomainException.conflicto("YA_PAGADO", "Ese gasto ya está pagado este mes"));
    }

    /** Inserta y devuelve el movimiento con el orden de registro que le dio la base. */
    private Mono<Movimiento> insertar(Movimiento m) {
        var spec = db.sql("INSERT INTO movimiento (" + COLUMNAS + ") VALUES (:id, :hogar, :tipo, :anio, :mes, :monto, "
                        + ":fecha, :usuario, :creadoPor, :cuenta, :ingreso, :bruto, :aplicaDiezmo, :item, :nota, :origen, "
                        + ":destino, :credito, :linea, :capital) RETURNING seq")
                .bind("id", m.id())
                .bind("hogar", m.hogarId())
                .bind("tipo", m.tipo().name())
                .bind("anio", (short) m.ref().getYear())
                .bind("mes", (short) m.ref().getMonthValue())
                .bind("monto", m.monto())
                .bind("fecha", m.fecha())
                .bind("usuario", m.usuarioId())
                .bind("creadoPor", m.creadoPor())
                .bind("aplicaDiezmo", m.aplicaDiezmo())
                .bind("nota", m.nota())
                .bind("origen", m.origen().name());
        spec = Sql.opcional(spec, "cuenta", m.cuentaId(), UUID.class);
        spec = Sql.opcional(spec, "ingreso", m.ingresoFijoId(), UUID.class);
        spec = Sql.opcional(spec, "bruto", m.bruto(), Long.class);
        spec = Sql.opcional(spec, "item", m.itemId(), UUID.class);
        spec = Sql.opcional(spec, "destino", m.cuentaDestinoId(), UUID.class);
        spec = Sql.opcional(spec, "credito", m.creditoId(), UUID.class);
        spec = Sql.opcional(spec, "linea", m.ingresoPlanId(), UUID.class);
        spec = Sql.opcional(spec, "capital", m.capital(), Long.class);
        return spec.map(row -> m.conSeq(row.get("seq", Long.class))).one();
    }

    @Override
    public Flux<Movimiento> delMes(UUID hogarId, YearMonth mes) {
        return db.sql(SELECT + "WHERE hogar_id = :hogar AND ref_anio = :anio AND ref_mes = :mes ORDER BY seq")
                .bind("hogar", hogarId)
                .bind("anio", (short) mes.getYear())
                .bind("mes", (short) mes.getMonthValue())
                .map(MovimientoR2dbcAdapter::movimiento)
                .all();
    }

    @Override
    public Flux<Movimiento> desde(UUID hogarId, YearMonth desde) {
        // Tambien lo de antes que todavia cuenta en el saldo estimado de alguna cuenta (design D2 de
        // backend-cuentas-creditos). Sin cuentas, el min es null y la condicion no suma nada.
        return db.sql(SELECT + "WHERE hogar_id = :hogar AND ((ref_anio * 12 + ref_mes) >= :desde "
                        + "OR seq > (SELECT min(c.seq_cuadre) FROM cuenta c WHERE c.hogar_id = :hogar)) ORDER BY seq")
                .bind("hogar", hogarId)
                .bind("desde", desde.getYear() * 12 + desde.getMonthValue())
                .map(MovimientoR2dbcAdapter::movimiento)
                .all();
    }

    @Override
    public Mono<DelMes> paraCierre(UUID hogarId, YearMonth mes) {
        return db.sql("SELECT coalesce(sum(monto) FILTER (WHERE tipo = 'AJUSTE_CUADRE'), 0)::bigint AS ajustes, "
                        + "coalesce(max(seq), 0) AS ultimo FROM movimiento "
                        + "WHERE hogar_id = :hogar AND ref_anio = :anio AND ref_mes = :mes")
                .bind("hogar", hogarId)
                .bind("anio", (short) mes.getYear())
                .bind("mes", (short) mes.getMonthValue())
                .map(row -> new DelMes(row.get("ajustes", Long.class), row.get("ultimo", Long.class)))
                .one();
    }

    @Override
    public Mono<Movimiento> pagoDe(UUID itemId, YearMonth mes) {
        return db.sql(SELECT + "WHERE item_id = :item AND ref_anio = :anio AND ref_mes = :mes AND tipo = 'PAGO'")
                .bind("item", itemId)
                .bind("anio", (short) mes.getYear())
                .bind("mes", (short) mes.getMonthValue())
                .map(MovimientoR2dbcAdapter::movimiento)
                .one();
    }

    @Override
    public Mono<Boolean> hayDeItem(UUID itemId) {
        return db.sql("SELECT 1 FROM movimiento WHERE item_id = :item LIMIT 1")
                .bind("item", itemId)
                .map(row -> true)
                .one()
                .defaultIfEmpty(false);
    }

    @Override
    public Mono<Movimiento> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql(SELECT + "WHERE m.id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(MovimientoR2dbcAdapter::movimiento)
                .one();
    }

    @Override
    public Mono<Void> corregir(Movimiento m) {
        var spec = db.sql("UPDATE movimiento SET monto = :monto, cuenta_id = :cuenta, origen = :origen, nota = :nota WHERE id = :id")
                .bind("id", m.id())
                .bind("monto", m.monto())
                .bind("origen", m.origen().name())
                .bind("nota", m.nota());
        return Sql.opcional(spec, "cuenta", m.cuentaId(), UUID.class).then();
    }

    @Override
    public Mono<Void> borrar(UUID id) {
        return db.sql("DELETE FROM movimiento WHERE id = :id").bind("id", id).then();
    }

    @Override
    public Mono<Boolean> lineaRecibida(UUID lineaId, UUID ingresoFijoId, YearMonth mes) {
        var spec = db.sql("SELECT 1 FROM movimiento WHERE tipo = 'INGRESO_FIJO' AND (ingreso_plan_id = :linea "
                        + "OR (ingreso_fijo_id = :ingreso AND ref_anio = :anio AND ref_mes = :mes)) LIMIT 1")
                .bind("linea", lineaId)
                .bind("anio", (short) mes.getYear())
                .bind("mes", (short) mes.getMonthValue());
        return Sql.opcional(spec, "ingreso", ingresoFijoId, UUID.class).map(row -> true).one().defaultIfEmpty(false);
    }

    @Override
    public Mono<Saldo> saldoEstimado(Cuenta cuenta) {
        return db.sql("SELECT coalesce(sum(CASE "
                        + "WHEN tipo IN ('INGRESO_FIJO', 'APORTE') THEN CASE WHEN de_la_cuenta THEN monto ELSE 0 END "
                        + "WHEN tipo IN ('PAGO', 'GASTO', 'DIEZMO_ENTREGADO', 'ABONO_CREDITO') THEN CASE WHEN de_la_cuenta THEN -monto ELSE 0 END "
                        + "WHEN tipo = 'TRANSFERENCIA' THEN CASE WHEN de_la_cuenta THEN -monto ELSE 0 END "
                        + "+ CASE WHEN cuenta_destino_id = :cuenta THEN monto ELSE 0 END "
                        + "ELSE 0 END), 0)::bigint AS efecto, coalesce(max(seq), :seqCuadre) AS ultimo "
                        + "FROM (SELECT *, (origen = 'CUENTA' AND cuenta_id = :cuenta) AS de_la_cuenta FROM movimiento "
                        + "WHERE hogar_id = :hogar AND seq > :seqCuadre) m")
                .bind("cuenta", cuenta.id())
                .bind("hogar", cuenta.hogarId())
                .bind("seqCuadre", cuenta.seqCuadre())
                .map(row -> new Saldo(cuenta.saldoCuadre() + row.get("efecto", Long.class), row.get("ultimo", Long.class)))
                .one();
    }

    @Override
    public Flux<Movimiento> ultimosDeCreditos(UUID hogarId, int porCredito) {
        return db.sql(SELECT + "WHERE m.id IN (SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY credito_id ORDER BY seq DESC) n "
                        + "FROM movimiento WHERE hogar_id = :hogar AND credito_id IS NOT NULL) u WHERE u.n <= :cuantos) ORDER BY seq DESC")
                .bind("hogar", hogarId)
                .bind("cuantos", porCredito)
                .map(MovimientoR2dbcAdapter::movimiento)
                .all();
    }

    private static Movimiento movimiento(Readable row) {
        UUID[] cubre = row.get("diezmo_de", UUID[].class);
        List<UUID> diezmoDe = cubre == null ? List.of() : Arrays.asList(cubre);
        return new Movimiento(row.get("id", UUID.class), row.get("hogar_id", UUID.class),
                Movimiento.Tipo.valueOf(row.get("tipo", String.class)),
                YearMonth.of(row.get("ref_anio", Short.class), row.get("ref_mes", Short.class)), row.get("monto", Long.class),
                row.get("fecha", LocalDate.class), row.get("usuario_id", UUID.class), row.get("creado_por", UUID.class),
                row.get("cuenta_id", UUID.class), row.get("ingreso_fijo_id", UUID.class), row.get("bruto", Long.class),
                Boolean.TRUE.equals(row.get("aplica_diezmo", Boolean.class)), diezmoDe, row.get("item_id", UUID.class),
                row.get("nota", String.class), Movimiento.Origen.valueOf(row.get("origen", String.class)),
                row.get("cuenta_destino_id", UUID.class), row.get("credito_id", UUID.class), row.get("ingreso_plan_id", UUID.class), row.get("capital", Long.class),
                row.get("seq", Long.class));
    }
}
