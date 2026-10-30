package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.UUID;

/** Reglas de diezmo, una por persona (PK {@code usuario_id}). */
public class ReglaDiezmoR2dbcAdapter implements IReglaDiezmoPersistencePort {

    private static final String COLUMNAS = "usuario_id, activa, porcentaje, base, aplica_aportes";

    private final DatabaseClient db;

    public ReglaDiezmoR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<ReglaDiezmo> dePersona(UUID usuarioId) {
        return db.sql("SELECT " + COLUMNAS + " FROM regla_diezmo WHERE usuario_id = :usuario")
                .bind("usuario", usuarioId)
                .map(ReglaDiezmoR2dbcAdapter::regla)
                .one();
    }

    @Override
    public Flux<ReglaDiezmo> dePersonas(Collection<UUID> usuarioIds) {
        if (usuarioIds.isEmpty()) {
            return Flux.empty();
        }
        return db.sql("SELECT " + COLUMNAS + " FROM regla_diezmo WHERE usuario_id = ANY(:usuarios) ORDER BY usuario_id")
                .bind("usuarios", usuarioIds.toArray(UUID[]::new))
                .map(ReglaDiezmoR2dbcAdapter::regla)
                .all();
    }

    @Override
    public Mono<ReglaDiezmo> guardar(ReglaDiezmo regla) {
        return db.sql("INSERT INTO regla_diezmo (" + COLUMNAS + ") VALUES (:usuario, :activa, :porcentaje, :base, :aportes) "
                        + "ON CONFLICT (usuario_id) DO UPDATE SET activa = excluded.activa, porcentaje = excluded.porcentaje, "
                        + "base = excluded.base, aplica_aportes = excluded.aplica_aportes")
                .bind("usuario", regla.usuarioId())
                .bind("activa", regla.activa())
                .bind("porcentaje", regla.porcentaje())
                .bind("base", regla.base().name())
                .bind("aportes", regla.aplicaAportes())
                .then()
                .thenReturn(regla);
    }

    @Override
    public Mono<Void> alUnirse(UUID usuarioId, boolean diezmoAportes) {
        if (!diezmoAportes) {
            return db.sql("UPDATE regla_diezmo SET aplica_aportes = false WHERE usuario_id = :usuario")
                    .bind("usuario", usuarioId)
                    .then();
        }
        ReglaDiezmo nueva = ReglaDiezmo.deAportes(usuarioId);
        return db.sql("INSERT INTO regla_diezmo (" + COLUMNAS + ") VALUES (:usuario, :activa, :porcentaje, :base, true) "
                        + "ON CONFLICT (usuario_id) DO UPDATE SET aplica_aportes = true")
                .bind("usuario", usuarioId)
                .bind("activa", nueva.activa())
                .bind("porcentaje", nueva.porcentaje())
                .bind("base", nueva.base().name())
                .then();
    }

    static ReglaDiezmo regla(Readable row) {
        return new ReglaDiezmo(row.get("usuario_id", UUID.class), Boolean.TRUE.equals(row.get("activa", Boolean.class)),
                row.get("porcentaje", BigDecimal.class), ReglaDiezmo.Base.valueOf(row.get("base", String.class)),
                Boolean.TRUE.equals(row.get("aplica_aportes", Boolean.class)));
    }
}
