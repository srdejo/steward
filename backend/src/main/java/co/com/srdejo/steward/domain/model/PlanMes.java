package co.com.srdejo.steward.domain.model;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * El plan de un mes del hogar con sus opciones (escenarios), como {@code PlanMes} del dominio compartido.
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

    /** Una opcion del mes con sus lineas de ingreso (design D8 de diezmo-como-gasto) y sus items. */
    public record Escenario(UUID id, UUID planId, String letra, UUID creadoPor, String nota, boolean archivado,
                            List<IngresoPlan> ingresos, List<ItemPlan> items) {

        public Escenario {
            ingresos = ingresos == null ? List.of() : List.copyOf(ingresos);
            items = items == null ? List.of() : List.copyOf(items);
        }

        public Escenario conItems(List<ItemPlan> nuevos) {
            return new Escenario(id, planId, letra, creadoPor, nota, archivado, ingresos, nuevos);
        }

        public Escenario conIngresos(List<IngresoPlan> nuevos) {
            return new Escenario(id, planId, letra, creadoPor, nota, archivado, nuevos, items);
        }
    }

    /**
     * Una linea de ingreso de una opcion, como {@code IngresoPlan} del dominio: FIJO sale de un ingreso fijo (enlazado),
     * EXTRA de un evento de ingreso del plan anual y OTRO se agrego a mano.
     */
    public record IngresoPlan(UUID id, UUID escenarioId, String nombre, long monto, UUID usuarioId, Tipo tipo,
                              UUID ingresoFijoId, int orden) {

        public static final int NOMBRE_MAX = 60;

        public enum Tipo {
            FIJO,
            EXTRA,
            OTRO
        }
    }

    /**
     * Un gasto planeado de una opcion.
     *
     * @param cuotaActual   compras a cuotas: cuota actual y total ("cuota 4 de 12"); los dos null si no aplica.
     * @param ingresoFijoId DIEZMO: el ingreso fijo que lo origina (design D1 de diezmo-como-gasto).
     * @param aporteId      DIEZMO: el movimiento APORTE que lo origina; excluyente con {@code ingresoFijoId}.
     */
    public record ItemPlan(UUID id, UUID escenarioId, UUID categoriaId, String nombre, long monto, Integer diaVence,
                           Tipo tipo, Integer cuotaActual, Integer cuotaTotal, int orden, UUID creditoId,
                           UUID ingresoFijoId, UUID aporteId) {

        public static final int NOMBRE_MAX = 60;

        /** Sin enlace de diezmo. */
        public ItemPlan(UUID id, UUID escenarioId, UUID categoriaId, String nombre, long monto, Integer diaVence,
                        Tipo tipo, Integer cuotaActual, Integer cuotaTotal, int orden, UUID creditoId) {
            this(id, escenarioId, categoriaId, nombre, monto, diaVence, tipo, cuotaActual, cuotaTotal, orden, creditoId,
                    null, null);
        }

        /** Sin credito ni enlace de diezmo. */
        public ItemPlan(UUID id, UUID escenarioId, UUID categoriaId, String nombre, long monto, Integer diaVence,
                        Tipo tipo, Integer cuotaActual, Integer cuotaTotal, int orden) {
            this(id, escenarioId, categoriaId, nombre, monto, diaVence, tipo, cuotaActual, cuotaTotal, orden, null);
        }

        /** El mismo item en otra opcion (o con otro monto o cuota), con sus enlaces. */
        public ItemPlan copia(UUID nuevoId, UUID otroEscenario, long otroMonto, Integer otraCuota, int otroOrden) {
            return new ItemPlan(nuevoId, otroEscenario, categoriaId, nombre, otroMonto, diaVence, tipo, otraCuota, cuotaTotal,
                    otroOrden, creditoId, ingresoFijoId, aporteId);
        }

        public enum Tipo {
            FIJO,
            VARIABLE,
            CUOTA,
            CREDITO,
            DIEZMO
        }
    }
}
