package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.CierreMes;
import co.com.srdejo.steward.domain.spi.ICierrePersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Cierres con SQL explicito; el indice {@code cierre_mes_uq} garantiza {@code MES_CERRADO}. */
public class CierreR2dbcAdapter implements ICierrePersistencePort {

    private static final String COLUMNAS = "id, hogar_id, ref_anio, ref_mes, sin_registrar, sobrante, a_ahorro, a_siguiente, "
            + "cerrado_por, cerrado_en";

    private final DatabaseClient db;

    public CierreR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<CierreMes> guardar(CierreMes c) {
        Mono<Void> cierre = db.sql("INSERT INTO cierre_mes (" + COLUMNAS + ") VALUES (:id, :hogar, :anio, :mes, :sinRegistrar, "
                        + ":sobrante, :ahorro, :siguiente, :por, :en)")
                .bind("id", c.id())
                .bind("hogar", c.hogarId())
                .bind("anio", (short) c.ref().getYear())
                .bind("mes", (short) c.ref().getMonthValue())
                .bind("sinRegistrar", c.sinRegistrar())
                .bind("sobrante", c.sobrante())
                .bind("ahorro", c.aAhorro())
                .bind("siguiente", c.aSiguiente())
                .bind("por", c.cerradoPor())
                .bind("en", c.cerradoEn())
                .then()
                .onErrorMap(ex -> Sql.violo(ex, "cierre_mes_uq"), ex -> mesCerrado());
        Flux<Void> filas = Flux.range(0, c.filas().size()).concatMap(i -> {
            CierreMes.Fila f = c.filas().get(i);
            return Sql.opcional(db.sql("INSERT INTO cierre_fila (cierre_id, orden, nombre, plan, real) "
                                    + "VALUES (:cierre, :orden, :nombre, :plan, :real)")
                            .bind("cierre", c.id())
                            .bind("orden", (short) (int) i)
                            .bind("nombre", f.nombre())
                            .bind("real", f.real()), "plan", f.plan(), Long.class)
                    .then();
        });
        Mono<Void> plan = db.sql("UPDATE plan_mes SET estado = 'CERRADO' WHERE hogar_id = :hogar AND ref_anio = :anio "
                        + "AND ref_mes = :mes")
                .bind("hogar", c.hogarId())
                .bind("anio", (short) c.ref().getYear())
                .bind("mes", (short) c.ref().getMonthValue())
                .then();
        return cierre.thenMany(filas).then(plan).thenReturn(c);
    }

    @Override
    public Flux<CierreMes> desde(UUID hogarId, YearMonth desde) {
        return db.sql("SELECT " + COLUMNAS + " FROM cierre_mes WHERE hogar_id = :hogar AND (ref_anio * 12 + ref_mes) >= :desde "
                        + "ORDER BY ref_anio, ref_mes")
                .bind("hogar", hogarId)
                .bind("desde", desde.getYear() * 12 + desde.getMonthValue())
                .map(CierreR2dbcAdapter::cierre)
                .all()
                .concatMap(c -> db.sql("SELECT nombre, plan, real FROM cierre_fila WHERE cierre_id = :id ORDER BY orden")
                        .bind("id", c.id())
                        .map(row -> new CierreMes.Fila(row.get("nombre", String.class), row.get("plan", Long.class),
                                row.get("real", Long.class)))
                        .all()
                        .collectList()
                        .map(filas -> new CierreMes(c.id(), c.hogarId(), c.ref(), filas, c.sinRegistrar(), c.sobrante(),
                                c.aAhorro(), c.aSiguiente(), c.cerradoPor(), c.cerradoEn())));
    }

    @Override
    public Mono<Void> borrar(UUID hogarId, YearMonth mes) {
        return db.sql("DELETE FROM cierre_mes WHERE hogar_id = :hogar AND ref_anio = :anio AND ref_mes = :mes")
                .bind("hogar", hogarId)
                .bind("anio", (short) mes.getYear())
                .bind("mes", (short) mes.getMonthValue())
                .then();
    }

    @Override
    public Mono<Boolean> estaCerrado(UUID hogarId, YearMonth mes) {
        return db.sql("SELECT EXISTS (SELECT 1 FROM cierre_mes WHERE hogar_id = :hogar AND ref_anio = :anio AND ref_mes = :mes) "
                        + "OR EXISTS (SELECT 1 FROM plan_mes WHERE hogar_id = :hogar AND ref_anio = :anio AND ref_mes = :mes "
                        + "AND estado = 'CERRADO') AS cerrado")
                .bind("hogar", hogarId)
                .bind("anio", (short) mes.getYear())
                .bind("mes", (short) mes.getMonthValue())
                .map(row -> Boolean.TRUE.equals(row.get("cerrado", Boolean.class)))
                .one();
    }

    static DomainException mesCerrado() {
        return DomainException.conflicto("MES_CERRADO", "El mes está cerrado");
    }

    private static CierreMes cierre(Readable row) {
        return new CierreMes(row.get("id", UUID.class), row.get("hogar_id", UUID.class),
                YearMonth.of(row.get("ref_anio", Short.class), row.get("ref_mes", Short.class)), List.of(),
                row.get("sin_registrar", Long.class), row.get("sobrante", Long.class), row.get("a_ahorro", Long.class),
                row.get("a_siguiente", Long.class), row.get("cerrado_por", UUID.class), row.get("cerrado_en", LocalDate.class));
    }
}
