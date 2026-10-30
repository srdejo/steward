package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.EstadoHogar;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Miembro;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Hogares y miembros con SQL explicito (design D3). "Un hogar por usuario" lo garantiza el UNIQUE de
 * {@code miembro.usuario_id}: su violacion se traduce a {@code YA_TIENE_HOGAR}. Las escrituras de varias filas corren
 * dentro de la transaccion que abre el caso de uso.
 */
public class HogarR2dbcAdapter implements IHogarPersistencePort {

    private final DatabaseClient db;

    public HogarR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<EstadoHogar> estadoDe(UUID usuarioId) {
        return hogarDe(usuarioId)
                .map(hogar -> new EstadoHogar(true, hogar.configurado()))
                .defaultIfEmpty(EstadoHogar.SIN_HOGAR);
    }

    @Override
    public Mono<Hogar> hogarDe(UUID usuarioId) {
        return db.sql("SELECT h.id, h.nombre, h.configurado FROM miembro m JOIN hogar h ON h.id = m.hogar_id "
                        + "WHERE m.usuario_id = :usuario")
                .bind("usuario", usuarioId)
                .map(row -> new Hogar(row.get("id", UUID.class), row.get("nombre", String.class),
                        Boolean.TRUE.equals(row.get("configurado", Boolean.class))))
                .one();
    }

    @Override
    public Mono<Hogar> porId(UUID hogarId) {
        return db.sql("SELECT id, nombre, configurado FROM hogar WHERE id = :id")
                .bind("id", hogarId)
                .map(row -> new Hogar(row.get("id", UUID.class), row.get("nombre", String.class),
                        Boolean.TRUE.equals(row.get("configurado", Boolean.class))))
                .one();
    }

    @Override
    public Mono<Hogar> crear(Hogar hogar, UUID usuarioId, LocalDate unidoEn) {
        return db.sql("INSERT INTO hogar (id, nombre, configurado) VALUES (:id, :nombre, false)")
                .bind("id", hogar.id())
                .bind("nombre", hogar.nombre())
                .then()
                .then(unir(hogar.id(), usuarioId, unidoEn))
                .thenReturn(hogar);
    }

    @Override
    public Mono<Void> renombrar(UUID hogarId, String nombre) {
        return db.sql("UPDATE hogar SET nombre = :nombre WHERE id = :id")
                .bind("id", hogarId)
                .bind("nombre", nombre)
                .then();
    }

    @Override
    public Mono<Void> marcarConfigurado(UUID hogarId) {
        return db.sql("UPDATE hogar SET configurado = true WHERE id = :id").bind("id", hogarId).then();
    }

    @Override
    public Flux<Miembro> miembros(UUID hogarId) {
        return db.sql("SELECT u.id, u.email, u.nombre, u.creado_en, m.unido_en FROM miembro m "
                        + "JOIN usuario u ON u.id = m.usuario_id WHERE m.hogar_id = :hogar ORDER BY m.unido_en, u.creado_en")
                .bind("hogar", hogarId)
                .map(row -> new Miembro(UsuarioR2dbcAdapter.usuario(row), row.get("unido_en", LocalDate.class)))
                .all();
    }

    @Override
    public Mono<Boolean> tieneMiembroConEmail(UUID hogarId, String email) {
        return db.sql("SELECT 1 FROM miembro m JOIN usuario u ON u.id = m.usuario_id "
                        + "WHERE m.hogar_id = :hogar AND lower(u.email) = lower(:email)")
                .bind("hogar", hogarId)
                .bind("email", email)
                .map(row -> true)
                .one()
                .defaultIfEmpty(false);
    }

    @Override
    public Mono<Void> unir(UUID hogarId, UUID usuarioId, LocalDate unidoEn) {
        return db.sql("INSERT INTO miembro (hogar_id, usuario_id, unido_en) VALUES (:hogar, :usuario, :unidoEn)")
                .bind("hogar", hogarId)
                .bind("usuario", usuarioId)
                .bind("unidoEn", unidoEn)
                .then()
                .onErrorMap(DataIntegrityViolationException.class, ex -> DomainException.conflicto("YA_TIENE_HOGAR",
                        "Ya perteneces a un hogar. Sal de él para crear otro o unirte a este."));
    }

    @Override
    public Mono<Void> salir(UUID hogarId, UUID usuarioId) {
        return db.sql("DELETE FROM miembro WHERE hogar_id = :hogar AND usuario_id = :usuario")
                .bind("hogar", hogarId)
                .bind("usuario", usuarioId)
                .then()
                // Si era el ultimo, el hogar se borra; sus invitaciones caen por ON DELETE CASCADE.
                .then(db.sql("DELETE FROM hogar h WHERE h.id = :hogar "
                                + "AND NOT EXISTS (SELECT 1 FROM miembro m WHERE m.hogar_id = h.id)")
                        .bind("hogar", hogarId)
                        .then());
    }
}
