package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Creditos con SQL explicito. Abonar y pagar la cuota cambian el saldo en la misma sentencia que lo leen (design D4 de
 * backend-cuentas-creditos): dos registros a la vez no lo dejan por debajo de cero.
 */
public class CreditoR2dbcAdapter implements ICreditoPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, nombre, entidad, saldo, saldo_actualizado_en, cuota, tasa_em, "
            + "dia_pago, total_original";

    private final DatabaseClient db;

    public CreditoR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Credito> crear(Credito c) {
        return db.sql("INSERT INTO credito (" + COLUMNAS + ") VALUES (:id, :hogar, :nombre, :entidad, :saldo, :fecha, "
                        + ":cuota, :tasa, :dia, :total)")
                .bind("id", c.id())
                .bind("hogar", c.hogarId())
                .bind("nombre", c.nombre())
                .bind("entidad", c.entidad())
                .bind("saldo", c.saldo())
                .bind("fecha", c.saldoActualizadoEn())
                .bind("cuota", c.cuota())
                .bind("tasa", c.tasaEm())
                .bind("dia", (short) c.diaPago())
                .bind("total", c.totalOriginal())
                .then()
                .thenReturn(c);
    }

    @Override
    public Mono<Credito> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM credito WHERE id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(CreditoR2dbcAdapter::credito)
                .one();
    }

    @Override
    public Flux<Credito> delHogar(UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM credito WHERE hogar_id = :hogar ORDER BY creado_en, id")
                .bind("hogar", hogarId)
                .map(CreditoR2dbcAdapter::credito)
                .all();
    }

    @Override
    public Mono<Void> actualizarSaldo(UUID id, long saldo, LocalDate fecha) {
        return db.sql("UPDATE credito SET saldo = :saldo, saldo_actualizado_en = :fecha WHERE id = :id")
                .bind("id", id)
                .bind("saldo", saldo)
                .bind("fecha", fecha)
                .then();
    }

    @Override
    public Mono<Credito> abonar(UUID id, long monto, LocalDate fecha) {
        return db.sql("UPDATE credito SET saldo = saldo - :monto, saldo_actualizado_en = :fecha "
                        + "WHERE id = :id AND saldo >= :monto RETURNING " + COLUMNAS)
                .bind("id", id)
                .bind("monto", monto)
                .bind("fecha", fecha)
                .map(CreditoR2dbcAdapter::credito)
                .one();
    }

    @Override
    public Mono<Long> pagarCuota(UUID id, long monto) {
        // Como marcarPago del dominio: el interes es round(saldo * tasa / 100) (round de Postgres sube las mitades), y la
        // fecha del saldo no cambia. Devuelve cuanto bajo el saldo, para devolverlo si se borra el pago.
        return db.sql("WITH antes AS (SELECT saldo FROM credito WHERE id = :id FOR UPDATE) "
                        + "UPDATE credito c SET saldo = greatest(0, c.saldo - greatest(0, :monto - round(c.saldo * c.tasa_em / 100))) "
                        + "FROM antes WHERE c.id = :id RETURNING antes.saldo - c.saldo AS capital")
                .bind("id", id)
                .bind("monto", monto)
                .map(row -> row.get("capital", Long.class))
                .one();
    }

    @Override
    public Mono<Void> devolver(UUID id, long capital) {
        return db.sql("UPDATE credito SET saldo = saldo + :capital WHERE id = :id")
                .bind("id", id)
                .bind("capital", capital)
                .then();
    }

    private static Credito credito(Readable row) {
        return new Credito(row.get("id", UUID.class), row.get("hogar_id", UUID.class), row.get("nombre", String.class),
                row.get("entidad", String.class), row.get("saldo", Long.class),
                row.get("saldo_actualizado_en", LocalDate.class), row.get("cuota", Long.class),
                row.get("tasa_em", BigDecimal.class), row.get("dia_pago", Short.class), row.get("total_original", Long.class),
                List.of());
    }
}
