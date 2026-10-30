package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Invitacion;
import co.com.srdejo.steward.domain.spi.IInvitacionPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/** Invitaciones con SQL explicito. Solo el hash del token; las busquedas por id filtran por hogar (design D6 y D7). */
public class InvitacionR2dbcAdapter implements IInvitacionPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, email, estado, creada_por, enviada_en, expira_en";

    private final DatabaseClient db;

    public InvitacionR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Invitacion> crear(Invitacion inv, String tokenHash) {
        return db.sql("INSERT INTO invitacion (id, hogar_id, email, token_hash, estado, creada_por, enviada_en, expira_en) "
                        + "VALUES (:id, :hogar, :email, :hash, 'PENDIENTE', :creadaPor, :enviadaEn, :expiraEn)")
                .bind("id", inv.id())
                .bind("hogar", inv.hogarId())
                .bind("email", inv.email())
                .bind("hash", tokenHash)
                .bind("creadaPor", inv.creadaPor())
                .bind("enviadaEn", utc(inv.enviadaEn()))
                .bind("expiraEn", utc(inv.expiraEn()))
                .then()
                .thenReturn(inv);
    }

    @Override
    public Flux<Invitacion> pendientesVigentes(UUID hogarId, Instant ahora) {
        return db.sql("SELECT " + COLUMNAS + " FROM invitacion WHERE hogar_id = :hogar AND estado = 'PENDIENTE' "
                        + "AND expira_en > :ahora ORDER BY enviada_en")
                .bind("hogar", hogarId)
                .bind("ahora", utc(ahora))
                .map(InvitacionR2dbcAdapter::invitacion)
                .all();
    }

    @Override
    public Mono<Invitacion> pendientePorEmail(UUID hogarId, String email) {
        return db.sql("SELECT " + COLUMNAS + " FROM invitacion WHERE hogar_id = :hogar AND estado = 'PENDIENTE' "
                        + "AND lower(email) = lower(:email)")
                .bind("hogar", hogarId)
                .bind("email", email)
                .map(InvitacionR2dbcAdapter::invitacion)
                .one();
    }

    @Override
    public Mono<Invitacion> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM invitacion WHERE id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(InvitacionR2dbcAdapter::invitacion)
                .one();
    }

    @Override
    public Mono<Invitacion> porTokenHash(String tokenHash) {
        return db.sql("SELECT " + COLUMNAS + " FROM invitacion WHERE token_hash = :hash")
                .bind("hash", tokenHash)
                .map(InvitacionR2dbcAdapter::invitacion)
                .one();
    }

    @Override
    public Flux<Invitacion> pendientesParaEmail(String email, Instant ahora) {
        return db.sql("SELECT " + COLUMNAS + " FROM invitacion WHERE lower(email) = lower(:email) AND estado = 'PENDIENTE' "
                        + "AND expira_en > :ahora ORDER BY enviada_en DESC")
                .bind("email", email)
                .bind("ahora", utc(ahora))
                .map(InvitacionR2dbcAdapter::invitacion)
                .all();
    }

    @Override
    public Mono<Invitacion> porId(UUID id) {
        return db.sql("SELECT " + COLUMNAS + " FROM invitacion WHERE id = :id")
                .bind("id", id)
                .map(InvitacionR2dbcAdapter::invitacion)
                .one();
    }

    @Override
    public Mono<Invitacion> rotar(UUID id, UUID hogarId, String tokenHash, Instant enviadaEn, Instant expiraEn) {
        return db.sql("UPDATE invitacion SET token_hash = :hash, enviada_en = :enviadaEn, expira_en = :expiraEn "
                        + "WHERE id = :id AND hogar_id = :hogar AND estado = 'PENDIENTE'")
                .bind("id", id)
                .bind("hogar", hogarId)
                .bind("hash", tokenHash)
                .bind("enviadaEn", utc(enviadaEn))
                .bind("expiraEn", utc(expiraEn))
                .then()
                .then(porIdEnHogar(id, hogarId));
    }

    @Override
    public Mono<Boolean> marcarAceptada(UUID id, UUID usuarioId, Instant ahora) {
        return db.sql("UPDATE invitacion SET estado = 'ACEPTADA', aceptada_por = :usuario, aceptada_en = :ahora "
                        + "WHERE id = :id AND estado = 'PENDIENTE'")
                .bind("id", id)
                .bind("usuario", usuarioId)
                .bind("ahora", utc(ahora))
                .fetch().rowsUpdated()
                .map(filas -> filas == 1);
    }

    private static Invitacion invitacion(Readable row) {
        return new Invitacion(row.get("id", UUID.class), row.get("hogar_id", UUID.class), row.get("email", String.class),
                Invitacion.Estado.valueOf(row.get("estado", String.class)), row.get("creada_por", UUID.class),
                row.get("enviada_en", OffsetDateTime.class).toInstant(), row.get("expira_en", OffsetDateTime.class).toInstant());
    }

    private static OffsetDateTime utc(Instant instante) {
        return OffsetDateTime.ofInstant(instante, ZoneOffset.UTC);
    }
}
