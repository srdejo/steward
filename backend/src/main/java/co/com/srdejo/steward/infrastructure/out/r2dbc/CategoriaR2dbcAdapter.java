package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.UUID;

/** Categorias con SQL explicito; el indice {@code categoria_nombre_uq} garantiza {@code DUPLICADA}. */
public class CategoriaR2dbcAdapter implements ICategoriaPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, nombre, color, orden, tipo, sistema";

    private final DatabaseClient db;

    public CategoriaR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Void> crearTodas(List<Categoria> categorias) {
        return Flux.fromIterable(categorias).concatMap(this::crear).then();
    }

    @Override
    public Mono<Categoria> crear(Categoria c) {
        return db.sql("INSERT INTO categoria (" + COLUMNAS + ") VALUES (:id, :hogar, :nombre, :color, :orden, :tipo, :sistema)")
                .bind("id", c.id())
                .bind("hogar", c.hogarId())
                .bind("nombre", c.nombre())
                .bind("color", c.color())
                .bind("orden", (short) c.orden())
                .bind("tipo", c.tipo().name())
                .bind("sistema", c.sistema())
                .then()
                .onErrorMap(ex -> Sql.violo(ex, "categoria_nombre_uq"), ex -> duplicada())
                .thenReturn(c);
    }

    @Override
    public Mono<Categoria> renombrar(Categoria c, String nombre) {
        return db.sql("UPDATE categoria SET nombre = :nombre WHERE id = :id AND hogar_id = :hogar")
                .bind("id", c.id())
                .bind("hogar", c.hogarId())
                .bind("nombre", nombre)
                .then()
                .onErrorMap(ex -> Sql.violo(ex, "categoria_nombre_uq"), ex -> duplicada())
                .thenReturn(new Categoria(c.id(), c.hogarId(), nombre, c.color(), c.orden(), c.tipo(), c.sistema()));
    }

    @Override
    public Mono<Categoria> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM categoria WHERE id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(CategoriaR2dbcAdapter::categoria)
                .one();
    }

    @Override
    public Flux<Categoria> delHogar(UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM categoria WHERE hogar_id = :hogar ORDER BY orden, nombre")
                .bind("hogar", hogarId)
                .map(CategoriaR2dbcAdapter::categoria)
                .all();
    }

    static DomainException duplicada() {
        return DomainException.conflicto("DUPLICADA", "Ya existe esa categoría");
    }

    private static Categoria categoria(Readable row) {
        return new Categoria(row.get("id", UUID.class), row.get("hogar_id", UUID.class), row.get("nombre", String.class),
                row.get("color", String.class), row.get("orden", Short.class), Categoria.Tipo.valueOf(row.get("tipo", String.class)),
                Boolean.TRUE.equals(row.get("sistema", Boolean.class)));
    }
}
