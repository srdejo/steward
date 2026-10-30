package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IPlanServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICierrePersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Categorias y plan del mes (spec steward-plan-mes). Reproduce {@code guardarCategoria}, {@code crearMes},
 * {@code guardarItem}, {@code quitarItem}, {@code guardarIngresoPlan}, {@code quitarIngresoPlan} y {@code usarEscenario} del
 * dominio compartido. Todo se resuelve desde el hogar de la sesion. Los creditos con saldo traen su cuota a cada mes nuevo
 * (design D5 de backend-cuentas-creditos), y cada mes nace con sus lineas de ingreso y sus items de diezmo (design D2 y D8
 * de diezmo-como-gasto).
 */
public class PlanUseCase implements IPlanServicePort {

    private final IHogarPersistencePort hogares;
    private final ICategoriaPersistencePort categorias;
    private final IPlanPersistencePort planes;
    private final IMovimientoPersistencePort movimientos;
    private final ICreditoPersistencePort creditos;
    private final ICierrePersistencePort cierres;
    private final ICurrentUserPort usuarioActual;
    private final ITransaccionPort transaccion;
    private final IClockPort clock;
    private final NacimientoMes nacimiento;

    public PlanUseCase(IHogarPersistencePort hogares, ICategoriaPersistencePort categorias, IPlanPersistencePort planes,
                       IMovimientoPersistencePort movimientos, ICreditoPersistencePort creditos,
                       ICierrePersistencePort cierres, IIngresoFijoPersistencePort ingresos, IReglaDiezmoPersistencePort reglas,
                       IAnualPersistencePort anuales, ICurrentUserPort usuarioActual, ITransaccionPort transaccion,
                       IClockPort clock) {
        this.hogares = hogares;
        this.categorias = categorias;
        this.planes = planes;
        this.movimientos = movimientos;
        this.creditos = creditos;
        this.cierres = cierres;
        this.usuarioActual = usuarioActual;
        this.transaccion = transaccion;
        this.clock = clock;
        this.nacimiento = new NacimientoMes(ingresos, reglas, anuales, movimientos, planes);
    }

    // --- Categorias -------------------------------------------------------------------------------------------------

    @Override
    public Mono<Categoria> crearCategoria(String nombre) {
        return Mono.fromCallable(() -> nombreCategoria(nombre)).flatMap(limpio -> contexto()
                .flatMap(ctx -> categorias.delHogar(ctx.hogar().id())
                        // Despues de las del sistema y las anteriores, como guardarCategoria del dominio.
                        .map(Categoria::orden).filter(o -> o < 90).reduce(0, Math::max)
                        .flatMap(maximo -> categorias.crear(new Categoria(UUID.randomUUID(), ctx.hogar().id(), limpio,
                                Categoria.COLOR_NUEVA, maximo + 1, Categoria.Tipo.OTRO, false)))));
    }

    @Override
    public Mono<Categoria> renombrarCategoria(UUID id, String nombre) {
        return Mono.fromCallable(() -> nombreCategoria(nombre)).flatMap(limpio -> contexto()
                .flatMap(ctx -> categorias.porIdEnHogar(id, ctx.hogar().id())
                        .switchIfEmpty(Mono.error(PlanUseCase::categoriaNoEncontrada))
                        .flatMap(c -> c.tipo() == Categoria.Tipo.DIEZMO ? Mono.<Categoria>error(reservada("La categoría Diezmo no se renombra"))
                                : categorias.renombrar(c, limpio))));
    }

    private static String nombreCategoria(String nombre) {
        String limpio = nombre == null ? "" : nombre.strip();
        if (limpio.isEmpty() || limpio.length() > Categoria.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("La categoría necesita un nombre de hasta 40 caracteres");
        }
        if (limpio.toLowerCase(Locale.ROOT).equals("diezmo")) {
            throw reservada("Diezmo ya es una categoría del sistema");
        }
        return limpio;
    }

    private static DomainException reservada(String mensaje) {
        return new DomainException(DomainException.Tipo.DATOS_INVALIDOS, "RESERVADA", mensaje);
    }

    // --- Plan del mes -----------------------------------------------------------------------------------------------

