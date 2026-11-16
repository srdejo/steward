package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Tarjeta;
import co.com.srdejo.steward.domain.spi.ITarjetaPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Tarjetas con SQL explicito (tabla de V12). */
public class TarjetaR2dbcAdapter implements ITarjetaPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, nombre, dia_corte, dia_pago, uso, pago_tipo, pago_monto";

    private final DatabaseClient db;

    public TarjetaR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Tarjeta> crear(Tarjeta t) {
        return valores(db.sql("INSERT INTO tarjeta (" + COLUMNAS + ") VALUES (:id, :hogar, :nombre, :corte, :pago, :uso, "
                + ":tipo, :monto)"), t).then().thenReturn(t);
    }

    @Override
    public Mono<Tarjeta> actualizar(Tarjeta t) {
        return valores(db.sql("UPDATE tarjeta SET nombre = :nombre, dia_corte = :corte, dia_pago = :pago, uso = :uso, "
                + "pago_tipo = :tipo, pago_monto = :monto WHERE id = :id AND hogar_id = :hogar"), t).then().thenReturn(t);
    }

    @Override
    public Mono<Tarjeta> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM tarjeta WHERE id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(TarjetaR2dbcAdapter::tarjeta)
                .one();
    }

    @Override
    public Flux<Tarjeta> delHogar(UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM tarjeta WHERE hogar_id = :hogar ORDER BY creado_en, id")
                .bind("hogar", hogarId)
                .map(TarjetaR2dbcAdapter::tarjeta)
                .all();
    }

    @Override
    public Mono<Void> borrar(UUID id) {
        return db.sql("DELETE FROM tarjeta WHERE id = :id").bind("id", id).then();
    }

    @Override
    public Mono<Void> pagada(UUID id, long monto) {
        return db.sql("UPDATE tarjeta SET pago_monto = :monto WHERE id = :id AND pago_tipo = 'COMPLETA'")
                .bind("id", id)
                .bind("monto", monto)
                .then();
    }

    private static DatabaseClient.GenericExecuteSpec valores(DatabaseClient.GenericExecuteSpec spec, Tarjeta t) {
        return spec.bind("id", t.id())
                .bind("hogar", t.hogarId())
                .bind("nombre", t.nombre())
                .bind("corte", (short) t.diaCorte())
                .bind("pago", (short) t.diaPago())
                .bind("uso", t.uso())
                .bind("tipo", t.pagoTipo().name())
                .bind("monto", t.pagoMonto());
    }

    private static Tarjeta tarjeta(Readable row) {
        return new Tarjeta(row.get("id", UUID.class), row.get("hogar_id", UUID.class), row.get("nombre", String.class),
                row.get("dia_corte", Short.class), row.get("dia_pago", Short.class), row.get("uso", String.class),
                Tarjeta.Pago.valueOf(row.get("pago_tipo", String.class)), row.get("pago_monto", Long.class));
    }
}
