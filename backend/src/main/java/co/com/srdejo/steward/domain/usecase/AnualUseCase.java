package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IAnualServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Amortizacion;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.PlanAnual.Celda;
import co.com.srdejo.steward.domain.model.PlanAnual.Evento;
import co.com.srdejo.steward.domain.model.PlanAnual.Opcion;
import co.com.srdejo.steward.domain.model.PlanAnual.Proyeccion;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.Tarjeta;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICierrePersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITarjetaPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.usecase.Registro.Contexto;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * El plan anual (spec steward-plan-anual, design D1 a D4 de backend-plan-anual y de anual-opciones-y-meses). Reproduce
 * {@code crearAnual}, {@code editarMontoAnual}, {@code agregarEvento}, {@code editarProyeccion}, {@code replicarMes},
 * {@code duplicarOpcionAnual}, {@code quitarOpcionAnual} y {@code crearOActualizarMeses} del dominio compartido. La
 * cuadricula y los KPI los calcula el cliente.
 */
public class AnualUseCase implements IAnualServicePort {

    static final String CATEGORIA_EVENTOS = "Eventos del año";
    private static final String COLOR_EVENTOS = "#5F625C";
    private static final int ORDEN_EVENTOS = 90;
    private static final String NOTA_DEL_ANUAL = "Del plan anual";

    private final IHogarPersistencePort hogares;
    private final IAnualPersistencePort anuales;
    private final ICategoriaPersistencePort categorias;
    private final IPlanPersistencePort planes;
    private final ICierrePersistencePort cierres;
    private final ITransaccionPort transaccion;
    private final IMovimientoPersistencePort movimientos;
    private final ICreditoPersistencePort creditos;
    private final ITarjetaPersistencePort tarjetas;
    private final Registro registro;
    private final NacimientoMes nacimiento;

    public AnualUseCase(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas, IAnualPersistencePort anuales,
                        ICategoriaPersistencePort categorias, IPlanPersistencePort planes, ICierrePersistencePort cierres,
                        IIngresoFijoPersistencePort ingresos, IReglaDiezmoPersistencePort reglas,
                        IMovimientoPersistencePort movimientos, ICurrentUserPort usuarioActual, ITransaccionPort transaccion,
                        IClockPort clock, ICreditoPersistencePort creditos, ITarjetaPersistencePort tarjetas) {
        this.hogares = hogares;
        this.anuales = anuales;
        this.categorias = categorias;
        this.planes = planes;
        this.cierres = cierres;
        this.transaccion = transaccion;
        this.movimientos = movimientos;
        this.creditos = creditos;
        this.tarjetas = tarjetas;
        this.registro = new Registro(hogares, cuentas, usuarioActual, clock);
        this.nacimiento = new NacimientoMes(ingresos, reglas, anuales, movimientos, planes);
    }

    @Override
    public Mono<PlanAnual> crear(int anio) {
        if (anio < registro.mesEnCurso().getYear()) {
            return Mono.error(DomainException.datosInvalidos("El plan anual es del año en curso o uno futuro"));
        }
        return registro.contexto().flatMap(ctx -> anuales.crear(nuevo(ctx, anio)));
    }

    /** Un anual vacio con su Opcion A a nombre de quien lo crea. */
    private static PlanAnual nuevo(Contexto ctx, int anio) {
        return new PlanAnual(UUID.randomUUID(), ctx.hogar().id(), anio, PlanAnual.Estado.BORRADOR,
                List.of(new Opcion(UUID.randomUUID(), "A", ctx.usuario(), "", List.of(), List.of(), null)), null);
    }