    @Override
    public Mono<PlanMes> crearPlan(YearMonth ref, String modo) {
        // Un mes cerrado sin plan no gana plan (design D3 de backend-cierre-mes).
        return Mono.fromCallable(() -> modoValido(modo)).flatMap(m -> contexto().flatMap(ctx -> cierres
                .estaCerrado(ctx.hogar().id(), ref)
                .flatMap(cerrado -> cerrado ? Mono.<Boolean>error(mesCerrado()) : Mono.just(false))
                .then(planes.deMes(ctx.hogar().id(), ref.minusMonths(1))
                .map(anterior -> new Base(base(anterior, m), otros(anterior, m)))
                .defaultIfEmpty(new Base(List.of(), List.of()))
                .zipWith(Mono.zip(creditos.delHogar(ctx.hogar().id()).collectMap(Credito::id),
                        categorias.delHogar(ctx.hogar().id()).collectList(), nacimiento.fuentes(ctx.hogar().id(), ref)))
                .flatMap(t -> {
                    UUID planId = UUID.randomUUID();
                    UUID escenarioId = UUID.randomUUID();
                    List<ItemPlan> items = new ArrayList<>(conCuotas(t.getT1().items().stream()
                            .map(i -> i.copia(UUID.randomUUID(), escenarioId, i.monto(), i.cuotaActual(), i.orden()))
                            .toList(), escenarioId, t.getT2().getT1(), t.getT2().getT2()));
                    // Las lineas de Ajustes y del anual se calculan de nuevo; las agregadas a mano se copian (design D8), con
                    // su diezmo si lo tenian; cada diezmo nace enlazado a su linea (design D1 de usabilidad-plan).
                    UUID diezmo = NacimientoMes.categoriaDiezmo(t.getT2().getT2());
                    List<IngresoPlan> nuevas = NacimientoMes.lineas(escenarioId, t.getT2().getT3());
                    items.addAll(NacimientoMes.diezmos(escenarioId, diezmo, t.getT2().getT3(), items, nuevas));
                    List<IngresoPlan> lineas = new ArrayList<>(nuevas);
                    for (Copiada c : t.getT1().otros()) {
                        IngresoPlan l = c.linea();
                        IngresoPlan copia = new IngresoPlan(UUID.randomUUID(), escenarioId, l.nombre(), l.monto(), l.usuarioId(), l.tipo(),
                                null, l.bruto(), lineas.size() + 1);
                        lineas.add(copia);
                        if (c.conDiezmo()) {
                            int orden = items.stream().mapToInt(ItemPlan::orden).max().orElse(0) + 1;
                            items.add(NacimientoMes.deLinea(escenarioId, diezmo, copia,
                                    reglaActivaDe(t.getT2().getT3(), copia.usuarioId()), null, orden));
                        }
                    }
                    PlanMes plan = new PlanMes(planId, ctx.hogar().id(), ref, PlanMes.Estado.BORRADOR, null,
                            List.of(new Escenario(escenarioId, planId, "A", ctx.usuario(), "", false, lineas, items)));
                    return transaccion.enTransaccion(planes.crear(plan));
                }))));
    }

    /** Lo que se copia del mes anterior: sus items y sus lineas agregadas a mano, con si tenian diezmo. */
    private record Base(List<ItemPlan> items, List<Copiada> otros) {
    }

    private record Copiada(IngresoPlan linea, boolean conDiezmo) {
    }

    private static List<Copiada> otros(PlanMes anterior, Modo modo) {
        Escenario principal = anterior.principal();
        if (modo == Modo.CERO || principal == null) {
            return List.of();
        }
        return principal.ingresos().stream().filter(l -> l.tipo() == IngresoPlan.Tipo.OTRO)
                .map(l -> new Copiada(l, principal.items().stream().anyMatch(i -> i.tipo() == ItemPlan.Tipo.DIEZMO && l.id().equals(i.ingresoPlanId()))))
                .toList();
    }

    private static co.com.srdejo.steward.domain.model.ReglaDiezmo reglaActivaDe(NacimientoMes.Fuentes f, UUID usuarioId) {
        var r = usuarioId == null ? null : f.reglas().get(usuarioId);
        return r != null && r.activa() ? r : null;
    }

    /**
     * Como {@code crearMes} del dominio con creditos: no se copia la cuota de un credito ya pagado (saldo en cero), y
     * cada credito con saldo sin item en la opcion gana su cuota.
     */
    private static List<ItemPlan> conCuotas(List<ItemPlan> copiados, UUID escenarioId, Map<UUID, Credito> creditos,
                                            List<Categoria> cats) {
        List<ItemPlan> items = new ArrayList<>(copiados.stream()
                .filter(i -> i.creditoId() == null
                        || (creditos.containsKey(i.creditoId()) && creditos.get(i.creditoId()).saldo() > 0))
                .toList());
        Set<UUID> enlazados = new HashSet<>();
        items.forEach(i -> enlazados.add(i.creditoId()));
        int orden = items.stream().mapToInt(ItemPlan::orden).max().orElse(0);
        for (Credito c : creditos.values().stream().sorted(Comparator.comparing(Credito::nombre)).toList()) {
            if (c.saldo() > 0 && !enlazados.contains(c.id())) {
                items.add(cuotaDe(c, escenarioId, CuentasUseCase.categoriaDeCreditos(cats), ++orden));
            }
        }
        return items;
    }

