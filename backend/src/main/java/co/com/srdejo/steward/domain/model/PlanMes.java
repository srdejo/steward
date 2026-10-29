package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * El plan de un mes del hogar con sus opciones (escenarios), como {@code PlanMes} del dominio compartido. En la Etapa 4
 * solo existe la Opcion A.
 *
 * @param escenarioActivoId la opcion elegida ("Usar esta"); en un mes ACTIVO es la que se ejecuta.
 */
public record PlanMes(UUID id, UUID hogarId, YearMonth ref, Estado estado, UUID escenarioActivoId,
                      List<Escenario> escenarios) {

    public enum Estado {
        BORRADOR,
        ACTIVO,
        CERRADO
    }

    public PlanMes {
        escenarios = escenarios == null ? List.of() : List.copyOf(escenarios);
    }

    /** {@code estadoEfectivo} del dominio: un Borrador con opcion elegida pasa a Activo cuando llega su mes. */
    public Estado estadoEn(LocalDate hoy) {
        if (estado == Estado.BORRADOR && escenarioActivoId != null && !ref.isAfter(YearMonth.from(hoy))) {
            return Estado.ACTIVO;
        }
        return estado;
    }

    /** {@code escenarioPrincipal} del dominio: la elegida, o la primera vigente por letra. */
    public Escenario principal() {
        return escenarios.stream().filter(e -> e.id().equals(escenarioActivoId)).findFirst()
                .orElseGet(() -> escenarios.stream().filter(e -> !e.archivado())
                        .min(Comparator.comparing(Escenario::letra)).orElse(null));
    }

    public PlanMes conEscenarios(List<Escenario> nuevos) {
        return new PlanMes(id, hogarId, ref, estado, escenarioActivoId, nuevos);
    }

    public record Escenario(UUID id, UUID planId, String letra, UUID creadoPor, String nota, boolean archivado,
                            List<ItemPlan> items) {

        public Escenario {
            items = items == null ? List.of() : List.copyOf(items);
        }

        public Escenario conItems(List<ItemPlan> nuevos) {
            return new Escenario(id, planId, letra, creadoPor, nota, archivado, nuevos);
        }
    }

    /**
     * Un gasto planeado de una opcion.
     *
     * @param cuotaActual compras a cuotas: cuota actual y total ("cuota 4 de 12"); los dos null si no aplica.
     */
    public record ItemPlan(UUID id, UUID escenarioId, UUID categoriaId, String nombre, long monto, Integer diaVence,
                           Tipo tipo, Integer cuotaActual, Integer cuotaTotal, int orden) {

        public static final int NOMBRE_MAX = 60;

        public enum Tipo {
            FIJO,
            VARIABLE,
            CUOTA,
            CREDITO
        }
    }
}
