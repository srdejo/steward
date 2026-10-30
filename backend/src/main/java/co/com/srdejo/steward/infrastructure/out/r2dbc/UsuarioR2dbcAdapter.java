package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Usuarios con SQL explicito (design D3). El correo es unico por {@code lower(email)}. */
public class UsuarioR2dbcAdapter implements IUsuarioPersistencePort {

    private static final String COLUMNAS = "id, email, nombre, creado_en";

    private final DatabaseClient db;

    public UsuarioR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Usuario> porId(UUID id) {
        // Una cuenta eliminada ya no existe para nadie: su fila solo sostiene los registros de un hogar compartido.
        return db.sql("SELECT " + COLUMNAS + " FROM usuario WHERE id = :id AND eliminado_en IS NULL")
                .bind("id", id)
                .map(UsuarioR2dbcAdapter::usuario)
                .one();
    }

    @Override
    public Mono<Usuario> porEmail(String email) {
        return db.sql("SELECT " + COLUMNAS + " FROM usuario WHERE lower(email) = lower(:email)")
                .bind("email", email)
                .map(UsuarioR2dbcAdapter::usuario)
                .one();
    }

    @Override
    public Mono<Usuario> crearOObtener(Usuario usuario) {
        // ON CONFLICT con el indice unico de lower(email): dos logins simultaneos del mismo correo no fallan.
        return db.sql("INSERT INTO usuario (id, email, nombre, creado_en) VALUES (:id, :email, :nombre, :creadoEn) "
                        + "ON CONFLICT (lower(email)) DO NOTHING")
                .bind("id", usuario.id())
                .bind("email", usuario.email())
                .bind("nombre", usuario.nombre())
                .bind("creadoEn", OffsetDateTime.ofInstant(usuario.creadoEn(), java.time.ZoneOffset.UTC))
                .fetch().rowsUpdated()
                .then(porEmail(usuario.email()));
    }

    @Override
    public Mono<Usuario> actualizarNombre(UUID id, String nombre) {
        return db.sql("UPDATE usuario SET nombre = :nombre WHERE id = :id")
                .bind("id", id)
                .bind("nombre", nombre)
                .fetch().rowsUpdated()
                .then(porId(id));
    }

    @Override
    public Mono<Usuario> porAppleSub(String sub) {
        return db.sql("SELECT " + COLUMNAS + " FROM usuario WHERE apple_sub = :sub")
                .bind("sub", sub)
                .map(UsuarioR2dbcAdapter::usuario)
                .one();
    }

    @Override
    public Mono<Usuario> enlazarApple(UUID id, String sub) {
        return db.sql("UPDATE usuario SET apple_sub = :sub WHERE id = :id")
                .bind("id", id)
                .bind("sub", sub)
                .fetch().rowsUpdated()
                .then(porId(id));
    }

    @Override
    public Mono<Void> eliminar(UUID id) {
        return reactor.core.publisher.Flux.just(
                        "DELETE FROM regla_diezmo WHERE usuario_id = :id",
                        "DELETE FROM proyeccion_aporte WHERE usuario_id = :id",
                        "DELETE FROM invitacion WHERE creada_por = :id AND aceptada_por IS NULL",
                        "DELETE FROM usuario u WHERE u.id = :id "
                                + "AND NOT EXISTS (SELECT 1 FROM invitacion WHERE creada_por = u.id OR aceptada_por = u.id) "
                                + "AND NOT EXISTS (SELECT 1 FROM cuenta WHERE titular_id = u.id) "
                                + "AND NOT EXISTS (SELECT 1 FROM ingreso_fijo WHERE usuario_id = u.id) "
                                + "AND NOT EXISTS (SELECT 1 FROM movimiento WHERE usuario_id = u.id OR creado_por = u.id) "
                                + "AND NOT EXISTS (SELECT 1 FROM escenario WHERE creado_por = u.id) "
                                + "AND NOT EXISTS (SELECT 1 FROM cierre_mes WHERE cerrado_por = u.id)",
                        // Si la fila sigue, otros la necesitan: queda sin datos personales.
                        "UPDATE usuario SET email = 'eliminado-' || id || '@cuenta.invalid', nombre = 'Ex miembro', apple_sub = NULL, "
                                + "eliminado_en = now() WHERE id = :id")
                .concatMap(sql -> db.sql(sql).bind("id", id).then())
                .then();
    }

    static Usuario usuario(Readable row) {
        OffsetDateTime creado = row.get("creado_en", OffsetDateTime.class);
        return new Usuario(row.get("id", UUID.class), row.get("email", String.class), row.get("nombre", String.class),
                creado == null ? Instant.EPOCH : creado.toInstant());
    }
}