    /** El item de la cuota de un credito: Creditos, tipo CREDITO, "Cuota {nombre}", su cuota y su dia de pago. */
    static ItemPlan cuotaDe(Credito c, UUID escenarioId, UUID categoriaId, int orden) {
        return new ItemPlan(UUID.randomUUID(), escenarioId, categoriaId, c.nombreCuota(), c.cuota(), c.diaPago(),
                ItemPlan.Tipo.CREDITO, null, null, orden, c.id());
    }

    private enum Modo { COPIAR, FIJOS, CERO }

    private static Modo modoValido(String modo) {
        try {
            return Modo.valueOf(modo);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw DomainException.datosInvalidos("El modo es COPIAR, FIJOS o CERO");
        }
    }

    /**
     * {@code crearMes} del dominio: los items de la opcion principal del mes anterior, con las cuotas avanzadas y sin las
     * terminadas; FIJOS deja los variables en $0; CERO, nada. Los de diezmo no se copian: se calculan de nuevo (design D2).
     */
    private static List<ItemPlan> base(PlanMes anterior, Modo modo) {
        Escenario principal = anterior.principal();
        if (modo == Modo.CERO || principal == null) {
            return List.of();
        }
        return principal.items().stream()
                .filter(i -> i.tipo() != ItemPlan.Tipo.DIEZMO)
                .map(i -> i.cuotaActual() == null ? i : i.copia(i.id(), i.escenarioId(), i.monto(), i.cuotaActual() + 1, i.orden()))
                .filter(i -> i.cuotaActual() == null || i.cuotaActual() <= i.cuotaTotal())
                .map(i -> modo == Modo.FIJOS && i.tipo() == ItemPlan.Tipo.VARIABLE
                        ? i.copia(i.id(), i.escenarioId(), 0, i.cuotaActual(), i.orden())
                        : i)
                .toList();
    }

    // --- Items ------------------------------------------------------------------------------------------------------

    @Override
    public Mono<ItemPlan> agregarItem(UUID planId, UUID escenarioId, DatosItem datos) {
        return Mono.fromCallable(() -> itemValido(datos)).flatMap(d -> contexto()
                .flatMap(ctx -> escenarioEditable(planId, escenarioId, ctx)
                        .flatMap(esc -> categoriaDelHogar(d.categoriaId(), ctx)
                                .then(creditoDelHogar(d.creditoId(), ctx))
                                .then(planes.crearItem(new ItemPlan(UUID.randomUUID(), esc.id(), d.categoriaId(), d.nombre(),
                                        d.monto(), d.diaVence(), tipo(d.tipo()), d.cuotaActual(), d.cuotaTotal(),
                                        esc.items().stream().mapToInt(ItemPlan::orden).max().orElse(0) + 1,
                                        d.creditoId()))))));
    }

    @Override
    public Mono<ItemPlan> editarItem(UUID planId, UUID escenarioId, UUID itemId, DatosItem datos) {
        return Mono.fromCallable(() -> itemValido(datos)).flatMap(d -> contexto()
                .flatMap(ctx -> escenarioEditable(planId, escenarioId, ctx)
                        .flatMap(esc -> itemDe(esc, itemId)
                                .flatMap(actual -> categoriaDelHogar(d.categoriaId(), ctx)
                                        .then(creditoDelHogar(d.creditoId(), ctx))
                                        // Sin credito en la edicion, conserva el que tenia; los enlaces de un diezmo
                                        // tambien se conservan, y cambiar su monto lo deja "ajustado a mano" (design D1 de
                                        // usabilidad-plan).
                                        .then(ajustado(esc, actual, d.monto()))
                                        .flatMap(ajustado -> planes.actualizarItem(new ItemPlan(actual.id(), esc.id(), d.categoriaId(),
                                                d.nombre(), d.monto(), d.diaVence(), tipo(d.tipo()), d.cuotaActual(),
                                                d.cuotaTotal(), actual.orden(),
                                                d.creditoId() == null ? actual.creditoId() : d.creditoId(),
                                                actual.ingresoFijoId(), actual.aporteId(), actual.ingresoPlanId(), ajustado)))))));
    }

    /** Si el diezmo queda ajustado a mano: su monto cambio y no es el que sugiere su linea. */
    private Mono<Boolean> ajustado(Escenario esc, ItemPlan actual, long monto) {
        if (actual.ingresoPlanId() == null || monto == actual.monto()) {
            return Mono.just(actual.ajustadoAMano());
        }
        return Mono.justOrEmpty(esc.ingresos().stream().filter(l -> l.id().equals(actual.ingresoPlanId())).findFirst())
                .flatMap(linea -> nacimiento.reglaActiva(linea.usuarioId()).map(r -> monto != NacimientoMes.sugerido(r.orElse(null), linea)))
                .defaultIfEmpty(actual.ajustadoAMano());
    }

