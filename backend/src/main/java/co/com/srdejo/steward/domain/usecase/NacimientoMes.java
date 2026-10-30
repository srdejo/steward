package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Con que nace la opcion de un mes nuevo (design D2 y D8 de diezmo-como-gasto), como {@code ingresosNuevos} y
 * {@code diezmosDelMes} del dominio compartido: una linea por ingreso fijo activo y por evento de ingreso del anual, y un
 * item de diezmo por ingreso fijo con regla activa, por evento de ingreso con un miembro con regla activa y por aporte del
 * mes con "Aplicar diezmo" que no tenga item.
 */
final class NacimientoMes {

    static final BigDecimal DIEZMO_SIN_REGLA = BigDecimal.TEN;

    private final IIngresoFijoPersistencePort ingresos;
    private final IReglaDiezmoPersistencePort reglas;
    private final IAnualPersistencePort anuales;
    private final IMovimientoPersistencePort movimientos;

    NacimientoMes(IIngresoFijoPersistencePort ingresos, IReglaDiezmoPersistencePort reglas, IAnualPersistencePort anuales,
                  IMovimientoPersistencePort movimientos) {
        this.ingresos = ingresos;
        this.reglas = reglas;
        this.anuales = anuales;
        this.movimientos = movimientos;
    }

    /** Lo que se lee para que nazca un mes. */
    record Fuentes(List<IngresoFijo> fijos, List<PlanAnual.Evento> eventos, List<Movimiento> aportes,
                   Map<UUID, ReglaDiezmo> reglas) {
    }

    Mono<Fuentes> fuentes(UUID hogarId, YearMonth ref) {
        return Mono.zip(
                        ingresos.delHogar(hogarId).filter(IngresoFijo::activo).collectList(),
                        anuales.deAnio(hogarId, ref.getYear())
                                .map(a -> a.eventos().stream()
                                        .filter(e -> e.tipo() == PlanAnual.Evento.Tipo.INGRESO && e.mes() == ref.getMonthValue())
                                        .toList())
                                .defaultIfEmpty(List.of()),
                        movimientos.delMes(hogarId, ref)
                                .filter(m -> m.tipo() == Movimiento.Tipo.APORTE && m.aplicaDiezmo())
                                .collectList())
                .flatMap(t -> {
                    Set<UUID> personas = new HashSet<>();
                    t.getT1().forEach(f -> personas.add(f.usuarioId()));
                    t.getT2().stream().filter(e -> e.usuarioId() != null).forEach(e -> personas.add(e.usuarioId()));
                    t.getT3().forEach(m -> personas.add(m.usuarioId()));
                    return reglas.dePersonas(personas).collectMap(ReglaDiezmo::usuarioId)
                            .map(r -> new Fuentes(t.getT1(), t.getT2(), t.getT3(), r));
                });
    }

    /** Las lineas FIJO y EXTRA de una opcion nueva; las OTRO las copia quien crea el mes. */
    static List<IngresoPlan> lineas(UUID escenarioId, Fuentes f) {
        List<IngresoPlan> lineas = new ArrayList<>();
        for (IngresoFijo i : f.fijos()) {
            lineas.add(new IngresoPlan(UUID.randomUUID(), escenarioId, i.nombre(), i.neto(), i.usuarioId(),
                    IngresoPlan.Tipo.FIJO, i.id(), lineas.size() + 1));
        }
        for (PlanAnual.Evento e : f.eventos()) {
            lineas.add(new IngresoPlan(UUID.randomUUID(), escenarioId, e.nombre(), e.monto(), e.usuarioId(),
                    IngresoPlan.Tipo.EXTRA, null, lineas.size() + 1));
        }
        return lineas;
    }

    /** Los items de diezmo de una opcion nueva, despues de {@code items} (los aportes que ya tienen item no repiten). */
    static List<ItemPlan> diezmos(UUID escenarioId, UUID categoriaDiezmo, Fuentes f, List<ItemPlan> items) {
        int orden = items.stream().mapToInt(ItemPlan::orden).max().orElse(0);
        List<ItemPlan> nuevos = new ArrayList<>();
        for (IngresoFijo i : f.fijos()) {
            ReglaDiezmo r = activa(f.reglas().get(i.usuarioId()));
            if (r != null) {
                nuevos.add(new ItemPlan(UUID.randomUUID(), escenarioId, categoriaDiezmo, "Diezmo · " + i.nombre(),
                        CalculoDiezmo.monto(r.porcentaje(), i.bruto(), i.neto(), r.base()), i.diaPago(), ItemPlan.Tipo.DIEZMO,
                        null, null, ++orden, null, i.id(), null));
            }
        }
        for (PlanAnual.Evento e : f.eventos()) {
            ReglaDiezmo r = e.usuarioId() == null ? null : activa(f.reglas().get(e.usuarioId()));
            if (r != null) {
                nuevos.add(new ItemPlan(UUID.randomUUID(), escenarioId, categoriaDiezmo, "Diezmo · " + e.nombre(),
                        CalculoDiezmo.sobre(r.porcentaje(), e.monto()), null, ItemPlan.Tipo.DIEZMO, null, null, ++orden, null,
                        null, null));
            }
        }
        Set<UUID> conItem = new HashSet<>();
        items.stream().filter(i -> i.aporteId() != null).forEach(i -> conItem.add(i.aporteId()));
        for (Movimiento m : f.aportes()) {
            if (!conItem.contains(m.id())) {
                nuevos.add(deAporte(escenarioId, categoriaDiezmo, m, f.reglas().get(m.usuarioId()), ++orden));
            }
        }
        return nuevos;
    }

    /** "Diezmo · aporte {dd mmm}": el porcentaje de la regla de quien aporto (activa o no; 10 % si no tiene). */
    static ItemPlan deAporte(UUID escenarioId, UUID categoriaDiezmo, Movimiento aporte, ReglaDiezmo regla, int orden) {
        BigDecimal porcentaje = regla == null ? DIEZMO_SIN_REGLA : regla.porcentaje();
        return new ItemPlan(UUID.randomUUID(), escenarioId, categoriaDiezmo, "Diezmo · aporte " + Formato.fechaCorta(aporte.fecha()),
                CalculoDiezmo.sobre(porcentaje, aporte.monto()), null, ItemPlan.Tipo.DIEZMO, null, null, orden, null, null,
                aporte.id());
    }

    /** La categoria del sistema "Diezmo" del hogar. */
    static UUID categoriaDiezmo(List<Categoria> cats) {
        return cats.stream().filter(c -> c.tipo() == Categoria.Tipo.DIEZMO).map(Categoria::id).findFirst()
                .orElseThrow(() -> DomainException.noEncontrado("CATEGORIA_NO_ENCONTRADA", "El hogar no tiene la categoría Diezmo"));
    }

    private static ReglaDiezmo activa(ReglaDiezmo r) {
        return r != null && r.activa() ? r : null;
    }
}
