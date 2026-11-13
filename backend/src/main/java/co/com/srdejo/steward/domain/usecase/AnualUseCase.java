package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IAnualServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Celda;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import co.com.srdejo.steward.domain.model.PlanAnual.Proyeccion;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICierrePersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.usecase.Registro.Contexto;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * El plan anual (spec steward-plan-anual, design D1 a D4 de backend-plan-anual). Reproduce {@code crearAnual},
 * {@code editarMontoAnual}, {@code agregarEvento}, {@code editarProyeccion} y {@code crearMesesDesdeAnual} del dominio
 * compartido. La cuadricula y los KPI los calcula el cliente.
 */
public class AnualUseCase implements IAnualServicePort {

    static final String CATEGORIA_EVENTOS = "Eventos del año";
    private static final String COLOR_EVENTOS = "#5F625C";
    private static final int ORDEN_EVENTOS = 90;

    private final IHogarPersistencePort hogares;
    private final IAnualPersistencePort anuales;
    private final ICategoriaPersistencePort categorias;
    private final IPlanPersistencePort planes;
    private final ICierrePersistencePort cierres;
    private final ITransaccionPort transaccion;
    private final IMovimientoPersistencePort movimientos;
    private final Registro registro;
    private final NacimientoMes nacimiento;

    public AnualUseCase(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas, IAnualPersistencePort anuales,
                        ICategoriaPersistencePort categorias, IPlanPersistencePort planes, ICierrePersistencePort cierres,
                        IIngresoFijoPersistencePort ingresos, IReglaDiezmoPersistencePort reglas,
                        IMovimientoPersistencePort movimientos, ICurrentUserPort usuarioActual, ITransaccionPort transaccion,
                        IClockPort clock) {
        this.hogares = hogares;
        this.anuales = anuales;
        this.categorias = categorias;
        this.planes = planes;
        this.cierres = cierres;
        this.transaccion = transaccion;
        this.movimientos = movimientos;
        this.registro = new Registro(hogares, cuentas, usuarioActual, clock);
        this.nacimiento = new NacimientoMes(ingresos, reglas, anuales, movimientos, planes);
    }

    @Override
    public Mono<PlanAnual> crear(int anio) {
        if (anio < registro.mesEnCurso().getYear()) {
            return Mono.error(DomainException.datosInvalidos("El plan anual es del año en curso o uno futuro"));
        }
        return registro.contexto().flatMap(ctx -> anuales.crear(new PlanAnual(UUID.randomUUID(), ctx.hogar().id(), anio,
                PlanAnual.Estado.BORRADOR, List.of(), List.of())));
    }

