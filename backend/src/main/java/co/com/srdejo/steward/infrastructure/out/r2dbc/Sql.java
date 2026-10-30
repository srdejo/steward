package co.com.srdejo.steward.infrastructure.out.r2dbc;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.r2dbc.core.DatabaseClient.GenericExecuteSpec;

/** Ayudas comunes de los adaptadores: valores que pueden ser null y violaciones de un indice por nombre. */
final class Sql {

    private Sql() {
    }

    /** {@code bind} no acepta null: los opcionales van con su tipo. */
    static <T> GenericExecuteSpec opcional(GenericExecuteSpec spec, String nombre, T valor, Class<T> tipo) {
        return valor == null ? spec.bindNull(nombre, tipo) : spec.bind(nombre, valor);
    }

    /** Si la violacion es la de ese indice o restriccion (Postgres pone su nombre en el mensaje). */
    static boolean violo(Throwable ex, String restriccion) {
        if (!(ex instanceof DataIntegrityViolationException)) {
            return false;
        }
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t.getMessage() != null && t.getMessage().contains(restriccion)) {
                return true;
            }
        }
        return false;
    }
}