    @Override
    public Mono<Void> ponerCelda(int anio, UUID opcionId, UUID categoriaId, int mes, long monto) {
        if (mes < 1 || mes > 12 || monto < 0) {
            return Mono.error(DomainException.datosInvalidos("Revisa el mes y el monto"));
        }
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                .flatMap(a -> opcion(a, opcionId).flatMap(op -> categorias.porIdEnHogar(categoriaId, ctx.hogar().id())
                        .switchIfEmpty(Mono.error(PlanUseCase::categoriaNoEncontrada))
                        // La fila Diezmo del anual se calcula con las reglas (design D2 de diezmo-como-gasto).
                        .flatMap(c -> c.tipo() == Categoria.Tipo.DIEZMO
                                ? Mono.<Void>error(DomainException.datosInvalidos("El diezmo del año se calcula con las reglas"))
                                : anuales.ponerCelda(a.id(), op.id(), categoriaId, mes, monto)))));
    }

    @Override
    public Mono<Evento> agregarEvento(int anio, UUID opcionId, String nombre, int mes, long monto, String tipo, UUID usuarioId,
                                      UUID categoriaId, boolean enAdelante) {
        return evento(UUID.randomUUID(), nombre, mes, monto, tipo, usuarioId, categoriaId, enAdelante)
                .flatMap(evento -> registro.contexto().flatMap(ctx -> anualDe(ctx, anio)
                        .flatMap(a -> opcion(a, opcionId).flatMap(op -> validarEvento(ctx, evento)
                                .then(anuales.agregarEvento(a.id(), op.id(), evento))))));
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

    @Override
    public Mono<Opcion> duplicarOpcion(int anio, UUID desdeId) {
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio).flatMap(a -> opcion(a, desdeId).flatMap(origen -> {
            Optional<String> letra = a.siguienteLetra();
            if (letra.isEmpty()) {
                return Mono.error(DomainException.conflicto("MUCHAS_OPCIONES", "No caben más opciones en este año"));
            }
            Opcion nueva = new Opcion(UUID.randomUUID(), letra.get(), ctx.usuario(), "", origen.celdas(),
                    origen.eventos().stream().map(e -> new Evento(UUID.randomUUID(), e.nombre(), e.mes(), e.monto(), e.tipo(),
                            e.usuarioId(), e.categoriaId(), e.enAdelante())).toList(),
                    origen.base());
            return transaccion.enTransaccion(anuales.crearOpcion(a.id(), nueva));
        })));
    }

    @Override
    public Mono<Void> quitarOpcion(int anio, UUID opcionId) {
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio).flatMap(a -> opcion(a, opcionId).flatMap(op -> {
            if (a.opciones().size() == 1 || op.id().equals(a.opcionEnUso())) {
                return Mono.error(DomainException.conflicto("OPCION_EN_USO", a.opciones().size() == 1
                        ? "El año necesita al menos una opción" : "Esa opción está en uso; los meses salieron de ella"));
            }
            return anuales.quitarOpcion(op.id());
        })));
    }

    private static DomainException eventoNoEncontrado() {
        return DomainException.noEncontrado("EVENTO_NO_ENCONTRADO", "Ese cambio ya no está");
    }

    /** La opcion pedida del año, o la en uso (o la A) sin id; un id ajeno da {@code OPCION_NO_ENCONTRADA}. */
    private static Mono<Opcion> opcion(PlanAnual a, UUID opcionId) {
        return Mono.justOrEmpty(a.opcion(opcionId))
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("OPCION_NO_ENCONTRADA", "Esa opción no es de este año")));
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

    // --- Creditos por mes (design D3 y D4 de anual-opciones-y-meses) -------------------------------------------------

    /** Los creditos del hogar y cuales ya pagaron la cuota del mes en curso. */
    private record Creditos(Map<UUID, Credito> porId, Set<UUID> pagadosEsteMes, YearMonth mesEnCurso) {

        boolean pagaEnMes(Credito c, YearMonth ref) {
            return Amortizacion.pagaEnMes(c, ref, mesEnCurso, pagadosEsteMes.contains(c.id()));
        }
    }

    private Mono<Creditos> creditos(UUID hogar) {
        YearMonth mes = registro.mesEnCurso();
        return Mono.zip(
                        creditos.delHogar(hogar).collectMap(Credito::id),
                        movimientos.delMes(hogar, mes)
                                .filter(m -> m.tipo() == Movimiento.Tipo.PAGO && m.creditoId() != null)
                                .map(Movimiento::creditoId).collect(HashSet<UUID>::new, Set::add))
                .map(t -> new Creditos(t.getT1(), t.getT2(), mes));
    }

    /**
     * Si un item de la plantilla sigue en {@code ref} ({@code siguePagando} del dominio): el de un credito, mientras pague
     * una cuota ese mes; el de una compra a cuotas vieja, mientras no pase de su total.
     */
    private static boolean siguePagando(ItemPlan i, Creditos cr, YearMonth base, YearMonth ref) {
        if (i.creditoId() != null && !i.nombre().startsWith("Abono")) {
            Credito c = cr.porId().get(i.creditoId());
            if (c != null) {
                return cr.pagaEnMes(c, ref);
            }
        }
        if (i.cuotaActual() != null && i.cuotaTotal() != null && base != null) {
            return i.cuotaActual() + ChronoUnit.MONTHS.between(base, ref) <= i.cuotaTotal();
        }
        return true;
    }

    /**
     * replicarMes del dominio (design D1 y D2 de planear-anio-desde-un-mes, D4 de anual-opciones-y-meses): por categoria
     * (salvo Diezmo y "Eventos del año"), el total de la opcion principal del mes base en cada mes, sin la cuota de los
     * creditos que ya no pagan ese mes; con FIJOS, el ultimo plan antes del año sin sus items variables. Los aportes
     * proyectados de cada miembro: lo que registro en el mes base, o su proyeccion de ese mes. Ya no se bloquea con los
     * meses creados.
     */
    @Override
    public Mono<PlanAnual> replicar(int anio, String tipo, YearMonth base, UUID opcionId) {
        if (anio < registro.mesEnCurso().getYear()) {
            return Mono.error(DomainException.datosInvalidos("El plan anual es del año en curso o uno futuro"));
        }
        if (!"MES".equals(tipo) && !"FIJOS".equals(tipo) && !"CERO".equals(tipo) || "MES".equals(tipo) && base == null) {
            return Mono.error(DomainException.datosInvalidos("La base es un mes, FIJOS o CERO"));
        }
        return registro.contexto().flatMap(ctx -> {
            UUID hogar = ctx.hogar().id();
            Mono<Optional<PlanMes>> origen = switch (tipo) {
                case "MES" -> planes.deMes(hogar, base).map(Optional::of)
                        .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("PLAN_NO_ENCONTRADO", "Ese mes no tiene plan")));
                case "FIJOS" -> planes.ultimoAntesDe(hogar, YearMonth.of(anio, 1)).map(Optional::of).defaultIfEmpty(Optional.empty());
                default -> Mono.just(Optional.empty());
            };
            return origen.flatMap(plan -> Mono.zip(
                            anuales.deAnio(hogar, anio).map(Optional::of).defaultIfEmpty(Optional.empty()),
                            categorias.delHogar(hogar).collectList(),
                            aportesBase(ctx, plan.map(PlanMes::ref).filter(r -> "MES".equals(tipo))),
                            creditos(hogar))
                    .flatMap(t -> {
                        if (t.getT1().isPresent() && opcionId != null && t.getT1().get().buscar(opcionId).isEmpty()) {
                            return Mono.error(DomainException.noEncontrado("OPCION_NO_ENCONTRADA", "Esa opción no es de este año"));
                        }
                        YearMonth ref = plan.map(PlanMes::ref).orElse(null);
                        List<ItemPlan> items = plan.map(PlanMes::principal).map(Escenario::items).orElse(List.of()).stream()
                                .filter(i -> i.tipo() != ItemPlan.Tipo.DIEZMO && !("FIJOS".equals(tipo) && i.tipo() == ItemPlan.Tipo.VARIABLE))
                                .toList();
                        List<Celda> celdas = new ArrayList<>();
                        for (Categoria c : t.getT2()) {
                            List<ItemPlan> deCategoria = items.stream().filter(i -> i.categoriaId().equals(c.id())).toList();
                            long monto = deCategoria.stream().mapToLong(ItemPlan::monto).sum();
                            if (c.tipo() == Categoria.Tipo.DIEZMO || c.nombre().equals(CATEGORIA_EVENTOS) || monto <= 0) {
                                continue;
                            }
                            for (int mes = 1; mes <= 12; mes++) {
                                YearMonth delMes = YearMonth.of(anio, mes);
                                long sinTerminados = monto - deCategoria.stream().filter(i -> !siguePagando(i, t.getT4(), ref, delMes))
                                        .mapToLong(ItemPlan::monto).sum();
                                celdas.add(new Celda(c.id(), mes, sinTerminados));
                            }
                        }
                        List<Proyeccion> proyecciones = new ArrayList<>();
                        t.getT3().forEach((usuario, monto) -> {
                            for (int mes = 1; mes <= 12; mes++) {
                                proyecciones.add(new Proyeccion(usuario, anio, mes, monto));
                            }
                        });
                        Mono<PlanAnual> anual = t.getT1().map(Mono::just).orElseGet(() -> anuales.crear(nuevo(ctx, anio)));
                        return transaccion.enTransaccion(anual.flatMap(a -> opcion(a, opcionId)
                                .flatMap(op -> anuales.replicar(a.id(), op.id(), celdas, ref))
                                .then(anuales.reemplazarProyecciones(hogar, anio, proyecciones))
                                .then(anuales.deAnio(hogar, anio))));
                    }));
        });
    }

    /** Por miembro: sus aportes registrados en el mes base o, si no registro, su proyeccion de ese mes. */
    private Mono<Map<UUID, Long>> aportesBase(Contexto ctx, Optional<YearMonth> ref) {
        if (ref.isEmpty()) {
            return Mono.just(Map.of());
        }
        UUID hogar = ctx.hogar().id();
        YearMonth mes = ref.get();
        return Mono.zip(
                        hogares.miembros(hogar).map(m -> m.usuario().id()).collectList(),
                        movimientos.delMes(hogar, mes).filter(m -> m.tipo() == Movimiento.Tipo.APORTE).collectList(),
                        anuales.proyeccionesDesde(hogar, mes.getYear())
                                .filter(p -> p.anio() == mes.getYear() && p.mes() == mes.getMonthValue()).collectList())
                .map(t -> {
                    Map<UUID, Long> porMiembro = new java.util.LinkedHashMap<>();
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

    // --- Meses con la Opcion X (design D3 de anual-opciones-y-meses) -------------------------------------------------

    /** Lo que se necesita para armar los meses: la plantilla, las categorias, los creditos y las tarjetas del hogar. */
    private record Insumos(List<ItemPlan> plantilla, YearMonth base, List<Categoria> categorias, Creditos creditos, List<Tarjeta> tarjetas) {
    }

    /**
     * crearOActualizarMeses del dominio: cada mes sin plan ni cierre se crea; los de {@code actualizar} (sin pagos, gastos
     * ni ingresos recibidos, y sin cierre) se reemplazan por la columna de la opcion, conservando su estado. Todo en una
     * transaccion; la opcion queda en uso y el anual, Creado.
     */
    @Override
    public Mono<List<MesDelAnual>> meses(int anio, UUID opcionId, List<Integer> actualizar) {
        List<Integer> pedidos = actualizar == null ? List.of() : actualizar;
        if (pedidos.stream().anyMatch(m -> m == null || m < 1 || m > 12)) {
            return Mono.error(DomainException.datosInvalidos("Los meses van de 1 a 12"));
        }
        return registro.contexto().flatMap(ctx -> anualDe(ctx, anio).flatMap(anual -> opcion(anual, opcionId).flatMap(op -> {
            UUID hogar = ctx.hogar().id();
            Mono<PlanMes> origen = op.base() != null ? planes.deMes(hogar, op.base()) : planes.ultimoAntesDe(hogar, YearMonth.of(anio, 1));
            return Mono.zip(
                            origen.map(Optional::of).defaultIfEmpty(Optional.empty()),
                            categorias.delHogar(hogar).collectList(),
                            creditos(hogar),
                            tarjetas.delHogar(hogar).collectList())
                    .flatMap(t -> {
                        List<ItemPlan> plantilla = t.getT1().map(PlanMes::principal).map(Escenario::items).orElse(List.of()).stream()
                                .filter(i -> i.tipo() != ItemPlan.Tipo.DIEZMO).toList();
                        YearMonth base = op.base() != null ? op.base() : t.getT1().map(PlanMes::ref).orElse(null);
                        Insumos insumos = new Insumos(plantilla, base, t.getT2(), t.getT3(), t.getT4());
                        return Flux.range(1, 12).concatMap(mes -> estadoDelMes(hogar, YearMonth.of(anio, mes)))
                                .collectList()
                                .flatMap(estados -> {
                                    for (int mes : pedidos) {
                                        if (estados.get(mes - 1).bloqueado()) {
                                            return Mono.error(DomainException.conflicto("MES_CON_REGISTROS",
                                                    "Ese mes tiene registros o está cerrado; no se actualiza"));
                                        }
                                    }
                                    return transaccion.enTransaccion(categoriaEventos(ctx, op, t.getT2())
                                            .flatMap(eventosCat -> Flux.fromIterable(estados)
                                                    .concatMap(e -> llevarMes(ctx, anual, op, e, pedidos.contains(e.ref().getMonthValue()),
                                                            insumos, eventosCat.orElse(null)))
                                                    .collectList())
                                            .flatMap(hechos -> anuales.usarOpcion(anual.id(), op.id()).thenReturn(hechos)));
                                });
                    });
        })));
    }

    /** Como esta un mes: su plan (si tiene) y si tiene registros o cierre. */
    private record EstadoMes(YearMonth ref, PlanMes plan, boolean bloqueado) {
    }

    private Mono<EstadoMes> estadoDelMes(UUID hogar, YearMonth ref) {
        return Mono.zip(
                        planes.deMes(hogar, ref).map(Optional::of).defaultIfEmpty(Optional.empty()),
                        cierres.estaCerrado(hogar, ref),
                        movimientos.delMes(hogar, ref).any(m -> m.tipo() == Movimiento.Tipo.PAGO || m.tipo() == Movimiento.Tipo.GASTO
                                || m.tipo() == Movimiento.Tipo.INGRESO_FIJO))
                .map(t -> new EstadoMes(ref, t.getT1().orElse(null),
                        t.getT2() || t.getT3() || t.getT1().map(p -> p.estado() == PlanMes.Estado.CERRADO).orElse(false)));
    }

    /** Crea el mes si no tiene plan, o lo reemplaza si se pidio y se puede; si no, no lo toca. */
    private Mono<MesDelAnual> llevarMes(Contexto ctx, PlanAnual anual, Opcion op, EstadoMes e, boolean actualizar, Insumos ins,
                                        UUID eventosCat) {
        if (e.bloqueado() || (e.plan() != null && !actualizar)) {
            return Mono.empty();
        }
        PlanMes anterior = e.plan();
        UUID planId = UUID.randomUUID();
        UUID escId = UUID.randomUUID();
        return nacimiento.fuentes(ctx.hogar().id(), e.ref(), op.id()).flatMap(fuentes -> {
            List<ItemPlan> items = itemsDelMes(op, e.ref(), ins, escId, eventosCat);
            List<IngresoPlan> lineas = NacimientoMes.lineas(escId, fuentes);
            items.addAll(NacimientoMes.diezmos(escId, NacimientoMes.categoriaDiezmo(ins.categorias()), fuentes, items, lineas));
            boolean activo = anterior != null && (anterior.estado() == PlanMes.Estado.ACTIVO || anterior.escenarioActivoId() != null);
            PlanMes plan = new PlanMes(planId, ctx.hogar().id(), e.ref(),
                    anterior != null && anterior.estado() == PlanMes.Estado.ACTIVO ? PlanMes.Estado.ACTIVO : PlanMes.Estado.BORRADOR,
                    activo ? escId : null,
                    List.of(new Escenario(escId, planId, "A", ctx.usuario(), NOTA_DEL_ANUAL, false, lineas, items)));
            Mono<Void> quitar = anterior == null ? Mono.empty() : planes.borrar(anterior.id());
            return quitar.then(planes.crear(plan))
                    .thenReturn(new MesDelAnual(e.ref(), anterior == null ? MesDelAnual.Accion.CREADO : MesDelAnual.Accion.ACTUALIZADO))
                    // Si otra persona lo creo a la vez, ese mes ya tiene plan.
                    .onErrorResume(DomainException.class, ex -> "YA_EXISTE".equals(ex.codigo()) ? Mono.empty() : Mono.error(ex));
        });
    }

    /**
     * Los items de un mes desde la columna de la opcion ({@code itemsDelMes} del dominio): la plantilla del mes (creditos que
     * siguen, compras a cuotas avanzadas, lineas de tarjeta), ajustada a cada categoria con celdas; las categorias sin celdas
     * tal cual si la opcion tiene mes base; los eventos de gasto; y la cuota de los creditos sin item que pagan ese mes.
     */
    private static List<ItemPlan> itemsDelMes(Opcion op, YearMonth ref, Insumos ins, UUID escId, UUID eventosCat) {
        long meses = ins.base() == null ? 0 : ChronoUnit.MONTHS.between(ins.base(), ref);
        List<ItemPlan> delMes = ins.plantilla().stream()
                .filter(i -> siguePagando(i, ins.creditos(), ins.base(), ref))
                .map(i -> i.copia(UUID.randomUUID(), escId, i.monto(), i.cuotaActual() == null ? null : (int) (i.cuotaActual() + meses), i.orden()))
                .toList();
        List<ItemPlan> plantilla = TarjetasUseCase.conTarjetas(delMes, escId, ins.tarjetas(), ins.categorias());
        Set<UUID> conCeldas = new HashSet<>();
        op.celdas().forEach(c -> conCeldas.add(c.categoriaId()));
        List<ItemPlan> items = new ArrayList<>();
        // "Eventos del año" no sale de la plantilla: sus gastos son los eventos de cada mes.
        for (Categoria c : ins.categorias().stream().filter(x -> x.tipo() != Categoria.Tipo.DIEZMO && !x.nombre().equals(CATEGORIA_EVENTOS))
                .sorted(Comparator.comparingInt(Categoria::orden)).toList()) {
            List<ItemPlan> deCategoria = plantilla.stream().filter(i -> i.categoriaId().equals(c.id())).toList();
            if (!conCeldas.contains(c.id())) {
                // Una categoria sin fila trae lo del mes base, si la opcion tiene uno.
                if (op.base() != null) {
                    deCategoria.forEach(i -> items.add(i.copia(i.id(), escId, i.monto(), i.cuotaActual(), items.size() + 1)));
                }
                continue;
            }
            long monto = op.celdas().stream().filter(x -> x.categoriaId().equals(c.id()) && x.mes() == ref.getMonthValue())
                    .mapToLong(Celda::monto).sum();
            long base = deCategoria.stream().mapToLong(ItemPlan::monto).sum();
            // Los items no son negativos: si la columna es menor que lo copiado, la categoria entra como un solo item por la
            // columna (design D4 de backend-plan-anual).
            if (monto < base) {
                if (monto > 0) {
                    items.add(item(escId, c.id(), c.nombre(), monto, items.size()));
                }
                continue;
            }
            deCategoria.forEach(i -> items.add(i.copia(i.id(), escId, i.monto(), i.cuotaActual(), items.size() + 1)));
            if (monto > base) {
                items.add(item(escId, c.id(), deCategoria.isEmpty() ? c.nombre() : "Ajuste del plan anual", monto - base, items.size()));
            }
        }
        // Cada gasto que toca el mes, en su categoria o en "Eventos del año" (design D3 de planear-anio-desde-un-mes).
        for (Evento e : op.eventos()) {
            if (e.tipo() != Evento.Tipo.GASTO || !e.aplica(ref.getMonthValue())) {
                continue;
            }
            boolean enEventos = enEventos(e, ins.categorias());
            boolean variable = !enEventos && ins.categorias().stream().anyMatch(c -> c.id().equals(e.categoriaId()) && c.tipo() == Categoria.Tipo.VARIABLE);
            items.add(new ItemPlan(UUID.randomUUID(), escId, enEventos ? eventosCat : e.categoriaId(), e.nombre(), e.monto(), null,
                    variable ? ItemPlan.Tipo.VARIABLE : ItemPlan.Tipo.FIJO, null, null, items.size() + 1));
        }
        // La cuota de los creditos sin item que pagan ese mes.
        Set<UUID> enlazados = new HashSet<>();
        items.forEach(i -> enlazados.add(i.creditoId()));
        for (Credito cr : ins.creditos().porId().values().stream().sorted(Comparator.comparing(Credito::nombre)).toList()) {
            if (!enlazados.contains(cr.id()) && ins.creditos().pagaEnMes(cr, ref)) {
                items.add(PlanUseCase.cuotaDe(cr, escId, CuentasUseCase.categoriaDeCreditos(ins.categorias()), items.size() + 1));
            }
        }
        return items;
    }

    private Mono<Optional<UUID>> categoriaEventos(Contexto ctx, Opcion op, List<Categoria> cats) {
        if (op.eventos().stream().noneMatch(e -> e.tipo() == Evento.Tipo.GASTO && enEventos(e, cats))) {
            return Mono.just(Optional.empty());
        }
        return cats.stream().filter(c -> c.nombre().equals(CATEGORIA_EVENTOS)).findFirst()
                .map(c -> Mono.just(Optional.of(c.id())))
                .orElseGet(() -> categorias.crear(new Categoria(UUID.randomUUID(), ctx.hogar().id(), CATEGORIA_EVENTOS, COLOR_EVENTOS,
                        ORDEN_EVENTOS, Categoria.Tipo.OTRO, false)).map(c -> Optional.of(c.id())));
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
