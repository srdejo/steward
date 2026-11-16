package co.com.srdejo.steward.domain.model;

import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * El plan anual del hogar, como {@code PlanAnual} del dominio compartido (design D2 de backend-plan-anual). Tiene una o
 * mas opciones (A, B, ...), cada una con sus celdas tocadas (las demas valen cero), sus eventos y su mes base
 * (design D1 y D2 de anual-opciones-y-meses). {@code opcionEnUso}: la que se llevo a los meses; null si ninguna. Las
 * vistas (cuadricula, KPI) las calcula el cliente.
 */
public record PlanAnual(UUID id, UUID hogarId, int anio, Estado estado, List<Opcion> opciones, UUID opcionEnUso) {

    public static final int NOMBRE_EVENTO_MAX = 60;
    public static final String LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    public PlanAnual {
        opciones = opciones == null ? List.of() : List.copyOf(opciones);
    }

    public enum Estado {
        BORRADOR,
        CREADO
    }

    /** La opcion con ese id, si es de este año. */
    public Optional<Opcion> buscar(UUID opcionId) {
        return opciones.stream().filter(o -> o.id().equals(opcionId)).findFirst();
    }

    /** La opcion pedida; sin id, la en uso o la primera ({@code opcionDe} del dominio). Vacio si el id no es de este año. */
    public Optional<Opcion> opcion(UUID opcionId) {
        if (opcionId != null) {
            return buscar(opcionId);
        }
        return Optional.ofNullable(opcionEnUso).flatMap(this::buscar).or(() -> opciones.stream().findFirst());
    }

    /** La siguiente letra libre ({@code duplicarOpcionAnual} del dominio); vacio si no caben mas. */
    public Optional<String> siguienteLetra() {
        return LETRAS.chars().mapToObj(c -> String.valueOf((char) c))
                .filter(l -> opciones.stream().noneMatch(o -> o.letra().equals(l))).findFirst();
    }

    /**
     * Una opcion del año: sus celdas tocadas, sus eventos, el mes que se replico en ella (null si se lleno a mano) y su mes
     * base editable (null si no tiene; anual-mes-base-editable).
     */
    public record Opcion(UUID id, String letra, UUID creadoPor, String nota, List<Celda> celdas, List<Evento> eventos, YearMonth base,
                         MesBase mesBase) {

        public Opcion {
            nota = nota == null ? "" : nota;
            celdas = celdas == null ? List.of() : List.copyOf(celdas);
            eventos = eventos == null ? List.of() : List.copyOf(eventos);
        }

        public Opcion(UUID id, String letra, UUID creadoPor, String nota, List<Celda> celdas, List<Evento> eventos, YearMonth base) {
            this(id, letra, creadoPor, nota, celdas, eventos, base, null);
        }
    }

    /**
     * Los gastos que valen igual todos los meses en una opcion, copiados de {@code origen} (null: desde cero) y editados a
     * mano. Sus items llevan como {@code escenarioId} el id de la opcion.
     */
    public record MesBase(YearMonth origen, List<PlanMes.ItemPlan> items) {

        public MesBase {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    public record Celda(UUID categoriaId, int mes, long monto) {
    }

    /**
     * {@code usuarioId}: en un ingreso extra, la persona cuya regla de diezmo hereda. {@code categoriaId}: en un gasto, su
     * categoria (null: "Eventos del año"). {@code enAdelante}: se repite de su mes a diciembre (design D3 de
     * planear-anio-desde-un-mes).
     */
    public record Evento(UUID id, String nombre, int mes, long monto, Tipo tipo, UUID usuarioId, UUID categoriaId, boolean enAdelante) {

        public Evento(UUID id, String nombre, int mes, long monto, Tipo tipo, UUID usuarioId) {
            this(id, nombre, mes, monto, tipo, usuarioId, null, false);
        }

        /** Si el evento toca el mes: el suyo, o uno posterior si es "en adelante" ({@code eventosDelMes} del dominio). */
        public boolean aplica(int mesDelAnio) {
            return mes == mesDelAnio || (enAdelante && mes < mesDelAnio);
        }

        public enum Tipo {
            INGRESO,
            GASTO
        }
    }

    /** El aporte que una persona espera hacer en un mes. */
    public record Proyeccion(UUID usuarioId, int anio, int mes, long monto) {
    }
}
