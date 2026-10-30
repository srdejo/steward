package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Celda;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import co.com.srdejo.steward.domain.model.PlanAnual.Proyeccion;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.UUID;

/** Planes anuales con SQL explicito; el indice {@code plan_anual_uq} garantiza {@code YA_EXISTE}. */
public class AnualR2dbcAdapter implements IAnualPersistencePort {

    private final DatabaseClient db;

    public AnualR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<PlanAnual> crear(PlanAnual a) {
        return db.sql("INSERT INTO plan_anual (id, hogar_id, anio, estado) VALUES (:id, :hogar, :anio, :estado)")
                .bind("id", a.id())
                .bind("hogar", a.hogarId())
                .bind("anio", (short) a.anio())
                .bind("estado", a.estado().name())
                .then()
                .onErrorMap(ex -> Sql.violo(ex, "plan_anual_uq"),
                        ex -> DomainException.conflicto("YA_EXISTE", "Ese año ya tiene plan anual"))
                .thenReturn(a);
    }

    @Override
    public Mono<PlanAnual> deAnio(UUID hogarId, int anio) {
        return completos(db.sql("SELECT id, hogar_id, anio, estado FROM plan_anual WHERE hogar_id = :hogar AND anio = :anio")
                .bind("hogar", hogarId)
                .bind("anio", (short) anio)).next();
    }

    @Override
    public Flux<PlanAnual> desde(UUID hogarId, int anio) {
        return completos(db.sql("SELECT id, hogar_id, anio, estado FROM plan_anual WHERE hogar_id = :hogar AND anio >= :anio "
                        + "ORDER BY anio")
                .bind("hogar", hogarId)
                .bind("anio", (short) anio));
    }

    private Flux<PlanAnual> completos(DatabaseClient.GenericExecuteSpec consulta) {
        return consulta.map(AnualR2dbcAdapter::anual).all().concatMap(a -> Mono.zip(
                db.sql("SELECT categoria_id, mes, monto FROM anual_celda WHERE anual_id = :id ORDER BY categoria_id, mes")
                        .bind("id", a.id())
                        .map(r -> new Celda(r.get("categoria_id", UUID.class), r.get("mes", Short.class), r.get("monto", Long.class)))
                        .all().collectList(),
                db.sql("SELECT id, nombre, mes, monto, tipo, usuario_id FROM anual_evento WHERE anual_id = :id ORDER BY creado_en, id")
                        .bind("id", a.id())
                        .map(AnualR2dbcAdapter::evento)
                        .all().collectList())
                .map(t -> new PlanAnual(a.id(), a.hogarId(), a.anio(), a.estado(), t.getT1(), t.getT2())));
    }

    @Override
    public Mono<Void> ponerCelda(UUID anualId, UUID categoriaId, int mes, long monto) {
        return db.sql("INSERT INTO anual_celda (anual_id, categoria_id, mes, monto) VALUES (:anual, :categoria, :mes, :monto) "
                        + "ON CONFLICT (anual_id, categoria_id, mes) DO UPDATE SET monto = excluded.monto")
                .bind("anual", anualId)
                .bind("categoria", categoriaId)
                .bind("mes", (short) mes)
                .bind("monto", monto)
                .then();
    }

    @Override
    public Mono<Evento> agregarEvento(UUID anualId, Evento e) {
        var spec = db.sql("INSERT INTO anual_evento (id, anual_id, nombre, mes, monto, tipo, usuario_id) "
                        + "VALUES (:id, :anual, :nombre, :mes, :monto, :tipo, :usuario)")
                .bind("id", e.id())
                .bind("anual", anualId)
                .bind("nombre", e.nombre())
                .bind("mes", (short) e.mes())
                .bind("monto", e.monto())
                .bind("tipo", e.tipo().name());
        return Sql.opcional(spec, "usuario", e.usuarioId(), UUID.class).then().thenReturn(e);
    }

    @Override
    public Mono<Void> ponerProyeccion(UUID hogarId, Proyeccion p) {
        if (p.monto() <= 0) {
            return db.sql("DELETE FROM proyeccion_aporte WHERE hogar_id = :hogar AND usuario_id = :usuario AND anio = :anio "
                            + "AND mes = :mes")
                    .bind("hogar", hogarId)
                    .bind("usuario", p.usuarioId())
                    .bind("anio", (short) p.anio())
                    .bind("mes", (short) p.mes())
                    .then();
        }
        return db.sql("INSERT INTO proyeccion_aporte (hogar_id, usuario_id, anio, mes, monto) VALUES (:hogar, :usuario, :anio, "
                        + ":mes, :monto) ON CONFLICT (hogar_id, usuario_id, anio, mes) DO UPDATE SET monto = excluded.monto")
                .bind("hogar", hogarId)
                .bind("usuario", p.usuarioId())
                .bind("anio", (short) p.anio())
                .bind("mes", (short) p.mes())
                .bind("monto", p.monto())
                .then();
    }

    @Override
    public Flux<Proyeccion> proyeccionesDesde(UUID hogarId, int anio) {
        return db.sql("SELECT usuario_id, anio, mes, monto FROM proyeccion_aporte WHERE hogar_id = :hogar AND anio >= :anio "
                        + "ORDER BY anio, mes, usuario_id")
                .bind("hogar", hogarId)
                .bind("anio", (short) anio)
                .map(r -> new Proyeccion(r.get("usuario_id", UUID.class), r.get("anio", Short.class), r.get("mes", Short.class),
                        r.get("monto", Long.class)))
                .all();
    }

    @Override
    public Mono<Void> marcarCreado(UUID anualId) {
        return db.sql("UPDATE plan_anual SET estado = 'CREADO' WHERE id = :id").bind("id", anualId).then();
    }

    private static PlanAnual anual(Readable r) {
        return new PlanAnual(r.get("id", UUID.class), r.get("hogar_id", UUID.class), r.get("anio", Short.class),
                PlanAnual.Estado.valueOf(r.get("estado", String.class)), List.of(), List.of());
    }

    private static Evento evento(Readable r) {
        return new Evento(r.get("id", UUID.class), r.get("nombre", String.class), r.get("mes", Short.class), r.get("monto", Long.class),
                Evento.Tipo.valueOf(r.get("tipo", String.class)), r.get("usuario_id", UUID.class));
    }
}
