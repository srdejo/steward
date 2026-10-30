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
        return db.sql("SELECT " + COLUMNAS + " FROM usuario WHERE id = :id")
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

    static Usuario usuario(Readable row) {
        OffsetDateTime creado = row.get("creado_en", OffsetDateTime.class);
        return new Usuario(row.get("id", UUID.class), row.get("email", String.class), row.get("nombre", String.class),
                creado == null ? Instant.EPOCH : creado.toInstant());
    }
}
