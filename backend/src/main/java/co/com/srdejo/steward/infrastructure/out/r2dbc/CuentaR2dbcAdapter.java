package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.UUID;

/** Cuentas del hogar con SQL explicito. */
public class CuentaR2dbcAdapter implements ICuentaPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, nombre, titular_id, saldo_cuadre, fecha_cuadre, cuadrada, seq_cuadre";

    private final DatabaseClient db;

    public CuentaR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Cuenta> crear(Cuenta cuenta) {
        // Su saldo estimado suma solo lo registrado despues de crearla, como agregarCuenta del dominio (design D1 de
        // backend-cuentas-creditos).
        var spec = db.sql("INSERT INTO cuenta (" + COLUMNAS + ") VALUES (:id, :hogar, :nombre, :titular, :saldo, :fecha, "
                        + ":cuadrada, (SELECT coalesce(max(seq), 0) FROM movimiento)) RETURNING " + COLUMNAS)
                .bind("id", cuenta.id())
                .bind("hogar", cuenta.hogarId())
                .bind("nombre", cuenta.nombre())
                .bind("saldo", cuenta.saldoCuadre())
                .bind("fecha", cuenta.fechaCuadre())
                .bind("cuadrada", cuenta.cuadrada());
        return Sql.opcional(spec, "titular", cuenta.titularId(), UUID.class).map(CuentaR2dbcAdapter::cuenta).one();
    }

    @Override
    public Mono<Cuenta> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM cuenta WHERE id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(CuentaR2dbcAdapter::cuenta)
                .one();
    }

    @Override
    public Mono<Cuenta> paraCuadrar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM cuenta WHERE id = :id AND hogar_id = :hogar FOR UPDATE")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(CuentaR2dbcAdapter::cuenta)
                .one();
    }

    @Override
    public Mono<Cuenta> cuadrar(Cuenta cuenta, long saldoBanco, LocalDate fecha, long seqCuadre) {
        return db.sql("UPDATE cuenta SET saldo_cuadre = :saldo, fecha_cuadre = :fecha, cuadrada = true, seq_cuadre = :seq "
                        + "WHERE id = :id RETURNING " + COLUMNAS)
                .bind("id", cuenta.id())
                .bind("saldo", saldoBanco)
                .bind("fecha", fecha)
                .bind("seq", seqCuadre)
                .map(CuentaR2dbcAdapter::cuenta)
                .one();
    }

    @Override
    public Mono<Void> reiniciar(Cuenta cuenta, long saldo, LocalDate fecha, long seq) {
        // "Empezar de nuevo": el saldo de hoy pasa a ser su punto de partida, sin marcarla cuadrada.
        return db.sql("UPDATE cuenta SET saldo_cuadre = :saldo, fecha_cuadre = :fecha, seq_cuadre = :seq WHERE id = :id")
                .bind("id", cuenta.id())
                .bind("saldo", saldo)
                .bind("fecha", fecha)
                .bind("seq", seq)
                .then();
    }

    @Override
    public Flux<Cuenta> delHogar(UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM cuenta WHERE hogar_id = :hogar ORDER BY nombre, id")
                .bind("hogar", hogarId)
                .map(CuentaR2dbcAdapter::cuenta)
                .all();
    }

    @Override
    public Mono<Void> quitarPropias(UUID hogarId, UUID usuarioId) {
        return db.sql("DELETE FROM cuenta WHERE hogar_id = :hogar AND titular_id = :usuario")
                .bind("hogar", hogarId)
                .bind("usuario", usuarioId)
                .then();
    }

    static Cuenta cuenta(Readable row) {
        return new Cuenta(row.get("id", UUID.class), row.get("hogar_id", UUID.class), row.get("nombre", String.class),
                row.get("titular_id", UUID.class), row.get("saldo_cuadre", Long.class),
                row.get("fecha_cuadre", LocalDate.class), Boolean.TRUE.equals(row.get("cuadrada", Boolean.class)),
                row.get("seq_cuadre", Long.class));
    }
}