    /** "Volver a calcular": el diezmo vuelve a lo que sugiere su linea y deja de estar ajustado a mano. */
    @Override
    public Mono<ItemPlan> recalcularDiezmo(UUID planId, UUID escenarioId, UUID itemId) {
        return contexto().flatMap(ctx -> escenarioEditable(planId, escenarioId, ctx)
                .flatMap(esc -> itemDe(esc, itemId).flatMap(item -> Mono.justOrEmpty(esc.ingresos().stream()
                                .filter(l -> l.id().equals(item.ingresoPlanId())).findFirst())
                        .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("ITEM_NO_ENCONTRADO", "Ese diezmo no viene de un ingreso del plan")))
                        .flatMap(linea -> nacimiento.reglaActiva(linea.usuarioId())
                                .flatMap(r -> planes.actualizarItem(item.conMonto(item.nombre(), NacimientoMes.sugerido(r.orElse(null), linea), false)))))));
    }

    @Override
    public Mono<Void> quitarItem(UUID planId, UUID escenarioId, UUID itemId) {
        return contexto().flatMap(ctx -> escenarioEditable(planId, escenarioId, ctx)
                .flatMap(esc -> itemDe(esc, itemId))
                // Lo pagado no desaparece de "Pagado" (design D7): mas estricto que quitarItem del dominio.
                .flatMap(item -> movimientos.hayDeItem(item.id())
                        .flatMap(tiene -> tiene
                                ? Mono.error(DomainException.conflicto("ITEM_CON_PAGOS",
                                "Este gasto ya tiene pagos este mes; no se puede quitar"))
                                : planes.quitarItem(item.id()))));
    }

    // --- Lineas de ingreso (design D8 de diezmo-como-gasto) ---------------------------------------------------------

    @Override
    public Mono<IngresoPlan> agregarIngreso(UUID planId, UUID escenarioId, DatosLinea datos) {
        // Con "Aplicar diezmo", nace su item de diezmo enlazado (design D1 de usabilidad-plan).
        return Mono.fromCallable(() -> lineaValida(datos)).flatMap(d -> contexto()
                .flatMap(ctx -> escenarioEditable(planId, escenarioId, ctx)
                        .flatMap(esc -> miembro(d.usuarioId(), ctx).then(Mono.defer(() -> {
                            IngresoPlan linea = new IngresoPlan(UUID.randomUUID(), esc.id(), d.nombre(), d.monto(), d.usuarioId(),
                                    IngresoPlan.Tipo.OTRO, null, d.bruto(), esc.ingresos().stream().mapToInt(IngresoPlan::orden).max().orElse(0) + 1);
                            Mono<Void> diezmo = !d.aplicarDiezmo() ? Mono.empty()
                                    : Mono.zip(categorias.delHogar(ctx.hogar().id()).collectList(), nacimiento.reglaActiva(d.usuarioId()))
                                    .flatMap(t -> planes.crearItem(NacimientoMes.deLinea(esc.id(), NacimientoMes.categoriaDiezmo(t.getT1()),
                                            linea, t.getT2().orElse(null), null,
                                            esc.items().stream().mapToInt(ItemPlan::orden).max().orElse(0) + 1)))
                                    .then();
                            return transaccion.enTransaccion(planes.crearIngreso(linea).flatMap(l -> diezmo.thenReturn(l)));
                        })))));
    }

    @Override
    public Mono<IngresoPlan> editarIngreso(UUID planId, UUID escenarioId, UUID lineaId, DatosLinea datos) {
        // Conserva su tipo y su ingreso fijo: editar la linea no toca Ajustes ni las otras opciones; su diezmo la sigue.
        return Mono.fromCallable(() -> lineaValida(datos)).flatMap(d -> contexto()
                .flatMap(ctx -> escenarioEditable(planId, escenarioId, ctx)
                        .flatMap(esc -> lineaDe(esc, lineaId)
                                .flatMap(actual -> miembro(d.usuarioId(), ctx).then(Mono.defer(() -> {
                                    IngresoPlan nueva = new IngresoPlan(actual.id(), esc.id(), d.nombre(), d.monto(), d.usuarioId(),
                                            actual.tipo(), actual.ingresoFijoId(), d.bruto(), actual.orden());
                                    return transaccion.enTransaccion(planes.actualizarIngreso(nueva)
                                            .flatMap(l -> nacimiento.seguirLinea(esc, nueva, actual.nombre()).thenReturn(l)));
                                }))))));
    }

    @Override
    public Mono<Void> quitarIngreso(UUID planId, UUID escenarioId, UUID lineaId) {
        return contexto().flatMap(ctx -> planDelHogar(planId, ctx)
                .flatMap(plan -> escenarioEditable(planId, escenarioId, ctx)
                        .flatMap(esc -> lineaDe(esc, lineaId)
                        // Lo recibido no desaparece de los ingresos del mes (quitarIngresoPlan del dominio).
                        .flatMap(linea -> movimientos.lineaRecibida(linea.id(), linea.ingresoFijoId(), plan.ref())
                                .flatMap(recibida -> recibida
                                        ? Mono.<Void>error(DomainException.conflicto("INGRESO_RECIBIDO",
                                        linea.nombre() + " ya se recibió este mes; no se puede quitar"))
                                        : transaccion.enTransaccion(quitarDiezmoDe(esc, linea).then(planes.quitarIngreso(linea.id()))
                                        .thenReturn(true)).then())))));
    }

    /** Su diezmo se va con la linea si no tiene pagos; si los tiene, queda sin enlace (ON DELETE SET NULL). */
    private Mono<Void> quitarDiezmoDe(Escenario esc, IngresoPlan linea) {
        return Flux.fromIterable(esc.items().stream().filter(i -> linea.id().equals(i.ingresoPlanId())).toList())
                .concatMap(i -> movimientos.hayDeItem(i.id()).flatMap(conPagos -> conPagos ? Mono.<Void>empty() : planes.quitarItem(i.id())))
                .then();
    }

    // --- Borrar el plan de un mes (design D4 de usabilidad-plan) -----------------------------------------------------

    private static final Set<Movimiento.Tipo> DEL_PLAN = Set.of(Movimiento.Tipo.PAGO, Movimiento.Tipo.GASTO, Movimiento.Tipo.INGRESO_FIJO);

    @Override
    public Mono<ConteoBorrado> conteoBorrado(YearMonth ref) {
        return contexto().flatMap(ctx -> Mono.zip(movimientos.delMes(ctx.hogar().id(), ref).collectList(),
                        cierres.estaCerrado(ctx.hogar().id(), ref))
                .map(t -> new ConteoBorrado(contar(t.getT1(), Movimiento.Tipo.PAGO), contar(t.getT1(), Movimiento.Tipo.GASTO),
                        contar(t.getT1(), Movimiento.Tipo.INGRESO_FIJO), t.getT2())));
    }

    private static int contar(List<Movimiento> movs, Movimiento.Tipo tipo) {
        return (int) movs.stream().filter(m -> m.tipo() == tipo).count();
    }

    /**
     * {@code borrarPlan} del dominio: los pagos, gastos e ingresos recibidos del mes (una cuota devuelve su capital al
     * credito), el plan y su cierre. Los aportes, ajustes, transferencias y abonos se conservan.
     */
    @Override
    public Mono<Void> borrarPlan(YearMonth ref) {
        return contexto().flatMap(ctx -> Mono.zip(planes.deMes(ctx.hogar().id(), ref).map(java.util.Optional::of)
                                .defaultIfEmpty(java.util.Optional.empty()), cierres.estaCerrado(ctx.hogar().id(), ref))
                .flatMap(t -> {
                    if (t.getT1().isEmpty() && !t.getT2()) {
                        return Mono.<Void>error(planNoEncontrado());
                    }
                    Mono<Void> registros = movimientos.delMes(ctx.hogar().id(), ref).filter(m -> DEL_PLAN.contains(m.tipo()))
                            .concatMap(m -> (m.creditoId() != null && m.capital() != null ? creditos.devolver(m.creditoId(), m.capital())
                                    : Mono.<Void>empty()).then(movimientos.borrar(m.id())))
                            .then();
                    Mono<Void> plan = t.getT1().map(p -> planes.borrar(p.id())).orElse(Mono.empty());
                    return transaccion.enTransaccion(registros.then(plan).then(cierres.borrar(ctx.hogar().id(), ref)).thenReturn(true)).then();
                }));
    }

    private static DatosLinea lineaValida(DatosLinea d) {
        String nombre = d.nombre() == null ? "" : d.nombre().strip();
        if (nombre.isEmpty() || nombre.length() > IngresoPlan.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("El ingreso necesita un nombre de hasta 60 caracteres");
        }
        if (d.monto() < 0) {
            throw DomainException.datosInvalidos("El monto no puede ser negativo");
        }
        long bruto = d.bruto() == null ? d.monto() : d.bruto();
        if (bruto < 0) {
            throw DomainException.datosInvalidos("El bruto no puede ser negativo");
        }
        return new DatosLinea(nombre, d.monto(), d.usuarioId(), bruto, d.aplicarDiezmo());
    }

    static Mono<IngresoPlan> lineaDe(Escenario esc, UUID lineaId) {
        return Mono.justOrEmpty(esc.ingresos().stream().filter(l -> l.id().equals(lineaId)).findFirst())
                .switchIfEmpty(Mono.error(FinanzasUseCase::ingresoNoEncontrado));
    }

    private Mono<Void> miembro(UUID usuarioId, Contexto ctx) {
        if (usuarioId == null) {
            return Mono.empty();
        }
        return hogares.miembros(ctx.hogar().id())
                .filter(m -> m.usuario().id().equals(usuarioId))
                .next()
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("MIEMBRO_NO_ENCONTRADO", "Esa persona no es del hogar")))
                .then();
    }

    @Override
    public Mono<PlanMes> usar(UUID planId, UUID escenarioId) {
        // usarEscenario del dominio (design D1 de backend-opciones-mes): volver a elegir la que esta en uso no cambia
        // nada; cambiar de opcion solo en Borrador, y no si la principal ya tiene pagos en el mes.
        return contexto().flatMap(ctx -> planDelHogar(planId, ctx).flatMap(plan -> {
            if (plan.estado() == PlanMes.Estado.CERRADO) {
                return Mono.<PlanMes>error(mesCerrado());
            }
            Escenario esc = opcionDe(plan, escenarioId);
            if (esc == null) {
                return Mono.<PlanMes>error(planNoEncontrado());
            }
            if (esc.id().equals(plan.escenarioActivoId())) {
                return Mono.just(plan);
            }
            Escenario principal = plan.principal();
            return enBorrador(plan)
                    .then(principal == null || principal.id().equals(esc.id()) ? Mono.just(false) : tienePagos(principal))
                    .flatMap(conPagos -> conPagos
                            ? Mono.<PlanMes>error(DomainException.conflicto("MES_NO_BORRADOR", capital(plan) + " ya tiene pagos en la Opción "
                            + principal.letra() + "; no cambia de opción"))
                            : transaccion.enTransaccion(planes.usar(planId, esc.id()).thenReturn(true))
                            .then(planes.porIdEnHogar(planId, ctx.hogar().id())));
        }));
    }

    // --- Varias opciones (backend-opciones-mes) ---------------------------------------------------------------------

    private static final String LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final int NOTA_MAX = 60;

    @Override
    public Mono<PlanMes> duplicar(UUID planId, UUID desde, String nota) {
        String limpia = nota == null ? "" : nota.strip();
        if (limpia.length() > NOTA_MAX) {
            return Mono.error(DomainException.datosInvalidos("La nota va hasta 60 caracteres"));
        }
        return contexto().flatMap(ctx -> copiar(planId, desde, limpia, ctx, null, true)
                .then(planes.porIdEnHogar(planId, ctx.hogar().id())));
    }

    /**
     * duplicarEscenario del dominio: la siguiente letra libre, los mismos items sin avanzar cuotas (con su credito, su
     * ingreso o su aporte) y las mismas lineas de ingreso, y {@code extra} al final si viene. Si otra persona tomo la letra al mismo tiempo, reintenta una vez (design D3).
     */
    private Mono<Escenario> copiar(UUID planId, UUID desde, String nota, Contexto ctx, ItemPlan extra, boolean reintentar) {
        return planDelHogar(planId, ctx).flatMap(plan -> enBorrador(plan).then(Mono.defer(() -> {
            Escenario origen = opcionDe(plan, desde);
            if (origen == null) {
                return Mono.<Escenario>error(planNoEncontrado());
            }
            Set<String> usadas = new HashSet<>();
            plan.escenarios().forEach(e -> usadas.add(e.letra()));
            String letra = LETRAS.chars().mapToObj(c -> String.valueOf((char) c)).filter(l -> !usadas.contains(l)).findFirst()
                    .orElse(null);
            if (letra == null) {
                return Mono.<Escenario>error(DomainException.conflicto("MUCHAS_OPCIONES", "No caben más opciones en este mes"));
            }
            UUID id = UUID.randomUUID();
            List<IngresoPlan> lineas = origen.ingresos().stream()
                    .map(l -> new IngresoPlan(UUID.randomUUID(), id, l.nombre(), l.monto(), l.usuarioId(), l.tipo(), l.ingresoFijoId(),
                            l.bruto(), l.orden()))
                    .toList();
            Map<UUID, UUID> nuevaDe = new java.util.HashMap<>();
            for (int k = 0; k < lineas.size(); k++) {
                nuevaDe.put(origen.ingresos().get(k).id(), lineas.get(k).id());
            }
            List<ItemPlan> items = new ArrayList<>(origen.items().stream()
                    .map(i -> i.copia(UUID.randomUUID(), id, i.monto(), i.cuotaActual(), i.orden()))
                    .map(i -> i.ingresoPlanId() == null ? i : i.conLinea(nuevaDe.get(i.ingresoPlanId())))
                    .toList());
            if (extra != null) {
                int orden = items.stream().mapToInt(ItemPlan::orden).max().orElse(0) + 1;
                items.add(new ItemPlan(UUID.randomUUID(), id, extra.categoriaId(), extra.nombre(), extra.monto(), extra.diaVence(),
                        extra.tipo(), null, null, orden, extra.creditoId()));
            }
            Escenario nueva = new Escenario(id, plan.id(), letra, ctx.usuario(), nota, false, lineas, items);
            return transaccion.enTransaccion(planes.crearEscenario(nueva))
                    .onErrorResume(DomainException.class, ex -> reintentar && "LETRA_OCUPADA".equals(ex.codigo())
                            ? copiar(planId, desde, nota, ctx, extra, false)
                            : Mono.error("LETRA_OCUPADA".equals(ex.codigo())
                            ? DomainException.conflicto("YA_EXISTE", "Otra persona acaba de crear una opción; intenta otra vez") : ex));
        })));
    }

    /** Quitar una opcion (design D5): en Borrador, ni la que esta en uso ni la ultima vigente ni una con pagos. */
    @Override
    public Mono<Void> quitarOpcion(UUID planId, UUID escenarioId) {
        return contexto().flatMap(ctx -> planDelHogar(planId, ctx).flatMap(plan -> enBorrador(plan).then(Mono.defer(() -> {
            Escenario esc = opcionDe(plan, escenarioId);
            if (esc == null) {
                return Mono.<Void>error(planNoEncontrado());
            }
            if (esc.id().equals(plan.escenarioActivoId())) {
                return Mono.<Void>error(DomainException.conflicto("OPCION_EN_USO", "Esa opción está en uso; primero usa otra"));
            }
            if (plan.escenarios().stream().noneMatch(e -> !e.archivado() && !e.id().equals(esc.id()))) {
                return Mono.<Void>error(DomainException.conflicto("ULTIMA_OPCION", "El mes necesita al menos una opción"));
            }
            return tienePagos(esc).flatMap(conPagos -> conPagos
                    ? Mono.<Void>error(DomainException.conflicto("OPCION_CON_PAGOS",
                    "Esa opción ya tiene pagos este mes; no se puede quitar"))
                    : transaccion.enTransaccion(planes.quitarEscenario(esc.id()).thenReturn(true)).then());
        }))));
    }

    /**
     * probarAbonoComoOpcion del dominio: crea el mes copiando el anterior si no tiene plan, y duplica la principal con el
     * abono extra en Creditos, enlazado al credito.
     */
    @Override
    public Mono<OpcionNueva> probarAbono(UUID creditoId, YearMonth ref, long abono) {
        if (abono <= 0) {
            return Mono.error(DomainException.datosInvalidos("Escribe el abono"));
        }
        return contexto().flatMap(ctx -> creditos.porIdEnHogar(creditoId, ctx.hogar().id())
                .switchIfEmpty(Mono.error(CuentasUseCase::creditoNoEncontrado))
                .flatMap(credito -> planes.deMes(ctx.hogar().id(), ref)
                        .switchIfEmpty(Mono.defer(() -> crearPlan(ref, "COPIAR")))
                        .zipWith(categorias.delHogar(ctx.hogar().id()).collectList())
                        .flatMap(t -> {
                            PlanMes plan = t.getT1();
                            Escenario principal = plan.principal();
                            if (principal == null) {
                                return Mono.<OpcionNueva>error(planNoEncontrado());
                            }
                            ItemPlan abonoExtra = new ItemPlan(null, null, CuentasUseCase.categoriaDeCreditos(t.getT2()),
                                    "Abono extra " + credito.nombre().toLowerCase(Locale.ROOT), abono, credito.diaPago(),
                                    ItemPlan.Tipo.CREDITO, null, null, 0, credito.id());
                            return copiar(plan.id(), principal.id(), "abono a crédito", ctx, abonoExtra, true)
                                    .map(nueva -> new OpcionNueva(plan.id(), nueva.id()));
                        })));
    }

    private Mono<PlanMes> planDelHogar(UUID planId, Contexto ctx) {
        return planes.porIdEnHogar(planId, ctx.hogar().id()).switchIfEmpty(Mono.error(PlanUseCase::planNoEncontrado));
    }

    private static Escenario opcionDe(PlanMes plan, UUID escenarioId) {
        return plan.escenarios().stream().filter(e -> e.id().equals(escenarioId)).findFirst().orElse(null);
    }

    /** Varias opciones solo en Borrador segun el estado efectivo (design D1 de backend-opciones-mes). */
    private Mono<Void> enBorrador(PlanMes plan) {
        if (plan.estado() == PlanMes.Estado.CERRADO) {
            return Mono.error(mesCerrado());
        }
        if (plan.estadoEn(clock.hoy()) != PlanMes.Estado.BORRADOR) {
            return Mono.error(DomainException.conflicto("MES_NO_BORRADOR", capital(plan) + " ya está en curso; su plan no gana opciones"));
        }
        return Mono.empty();
    }

    private Mono<Boolean> tienePagos(Escenario esc) {
        return Flux.fromIterable(esc.items()).concatMap(i -> movimientos.hayDeItem(i.id())).any(Boolean::booleanValue);
    }

    private static String capital(PlanMes plan) {
        String nombre = Formato.nombreMes(plan.ref().getMonthValue());
        return Character.toUpperCase(nombre.charAt(0)) + nombre.substring(1);
    }

    /** {@code guardarItem} del dominio, mas los largos y las cuotas. */
    private static DatosItem itemValido(DatosItem d) {
        String nombre = d.nombre() == null ? "" : d.nombre().strip();
        if (nombre.isEmpty() || nombre.length() > ItemPlan.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("El gasto necesita un nombre de hasta 60 caracteres");
        }
        if (d.monto() < 0) {
            throw DomainException.datosInvalidos("El monto no puede ser negativo");
        }
        if (d.categoriaId() == null) {
            throw DomainException.datosInvalidos("Elige una categoría");
        }
        tipo(d.tipo());
        if (d.diaVence() != null && (d.diaVence() < 1 || d.diaVence() > 31)) {
            throw DomainException.datosInvalidos("El día de vencimiento va de 1 a 31");
        }
        if ((d.cuotaActual() == null) != (d.cuotaTotal() == null)
                || (d.cuotaActual() != null && (d.cuotaActual() < 1 || d.cuotaActual() > d.cuotaTotal()))) {
            throw DomainException.datosInvalidos("La cuota actual va de 1 al total de cuotas");
        }
        return new DatosItem(d.categoriaId(), nombre, d.monto(), d.diaVence(), d.tipo(), d.cuotaActual(), d.cuotaTotal(),
                d.creditoId());
    }

    private static ItemPlan.Tipo tipo(String tipo) {
        try {
            return ItemPlan.Tipo.valueOf(tipo);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw DomainException.datosInvalidos("El tipo es FIJO, VARIABLE, CUOTA, CREDITO o DIEZMO");
        }
    }

    /** La opcion del plan del hogar, si el mes no esta cerrado. Un id ajeno responde como uno inexistente. */
    private Mono<Escenario> escenarioEditable(UUID planId, UUID escenarioId, Contexto ctx) {
        return planes.porIdEnHogar(planId, ctx.hogar().id())
                .switchIfEmpty(Mono.error(PlanUseCase::planNoEncontrado))
                .flatMap(plan -> plan.estado() == PlanMes.Estado.CERRADO ? Mono.error(mesCerrado())
                        : Mono.justOrEmpty(plan.escenarios().stream().filter(e -> e.id().equals(escenarioId)).findFirst())
                        .switchIfEmpty(Mono.error(PlanUseCase::planNoEncontrado)));
    }

    private static Mono<ItemPlan> itemDe(Escenario esc, UUID itemId) {
        return Mono.justOrEmpty(esc.items().stream().filter(i -> i.id().equals(itemId)).findFirst())
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("ITEM_NO_ENCONTRADO", "Ese gasto no está en el plan")));
    }

    private Mono<Void> categoriaDelHogar(UUID categoriaId, Contexto ctx) {
        return categorias.porIdEnHogar(categoriaId, ctx.hogar().id())
                .switchIfEmpty(Mono.error(PlanUseCase::categoriaNoEncontrada))
                .then();
    }

    private Mono<Void> creditoDelHogar(UUID creditoId, Contexto ctx) {
        if (creditoId == null) {
            return Mono.empty();
        }
        return creditos.porIdEnHogar(creditoId, ctx.hogar().id())
                .switchIfEmpty(Mono.error(CuentasUseCase::creditoNoEncontrado))
                .then();
    }

    private Mono<Contexto> contexto() {
        return usuarioActual.usuarioId().flatMap(usuario -> hogares.hogarDe(usuario)
                .switchIfEmpty(Mono.error(HogarUseCase::sinHogar))
                .map(hogar -> new Contexto(usuario, hogar)));
    }

    static DomainException mesCerrado() {
        return DomainException.conflicto("MES_CERRADO", "El mes está cerrado");
    }

    static DomainException planNoEncontrado() {
        return DomainException.noEncontrado("PLAN_NO_ENCONTRADO", "Ese plan no existe");
    }

    static DomainException categoriaNoEncontrada() {
        return DomainException.noEncontrado("CATEGORIA_NO_ENCONTRADA", "Esa categoría no existe");
    }

    private record Contexto(UUID usuario, Hogar hogar) {
    }
}
