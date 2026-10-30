package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Con que nace la opcion de un mes nuevo (design D2 y D8 de diezmo-como-gasto), como {@code ingresosNuevos} y
 * {@code diezmosDelMes} del dominio compartido: una linea por ingreso fijo activo y por evento de ingreso del anual, y un
 * item de diezmo por linea de un ingreso fijo o de un evento cuya persona tiene regla activa, enlazado a su linea, y por
 * aporte del mes con "Aplicar diezmo" que no tenga item. Tambien, como {@code seguirLinea}, el diezmo que sigue a su linea
 * cuando esta cambia (design D1 de usabilidad-plan).
 */
final class NacimientoMes {

    static final BigDecimal DIEZMO_SIN_REGLA = BigDecimal.TEN;

    private final IIngresoFijoPersistencePort ingresos;
    private final IReglaDiezmoPersistencePort reglas;
    private final IAnualPersistencePort anuales;
    private final IMovimientoPersistencePort movimientos;
    private final IPlanPersistencePort planes;

    NacimientoMes(IIngresoFijoPersistencePort ingresos, IReglaDiezmoPersistencePort reglas, IAnualPersistencePort anuales,
                  IMovimientoPersistencePort movimientos, IPlanPersistencePort planes) {
        this.ingresos = ingresos;
        this.reglas = reglas;
        this.anuales = anuales;
        this.movimientos = movimientos;
        this.planes = planes;
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

    /** Las lineas FIJO y EXTRA de una opcion nueva, con su bruto; las OTRO las copia quien crea el mes. */
    static List<IngresoPlan> lineas(UUID escenarioId, Fuentes f) {
        List<IngresoPlan> lineas = new ArrayList<>();
        for (IngresoFijo i : f.fijos()) {
            lineas.add(new IngresoPlan(UUID.randomUUID(), escenarioId, i.nombre(), i.neto(), i.usuarioId(),
                    IngresoPlan.Tipo.FIJO, i.id(), i.bruto(), lineas.size() + 1));
        }
        for (PlanAnual.Evento e : f.eventos()) {
            lineas.add(new IngresoPlan(UUID.randomUUID(), escenarioId, e.nombre(), e.monto(), e.usuarioId(),
                    IngresoPlan.Tipo.EXTRA, null, e.monto(), lineas.size() + 1));
        }
        return lineas;
    }

    /**
     * Los items de diezmo de una opcion nueva, despues de {@code items}: uno por linea de un ingreso fijo o de un evento cuya
     * persona tiene regla activa, enlazado a ella, y los de los aportes que todavia no tienen item.
     */
    static List<ItemPlan> diezmos(UUID escenarioId, UUID categoriaDiezmo, Fuentes f, List<ItemPlan> items, List<IngresoPlan> lineas) {
        int orden = items.stream().mapToInt(ItemPlan::orden).max().orElse(0);
        List<ItemPlan> nuevos = new ArrayList<>();
        for (IngresoPlan l : lineas) {
            ReglaDiezmo r = l.usuarioId() == null ? null : activa(f.reglas().get(l.usuarioId()));
            if (l.tipo() == IngresoPlan.Tipo.OTRO || r == null) {
                continue;
            }
            Integer dia = f.fijos().stream().filter(i -> i.id().equals(l.ingresoFijoId())).map(IngresoFijo::diaPago).findFirst().orElse(null);
            nuevos.add(deLinea(escenarioId, categoriaDiezmo, l, r, dia, ++orden));
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

    /** {@code diezmoSugerido} del dominio: la regla activa sobre el bruto o el monto de la linea; sin regla, el 10 % del monto. */
    static long sugerido(ReglaDiezmo reglaActiva, IngresoPlan l) {
        return reglaActiva == null ? CalculoDiezmo.sobre(DIEZMO_SIN_REGLA, l.monto())
                : CalculoDiezmo.monto(reglaActiva.porcentaje(), l.bruto(), l.monto(), reglaActiva.base());
    }

    /** "Diezmo · {linea}", enlazado a la linea (y a su ingreso fijo, si lo tiene). */
    static ItemPlan deLinea(UUID escenarioId, UUID categoriaDiezmo, IngresoPlan l, ReglaDiezmo reglaActiva, Integer diaVence, int orden) {
        return new ItemPlan(UUID.randomUUID(), escenarioId, categoriaDiezmo, "Diezmo · " + l.nombre(), sugerido(reglaActiva, l), diaVence,
                ItemPlan.Tipo.DIEZMO, null, null, orden, null, l.ingresoFijoId(), null, l.id(), false);
    }

    /** "Diezmo · aporte {dd mmm}": el porcentaje de la regla de quien aporto (activa o no; 10 % si no tiene). */
    static ItemPlan deAporte(UUID escenarioId, UUID categoriaDiezmo, Movimiento aporte, ReglaDiezmo regla, int orden) {
        return new ItemPlan(UUID.randomUUID(), escenarioId, categoriaDiezmo, "Diezmo · aporte " + Formato.fechaCorta(aporte.fecha()),
                CalculoDiezmo.sobre(porcentajeAporte(regla), aporte.monto()), null, ItemPlan.Tipo.DIEZMO, null, null, orden, null, null,
                aporte.id(), null, false);
    }

    static BigDecimal porcentajeAporte(ReglaDiezmo regla) {
        return regla == null ? DIEZMO_SIN_REGLA : regla.porcentaje();
    }

    /** La categoria del sistema "Diezmo" del hogar. */
    static UUID categoriaDiezmo(List<Categoria> cats) {
        return cats.stream().filter(c -> c.tipo() == Categoria.Tipo.DIEZMO).map(Categoria::id).findFirst()
                .orElseThrow(() -> DomainException.noEncontrado("CATEGORIA_NO_ENCONTRADA", "El hogar no tiene la categoría Diezmo"));
    }

    /** La regla activa de una persona; vacia si no tiene o esta inactiva. */
    Mono<Optional<ReglaDiezmo>> reglaActiva(UUID usuarioId) {
        if (usuarioId == null) {
            return Mono.just(Optional.empty());
        }
        return reglas.dePersona(usuarioId).filter(ReglaDiezmo::activa).map(Optional::of).defaultIfEmpty(Optional.empty());
    }

    /**
     * {@code seguirLinea} del dominio: el diezmo enlazado a la linea toma el monto sugerido si no esta ajustado a mano ni tiene
     * pagos, y su nombre si seguia el de la linea.
     */
    Mono<Void> seguirLinea(Escenario esc, IngresoPlan linea, String nombreAnterior) {
        Optional<ItemPlan> item = esc.items().stream()
                .filter(i -> i.tipo() == ItemPlan.Tipo.DIEZMO && linea.id().equals(i.ingresoPlanId())).findFirst();
        if (item.isEmpty()) {
            return Mono.empty();
        }
        ItemPlan i = item.get();
        return movimientos.hayDeItem(i.id()).flatMap(conPagos -> conPagos ? Mono.<Void>empty()
                : reglaActiva(linea.usuarioId()).flatMap(r -> {
                    String nombre = i.nombre().equals("Diezmo · " + nombreAnterior) ? "Diezmo · " + linea.nombre() : i.nombre();
                    long monto = i.ajustadoAMano() ? i.monto() : sugerido(r.orElse(null), linea);
                    return planes.actualizarItem(i.conMonto(nombre, monto, i.ajustadoAMano())).then();
                }));
    }

    private static ReglaDiezmo activa(ReglaDiezmo r) {
        return r != null && r.activa() ? r : null;
    }
}