    @Override
    public Mono<Void> ponerCelda(int anio, UUID categoriaId, int mes, long monto) {
        if (mes < 1 || mes > 12 || monto < 0) {
            return Mono.error(DomainException.datosInvalidos("Revisa el mes y el monto"));
        }
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                .flatMap(a -> categorias.porIdEnHogar(categoriaId, ctx.hogar().id())
                        .switchIfEmpty(Mono.error(PlanUseCase::categoriaNoEncontrada))
                        // La fila Diezmo del anual se calcula con las reglas (design D2 de diezmo-como-gasto).
                        .flatMap(c -> c.tipo() == Categoria.Tipo.DIEZMO
                                ? Mono.<Void>error(DomainException.datosInvalidos("El diezmo del año se calcula con las reglas"))
                                : anuales.ponerCelda(a.id(), categoriaId, mes, monto))));
    }

    @Override
    public Mono<Evento> agregarEvento(int anio, String nombre, int mes, long monto, String tipo, UUID usuarioId, UUID categoriaId,
                                      boolean enAdelante) {
        return evento(UUID.randomUUID(), nombre, mes, monto, tipo, usuarioId, categoriaId, enAdelante)
                .flatMap(evento -> registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                        .flatMap(a -> validarEvento(ctx, evento).then(anuales.agregarEvento(a.id(), evento)))));
    }

    @Override
    public Mono<Evento> editarEvento(int anio, UUID eventoId, String nombre, int mes, long monto, String tipo, UUID usuarioId,
                                     UUID categoriaId, boolean enAdelante) {
        return evento(eventoId, nombre, mes, monto, tipo, usuarioId, categoriaId, enAdelante)
                .flatMap(evento -> registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                        .flatMap(a -> validarEvento(ctx, evento).then(anuales.editarEvento(a.id(), evento)))
                        .flatMap(ok -> ok ? Mono.just(evento) : Mono.error(AnualUseCase::eventoNoEncontrado))));
    }

    @Override
    public Mono<Void> quitarEvento(int anio, UUID eventoId) {
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                .flatMap(a -> anuales.quitarEvento(a.id(), eventoId))
                .flatMap(ok -> ok ? Mono.<Void>empty() : Mono.error(AnualUseCase::eventoNoEncontrado)));
    }

    @Override
    public Mono<Void> borrar(int anio) {
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                .flatMap(a -> transaccion.enTransaccion(anuales.reemplazarProyecciones(ctx.hogar().id(), anio, List.of())
                        .then(anuales.borrar(a.id())))));
    }

    private static DomainException eventoNoEncontrado() {
        return DomainException.noEncontrado("EVENTO_NO_ENCONTRADO", "Ese cambio ya no está");
    }

    /** Los datos de un evento, como {@code validarEvento} del dominio: un ingreso no lleva categoria; un gasto, persona. */
    private static Mono<Evento> evento(UUID id, String nombre, int mes, long monto, String tipo, UUID usuarioId, UUID categoriaId,
                                       boolean enAdelante) {
        String limpio = nombre == null ? "" : nombre.strip();
        Evento.Tipo t;
        try {
            t = Evento.Tipo.valueOf(tipo);
        } catch (IllegalArgumentException | NullPointerException ex) {
            return Mono.error(DomainException.datosInvalidos("El tipo es INGRESO o GASTO"));
        }
        if (limpio.isEmpty() || limpio.length() > PlanAnual.NOMBRE_EVENTO_MAX || mes < 1 || mes > 12 || monto <= 0) {
            return Mono.error(DomainException.datosInvalidos("El evento necesita nombre, mes y monto"));
        }
        if (t == Evento.Tipo.INGRESO && categoriaId != null) {
            return Mono.error(DomainException.datosInvalidos("Un ingreso no lleva categoría"));
        }
        return Mono.just(new Evento(id, limpio, mes, monto, t, t == Evento.Tipo.INGRESO ? usuarioId : null, categoriaId, enAdelante));
    }

    private Mono<Void> validarEvento(Contexto ctx, Evento e) {
        Mono<Void> persona = e.usuarioId() == null ? Mono.empty() : miembro(ctx, e.usuarioId());
        Mono<Void> categoria = e.categoriaId() == null ? Mono.empty() : categorias.porIdEnHogar(e.categoriaId(), ctx.hogar().id())
                .switchIfEmpty(Mono.error(PlanUseCase::categoriaNoEncontrada))
                .flatMap(c -> c.tipo() == Categoria.Tipo.DIEZMO
                        ? Mono.<Void>error(DomainException.datosInvalidos("El diezmo del año se calcula con las reglas"))
                        : Mono.<Void>empty());
        return persona.then(categoria);
    }

    /**
     * replicarMes del dominio (design D1 y D2 de planear-anio-desde-un-mes): por categoria (salvo Diezmo y "Eventos del
     * año"), el total de la opcion principal del mes base en los 12 meses; con FIJOS, el ultimo plan antes del año sin sus
     * items variables. Los aportes proyectados de cada miembro: lo que registro en el mes base, o su proyeccion de ese mes.
     */
    @Override
    public Mono<PlanAnual> replicar(int anio, String tipo, YearMonth base) {
        if (anio < registro.mesEnCurso().getYear()) {
            return Mono.error(DomainException.datosInvalidos("El plan anual es del año en curso o uno futuro"));
        }
        if (!"MES".equals(tipo) && !"FIJOS".equals(tipo) && !"CERO".equals(tipo) || "MES".equals(tipo) && base == null) {
            return Mono.error(DomainException.datosInvalidos("La base es un mes, FIJOS o CERO"));
        }
        return registro.contexto().flatMap(ctx -> {
            UUID hogar = ctx.hogar().id();
            Mono<java.util.Optional<PlanMes>> origen = switch (tipo) {
                case "MES" -> planes.deMes(hogar, base).map(java.util.Optional::of)
                        .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("PLAN_NO_ENCONTRADO", "Ese mes no tiene plan")));
                case "FIJOS" -> planes.ultimoAntesDe(hogar, YearMonth.of(anio, 1)).map(java.util.Optional::of)
                        .defaultIfEmpty(java.util.Optional.empty());
                default -> Mono.just(java.util.Optional.empty());
            };
            return origen.flatMap(plan -> Mono.zip(
                            anuales.deAnio(hogar, anio).map(java.util.Optional::of).defaultIfEmpty(java.util.Optional.empty()),
                            categorias.delHogar(hogar).collectList(),
                            aportesBase(ctx, plan.map(PlanMes::ref).filter(r -> "MES".equals(tipo))))
                    .flatMap(t -> {
                        if (t.getT1().map(a -> a.estado() == PlanAnual.Estado.CREADO).orElse(false)) {
                            return Mono.error(DomainException.datosInvalidos("Los meses de ese año ya se crearon"));
                        }
                        List<ItemPlan> items = plan.map(PlanMes::principal).map(Escenario::items).orElse(List.of()).stream()
                                .filter(i -> i.tipo() != ItemPlan.Tipo.DIEZMO && !("FIJOS".equals(tipo) && i.tipo() == ItemPlan.Tipo.VARIABLE))
                                .toList();
                        List<Celda> celdas = new ArrayList<>();
                        for (Categoria c : t.getT2()) {
                            long monto = items.stream().filter(i -> i.categoriaId().equals(c.id())).mapToLong(ItemPlan::monto).sum();
                            if (c.tipo() == Categoria.Tipo.DIEZMO || c.nombre().equals(CATEGORIA_EVENTOS) || monto <= 0) {
                                continue;
                            }
                            for (int mes = 1; mes <= 12; mes++) {
                                celdas.add(new Celda(c.id(), mes, monto));
                            }
                        }
                        List<Proyeccion> proyecciones = new ArrayList<>();
                        t.getT3().forEach((usuario, monto) -> {
                            for (int mes = 1; mes <= 12; mes++) {
                                proyecciones.add(new Proyeccion(usuario, anio, mes, monto));
                            }
                        });
                        YearMonth ref = plan.map(PlanMes::ref).orElse(null);
                        Mono<PlanAnual> anual = t.getT1().map(Mono::just).orElseGet(() -> anuales.crear(new PlanAnual(UUID.randomUUID(), hogar,
                                anio, PlanAnual.Estado.BORRADOR, List.of(), List.of())));
                        return transaccion.enTransaccion(anual.flatMap(a -> anuales.replicar(a.id(), celdas, ref)
                                .then(anuales.reemplazarProyecciones(hogar, anio, proyecciones))
                                .then(anuales.deAnio(hogar, anio))));
                    }));
        });
    }

    /** Por miembro: sus aportes registrados en el mes base o, si no registro, su proyeccion de ese mes. */
    private Mono<java.util.Map<UUID, Long>> aportesBase(Contexto ctx, java.util.Optional<YearMonth> ref) {
        if (ref.isEmpty()) {
            return Mono.just(java.util.Map.of());
        }
        UUID hogar = ctx.hogar().id();
        YearMonth mes = ref.get();
        return Mono.zip(
                        hogares.miembros(hogar).map(m -> m.usuario().id()).collectList(),
                        movimientos.delMes(hogar, mes).filter(m -> m.tipo() == Movimiento.Tipo.APORTE).collectList(),
                        anuales.proyeccionesDesde(hogar, mes.getYear())
                                .filter(p -> p.anio() == mes.getYear() && p.mes() == mes.getMonthValue()).collectList())
                .map(t -> {
                    java.util.Map<UUID, Long> porMiembro = new java.util.LinkedHashMap<>();
                    for (UUID usuario : t.getT1()) {
                        long registrado = t.getT2().stream().filter(m -> m.usuarioId().equals(usuario)).mapToLong(Movimiento::monto).sum();
                        long proyectado = t.getT3().stream().filter(p -> p.usuarioId().equals(usuario)).mapToLong(Proyeccion::monto).sum();
                        long monto = registrado > 0 ? registrado : proyectado;
                        if (monto > 0) {
                            porMiembro.put(usuario, monto);
                        }
                    }
                    return porMiembro;
                });
    }

    @Override
    public Mono<Void> ponerProyeccion(int anio, UUID usuarioId, int mes, long monto) {
        if (mes < 1 || mes > 12 || monto < 0) {
            return Mono.error(DomainException.datosInvalidos("Revisa el mes y el monto"));
        }
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                .then(miembro(ctx, usuarioId))
                .then(anuales.ponerProyeccion(ctx.hogar().id(), new Proyeccion(usuarioId, anio, mes, monto))));
    }

    /**
     * crearMesesDesdeAnual del dominio (design D4): cada mes sin plan ni cierre nace en Borrador con su columna como
     * Opcion A, desde la opcion principal del ultimo plan anterior al año. Si la columna de una categoria es menor que sus
     * items copiados, entra como un solo item por el monto de la columna (los items no son negativos). Cada mes nace con
     * sus lineas de ingreso y sus items de diezmo; los de diezmo del plan base no se copian (design D2 y D8 de
     * diezmo-como-gasto).
     */
    @Override
    public Mono<List<YearMonth>> crearMeses(int anio) {
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio).flatMap(anual -> Mono.zip(
                        // La plantilla: el mes base, o sin base el ultimo plan antes del año (design D1 de planear-anio-desde-un-mes).
                        (anual.base() != null ? planes.deMes(ctx.hogar().id(), anual.base()) : planes.ultimoAntesDe(ctx.hogar().id(), YearMonth.of(anio, 1)))
                                .map(p -> p.principal() == null ? List.<ItemPlan>of() : p.principal().items().stream()
                                        .filter(i -> i.tipo() != ItemPlan.Tipo.DIEZMO).toList())
                                .defaultIfEmpty(List.of()),
                        categorias.delHogar(ctx.hogar().id()).collectList())
                .flatMap(t -> transaccion.enTransaccion(categoriaEventos(ctx, anual, t.getT2())
                        .flatMap(eventosCat -> Flux.range(1, 12)
                                .concatMap(mes -> crearMes(ctx, anual, YearMonth.of(anio, mes), t.getT1(), t.getT2(),
                                        eventosCat.orElse(null)))
                                .collectList()
                                .flatMap(creados -> anuales.marcarCreado(anual.id()).thenReturn(creados)))))));
    }

    private Mono<java.util.Optional<UUID>> categoriaEventos(Contexto ctx, PlanAnual anual, List<Categoria> cats) {
        if (anual.eventos().stream().noneMatch(e -> e.tipo() == Evento.Tipo.GASTO && enEventos(e, cats))) {
            return Mono.just(java.util.Optional.empty());
        }
        return cats.stream().filter(c -> c.nombre().equals(CATEGORIA_EVENTOS)).findFirst()
                .map(c -> Mono.just(java.util.Optional.of(c.id())))
                .orElseGet(() -> categorias.crear(new Categoria(UUID.randomUUID(), ctx.hogar().id(), CATEGORIA_EVENTOS, COLOR_EVENTOS,
                        ORDEN_EVENTOS, Categoria.Tipo.OTRO, false)).map(c -> java.util.Optional.of(c.id())));
    }

    private Mono<YearMonth> crearMes(Contexto ctx, PlanAnual anual, YearMonth ref, List<ItemPlan> plantilla, List<Categoria> cats,
                                     UUID eventosCat) {
        return Mono.zip(planes.deMes(ctx.hogar().id(), ref).hasElement(), cierres.estaCerrado(ctx.hogar().id(), ref),
                        nacimiento.fuentes(ctx.hogar().id(), ref))
                .flatMap(t -> {
                    if (t.getT1() || t.getT2()) {
                        return Mono.<YearMonth>empty();
                    }
                    UUID planId = UUID.randomUUID();
                    UUID escId = UUID.randomUUID();
                    List<ItemPlan> items = new ArrayList<>();
                    // Las filas del anual, en el orden de las categorias del hogar.
                    Set<UUID> conCelda = new LinkedHashSet<>();
                    anual.celdas().forEach(c -> conCelda.add(c.categoriaId()));
                    List<UUID> filas = cats.stream().sorted(java.util.Comparator.comparingInt(Categoria::orden)).map(Categoria::id)
                            .filter(conCelda::contains).toList();
                    for (UUID categoriaId : filas) {
                        long monto = anual.celdas().stream().filter(c -> c.categoriaId().equals(categoriaId) && c.mes() == ref.getMonthValue())
                                .mapToLong(Celda::monto).sum();
                        List<ItemPlan> deCategoria = plantilla.stream().filter(i -> i.categoriaId().equals(categoriaId)).toList();
                        long base = deCategoria.stream().mapToLong(ItemPlan::monto).sum();
                        String nombreCategoria = cats.stream().filter(c -> c.id().equals(categoriaId)).map(Categoria::nombre).findFirst()
                                .orElse("Gasto");
                        if (monto < base) {
                            if (monto > 0) {
                                items.add(item(escId, categoriaId, nombreCategoria, monto, items.size()));
                            }
                            continue;
                        }
                        deCategoria.forEach(i -> items.add(i.copia(UUID.randomUUID(), escId, i.monto(), i.cuotaActual(), items.size() + 1)));
                        if (monto > base) {
                            items.add(item(escId, categoriaId, deCategoria.isEmpty() ? nombreCategoria : "Ajuste del plan anual",
                                    monto - base, items.size()));
                        }
                    }
                    // Cada gasto que toca el mes, en su categoria o en "Eventos del año" (design D3 de planear-anio-desde-un-mes).
                    for (Evento e : anual.eventos()) {
                        if (e.tipo() != Evento.Tipo.GASTO || !e.aplica(ref.getMonthValue())) {
                            continue;
                        }
                        boolean enEventos = enEventos(e, cats);
                        boolean variable = !enEventos && cats.stream().anyMatch(c -> c.id().equals(e.categoriaId()) && c.tipo() == Categoria.Tipo.VARIABLE);
                        items.add(new ItemPlan(UUID.randomUUID(), escId, enEventos ? eventosCat : e.categoriaId(), e.nombre(), e.monto(), null,
                                variable ? ItemPlan.Tipo.VARIABLE : ItemPlan.Tipo.FIJO, null, null, items.size() + 1));
                    }
                    List<IngresoPlan> lineas = NacimientoMes.lineas(escId, t.getT3());
                    items.addAll(NacimientoMes.diezmos(escId, NacimientoMes.categoriaDiezmo(cats), t.getT3(), items, lineas));
                    PlanMes plan = new PlanMes(planId, ctx.hogar().id(), ref, PlanMes.Estado.BORRADOR, null,
                            List.of(new Escenario(escId, planId, "A", ctx.usuario(), "Del plan anual", false, lineas, items)));
                    return planes.crear(plan).thenReturn(ref)
                            // Si otra persona lo creo a la vez, ese mes ya tiene plan.
                            .onErrorResume(DomainException.class, ex -> "YA_EXISTE".equals(ex.codigo()) ? Mono.empty() : Mono.error(ex));
                });
    }

    /** Un gasto sin categoria, o con la categoria "Eventos del año", va en esa fila. */
    private static boolean enEventos(Evento e, List<Categoria> cats) {
        return e.categoriaId() == null || cats.stream().anyMatch(c -> c.id().equals(e.categoriaId()) && c.nombre().equals(CATEGORIA_EVENTOS));
    }

    private static ItemPlan item(UUID escId, UUID categoriaId, String nombre, long monto, int orden) {
        return new ItemPlan(UUID.randomUUID(), escId, categoriaId, nombre, monto, null, ItemPlan.Tipo.VARIABLE, null, null, orden + 1);
    }

    private Mono<PlanAnual> anualDe(Contexto ctx, int anio) {
        return anuales.deAnio(ctx.hogar().id(), anio)
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("ANUAL_NO_ENCONTRADO", "No hay plan anual para ese año")));
    }

    private Mono<Void> miembro(Contexto ctx, UUID usuarioId) {
        return hogares.miembros(ctx.hogar().id())
                .filter(m -> m.usuario().id().equals(usuarioId))
                .next()
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("MIEMBRO_NO_ENCONTRADO", "Esa persona no es del hogar")))
                .then();
    }
}
