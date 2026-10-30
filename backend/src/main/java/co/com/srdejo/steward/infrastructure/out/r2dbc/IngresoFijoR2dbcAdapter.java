package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/** Ingresos fijos con SQL explicito; las busquedas por id filtran por hogar. */
public class IngresoFijoR2dbcAdapter implements IIngresoFijoPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, usuario_id, nombre, bruto, neto, dia_pago, cuenta_id, activo";

    private final DatabaseClient db;

    public IngresoFijoR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<IngresoFijo> crear(IngresoFijo ingreso) {
        var spec = db.sql("INSERT INTO ingreso_fijo (" + COLUMNAS + ") "
                        + "VALUES (:id, :hogar, :usuario, :nombre, :bruto, :neto, :dia, :cuenta, :activo)")
                .bind("id", ingreso.id())
                .bind("hogar", ingreso.hogarId())
                .bind("usuario", ingreso.usuarioId());
        return valores(spec, ingreso).then().thenReturn(ingreso);
    }

    @Override
    public Mono<IngresoFijo> actualizar(IngresoFijo ingreso) {
        var spec = db.sql("UPDATE ingreso_fijo SET nombre = :nombre, bruto = :bruto, neto = :neto, dia_pago = :dia, "
                        + "cuenta_id = :cuenta, activo = :activo WHERE id = :id AND hogar_id = :hogar")
                .bind("id", ingreso.id())
                .bind("hogar", ingreso.hogarId());
        return valores(spec, ingreso).then().thenReturn(ingreso);
    }

    private static DatabaseClient.GenericExecuteSpec valores(DatabaseClient.GenericExecuteSpec spec, IngresoFijo ingreso) {
        DatabaseClient.GenericExecuteSpec conValores = spec.bind("nombre", ingreso.nombre())
                .bind("bruto", ingreso.bruto())
                .bind("neto", ingreso.neto())
                .bind("dia", (short) ingreso.diaPago())
                .bind("activo", ingreso.activo());
        return Sql.opcional(conValores, "cuenta", ingreso.cuentaId(), UUID.class);
    }

    @Override
    public Mono<IngresoFijo> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM ingreso_fijo WHERE id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(IngresoFijoR2dbcAdapter::ingreso)
                .one();
    }

    @Override
    public Flux<IngresoFijo> delHogar(UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM ingreso_fijo WHERE hogar_id = :hogar ORDER BY nombre, id")
                .bind("hogar", hogarId)
                .map(IngresoFijoR2dbcAdapter::ingreso)
                .all();
    }

    @Override
    public Mono<Void> desactivarDe(UUID hogarId, UUID usuarioId) {
        return db.sql("UPDATE ingreso_fijo SET activo = false WHERE hogar_id = :hogar AND usuario_id = :usuario")
                .bind("hogar", hogarId)
                .bind("usuario", usuarioId)
                .then();
    }

    static IngresoFijo ingreso(Readable row) {
        return new IngresoFijo(row.get("id", UUID.class), row.get("hogar_id", UUID.class), row.get("usuario_id", UUID.class),
                row.get("nombre", String.class), row.get("bruto", Long.class), row.get("neto", Long.class),
                row.get("dia_pago", Short.class), row.get("cuenta_id", UUID.class),
                Boolean.TRUE.equals(row.get("activo", Boolean.class)));
    }
}
