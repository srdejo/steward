package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IFinanzasServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.CierreMes;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.DiezmoEnHoy;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.ObligacionDiezmo;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.IAnualPersistencePort;
import co.com.srdejo.steward.domain.spi.ICierrePersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.usecase.Registro.Contexto;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Finanzas del hogar de la sesion (spec steward-finanzas). Reproduce las reglas del dominio compartido: "Recibi"
 * ({@code marcarRecibido}), las obligaciones ({@code diezmosPendientes}, con la regla actual del dueno, design D3) y
 * "Entregado" ({@code entregarDiezmo}), y los registros de Hoy: {@code marcarPago}, {@code registrarGasto} y
 * {@code registrarAporte}. Pagos y gastos son del mes en curso del backend; los aportes, de este mes o el siguiente. Las
 * vistas (libre, vs. plan, aportes implicitos) las calcula el cliente con el dominio compartido (design D3). Pagar la cuota
 * de un credito baja su saldo (design D4 de backend-cuentas-creditos).
 */
public class FinanzasUseCase implements IFinanzasServicePort {

    private static final BigDecimal CIEN = BigDecimal.valueOf(100);

    private final IHogarPersistencePort hogares;
    private final IReglaDiezmoPersistencePort reglas;
    private final IIngresoFijoPersistencePort ingresos;
    private final ICuentaPersistencePort cuentas;
    private final IMovimientoPersistencePort movimientos;
    private final ICategoriaPersistencePort categorias;
    private final IPlanPersistencePort planes;
    private final ICreditoPersistencePort creditos;
    private final ICierrePersistencePort cierres;
    private final IAnualPersistencePort anuales;
    private final IUsuarioPersistencePort usuarios;
    private final ICurrentUserPort usuarioActual;
    private final ITransaccionPort transaccion;
    private final IClockPort clock;
    private final Registro registro;

    public FinanzasUseCase(IHogarPersistencePort hogares, IReglaDiezmoPersistencePort reglas,
                           IIngresoFijoPersistencePort ingresos, ICuentaPersistencePort cuentas,
                           IMovimientoPersistencePort movimientos, ICategoriaPersistencePort categorias,
                           IPlanPersistencePort planes, ICreditoPersistencePort creditos, ICierrePersistencePort cierres,
                           IAnualPersistencePort anuales, IUsuarioPersistencePort usuarios, ICurrentUserPort usuarioActual, ITransaccionPort transaccion,
                           IClockPort clock) {
        this.hogares = hogares;
        this.reglas = reglas;
        this.ingresos = ingresos;
        this.cuentas = cuentas;
        this.movimientos = movimientos;
        this.categorias = categorias;
        this.planes = planes;
        this.creditos = creditos;
        this.cierres = cierres;
        this.anuales = anuales;
        this.usuarios = usuarios;
        this.usuarioActual = usuarioActual;
        this.transaccion = transaccion;
        this.clock = clock;
        this.registro = new Registro(hogares, cuentas, usuarioActual, clock);
    }

    // --- Lectura ---------------------------------------------------------------------------------------------------

    /**
     * Planes y movimientos desde dos meses antes del mes en curso: los que muestra la app (design D4), mas lo que todavia
     * cuenta en el saldo estimado de una cuenta (design D2 de backend-cuentas-creditos).
     */
    @Override
    public Mono<Finanzas> leer() {
        YearMonth mes = mesEnCurso();
        YearMonth desde = mes.minusMonths(2);
        return contexto().flatMap(ctx -> Mono.zip(
                        hogares.diezmoEnHoy(ctx.hogar().id()).defaultIfEmpty(DiezmoEnHoy.SEPARADO),
                        ingresos.delHogar(ctx.hogar().id()).filter(IngresoFijo::activo).collectList(),
                        cuentas.delHogar(ctx.hogar().id()).collectList(),
                        movimientos.desde(ctx.hogar().id(), desde).collectList(),
                        hogares.miembros(ctx.hogar().id()).map(m -> m.usuario().id()).collectList(),
                        categorias.delHogar(ctx.hogar().id()).collectList(),
                        // El estado que se lee es el efectivo: un Borrador elegido pasa a Activo al llegar su mes.
                        planes.desde(ctx.hogar().id(), desde)
                                .map(p -> new PlanMes(p.id(), p.hogarId(), p.ref(), p.estadoEn(clock.hoy()),
                                        p.escenarioActivoId(), p.escenarios()))
                                .collectList(),
                        creditosConPagos(ctx.hogar().id()))
                .zipWith(Mono.zip(cierres.desde(ctx.hogar().id(), desde.minusMonths(1)).collectList(),
                        anuales.desde(ctx.hogar().id(), desde.getYear()).collectList(),
                        anuales.proyeccionesDesde(ctx.hogar().id(), desde.getYear()).collectList()))
                .flatMap(tc -> {
                    var t = tc.getT1();
                    List<CierreMes> cierresLeidos = tc.getT2().getT1();
                    // Las reglas de los miembros y de los duenos de lo registrado (aunque ya no esten).
                    Set<UUID> personas = new HashSet<>(t.getT5());
                    t.getT4().forEach(m -> personas.add(m.usuarioId()));
                    return reglas.dePersonas(personas).collectList()
                            .map(r -> new Finanzas(mes, t.getT1(), t.getT6(), t.getT2(), r, t.getT3(), t.getT7(), t.getT4(),
                                    t.getT8(), cierresLeidos, tc.getT2().getT2(), tc.getT2().getT3()));
                }));
    }

    /** Los creditos con sus ultimos pagos, que salen de lo registrado (design D4 de backend-cuentas-creditos). */
    private Mono<List<Credito>> creditosConPagos(UUID hogarId) {
        return movimientos.ultimosDeCreditos(hogarId, Credito.ULTIMOS_PAGOS)
                .collectMultimap(Movimiento::creditoId)
                .flatMap(pagos -> creditos.delHogar(hogarId)
                        .map(c -> c.conPagos(pagos.getOrDefault(c.id(), List.of()).stream()
                                .map(m -> new Credito.Pago(m.fecha(), m.monto(), m.tipo() == Movimiento.Tipo.ABONO_CREDITO
                                        ? Credito.Pago.Tipo.ABONO : Credito.Pago.Tipo.CUOTA))
                                .toList()))
                        .collectList());
    }

    // --- Registros de Hoy -------------------------------------------------------------------------------------------

    @Override
    public Mono<Movimiento> pagar(UUID itemId, long monto, UUID usuarioId, String origen, UUID cuentaId) {
        YearMonth mes = mesEnCurso();
        return Mono.fromCallable(() -> Registro.montoValido(monto, "El valor pagado debe ser mayor que cero"))
                .flatMap(m -> contexto().flatMap(ctx -> itemDelMes(ctx, mes, itemId)
                        .flatMap(item -> registro.origenValido(ctx, usuarioId, origen, cuentaId)
                                .flatMap(o -> {
                                    // Un variable acumula como gasto; un fijo, cuota o credito se paga una vez (marcarPago).
                                    boolean variable = item.tipo() == PlanMes.ItemPlan.Tipo.VARIABLE;
                                    Movimiento pago = new Movimiento(UUID.randomUUID(), ctx.hogar().id(),
                                            variable ? Movimiento.Tipo.GASTO : Movimiento.Tipo.PAGO, mes, m, clock.hoy(),
                                            usuarioId, ctx.usuario(), o.cuentaId(), null, null, false, List.of(), item.id(),
                                            "", o.origen());
                                    // La cuota de un credito baja su saldo en la parte de capital, en la misma
                                    // transaccion: si el pago no pasa (YA_PAGADO), el saldo no cambia.
                                    UUID credito = variable ? null : item.creditoId();
                                    Mono<Movimiento> registrar = (credito == null ? movimientos.registrar(pago)
                                            : transaccion.enTransaccion(movimientos.registrar(pago.conCredito(credito))
                                            .flatMap(g -> creditos.pagarCuota(credito, m).thenReturn(g))))
                                            .onErrorResume(DomainException.class, ex -> "YA_PAGADO".equals(ex.codigo())
                                                    ? yaPagado(item.id(), mes) : Mono.error(ex));
                                    return variable ? registrar : movimientos.pagoDe(item.id(), mes)
                                            .flatMap(previo -> yaPagado(previo).<Movimiento>then(Mono.empty()))
                                            .switchIfEmpty(registrar);
                                }))));
    }

    @Override
    public Mono<Movimiento> gastar(UUID itemId, long monto, String nota, UUID usuarioId, String origen, UUID cuentaId) {
        YearMonth mes = mesEnCurso();
        return Mono.fromCallable(() -> {
                    Registro.montoValido(monto, "El gasto debe ser mayor que cero");
                    String limpia = nota == null ? "" : nota.strip();
                    if (limpia.length() > NOTA_MAX) {
                        throw DomainException.datosInvalidos("La nota va hasta 120 caracteres");
                    }
                    return limpia;
                })
                .flatMap(limpia -> contexto().flatMap(ctx -> (itemId == null
                        // "No estaba planeado": sin item, pero el mes tampoco puede estar cerrado.
                        ? mesAbierto(ctx, mes).thenReturn(Optional.<UUID>empty())
                        : itemDelMes(ctx, mes, itemId).map(i -> Optional.of(i.id())))
                        .flatMap(item -> registro.origenValido(ctx, usuarioId, origen, cuentaId)
                                .flatMap(o -> movimientos.registrar(new Movimiento(UUID.randomUUID(), ctx.hogar().id(),
                                        Movimiento.Tipo.GASTO, mes, monto, clock.hoy(), usuarioId, ctx.usuario(), o.cuentaId(),
                                        null, null, false, List.of(), item.orElse(null), limpia, o.origen()))))));
    }

    @Override
    public Mono<Movimiento> aportar(UUID usuarioId, long monto, YearMonth mes, UUID cuentaId, boolean aplicaDiezmo) {
        YearMonth enCurso = mesEnCurso();
        return Mono.fromCallable(() -> {
                    Registro.montoValido(monto, "El aporte debe ser mayor que cero");
                    if (mes == null || !(mes.equals(enCurso) || mes.equals(enCurso.plusMonths(1)))) {
                        throw DomainException.datosInvalidos("El aporte es para este mes o el siguiente");
                    }
                    return mes;
                })
                .flatMap(ref -> contexto().flatMap(ctx -> mesAbierto(ctx, ref)
                        .then(registro.origenValido(ctx, usuarioId, cuentaId == null ? "NINGUNO" : "CUENTA", cuentaId))
                        .flatMap(o -> movimientos.registrar(new Movimiento(UUID.randomUUID(), ctx.hogar().id(),
                                Movimiento.Tipo.APORTE, ref, monto, clock.hoy(), usuarioId, ctx.usuario(), o.cuentaId(), null,
                                null, aplicaDiezmo, List.of(), null, "", o.origen())))));
    }

    private static final int NOTA_MAX = 120;

    /** El item tiene que estar en la opcion principal del plan del mes, y el mes no puede estar cerrado. */
    private Mono<PlanMes.ItemPlan> itemDelMes(Contexto ctx, YearMonth mes, UUID itemId) {
        return planes.deMes(ctx.hogar().id(), mes)
                .flatMap(plan -> plan.estado() == PlanMes.Estado.CERRADO ? Mono.error(PlanUseCase.mesCerrado())
                        : Mono.justOrEmpty(plan.principal()).flatMap(esc -> Mono.justOrEmpty(
                        esc.items().stream().filter(i -> i.id().equals(itemId)).findFirst())))
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("ITEM_NO_ENCONTRADO",
                        "Ese gasto no está en el plan del mes")));
    }

    /** Como asegurarAbierto del dominio: el plan del mes en CERRADO o el mes con su cierre (design D3 de backend-cierre-mes). */
    private Mono<Void> mesAbierto(Contexto ctx, YearMonth mes) {
        return cierres.estaCerrado(ctx.hogar().id(), mes)
                .flatMap(cerrado -> cerrado ? Mono.<Void>error(PlanUseCase.mesCerrado()) : Mono.empty());
    }

    private Mono<Movimiento> yaPagado(UUID itemId, YearMonth mes) {
        return movimientos.pagoDe(itemId, mes).flatMap(this::yaPagado);
    }

    /** "Ya lo pago {nombre} el {dd mmm}", como marcarPago del dominio. */
    private Mono<Movimiento> yaPagado(Movimiento previo) {
        return usuarios.porId(previo.usuarioId())
                .map(u -> u.nombre())
                .defaultIfEmpty("alguien")
                .flatMap(nombre -> Mono.error(DomainException.conflicto("YA_PAGADO",
                        "Ya lo pagó " + nombre + " el " + Formato.fechaCorta(previo.fecha()))));
    }

    // --- Regla de diezmo --------------------------------------------------------------------------------------------

    @Override
    public Mono<ReglaDiezmo> guardarRegla(boolean activa, BigDecimal porcentaje, String base, boolean aplicaAportes) {
        return Mono.fromCallable(() -> new ReglaDiezmo(null, activa, porcentajeValido(porcentaje), baseValida(base),
                        aplicaAportes))
                .flatMap(datos -> usuarioActual.usuarioId().flatMap(usuario -> reglas.guardar(
                        new ReglaDiezmo(usuario, datos.activa(), datos.porcentaje(), datos.base(), datos.aplicaAportes()))));
    }

    private static BigDecimal porcentajeValido(BigDecimal porcentaje) {
        if (porcentaje == null || porcentaje.signum() <= 0 || porcentaje.compareTo(CIEN) > 0
                || porcentaje.stripTrailingZeros().scale() > 2) {
            throw DomainException.datosInvalidos("El porcentaje va de 1 a 100, con hasta dos decimales");
        }
        return porcentaje;
    }

    private static ReglaDiezmo.Base baseValida(String base) {
        try {
            return ReglaDiezmo.Base.valueOf(base);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw DomainException.datosInvalidos("La base del diezmo es BRUTO o NETO");
        }
    }

    // --- Ingresos fijos ---------------------------------------------------------------------------------------------

    @Override
    public Mono<IngresoFijo> crearIngreso(DatosIngreso datos) {
        return Mono.fromCallable(() -> ingresoValido(datos)).flatMap(limpio -> contexto()
                .flatMap(ctx -> cuentaDelHogar(limpio.cuentaId(), ctx.hogar().id())
                        .then(ingresos.crear(new IngresoFijo(UUID.randomUUID(), ctx.hogar().id(), ctx.usuario(),
                                limpio.nombre(), limpio.bruto(), limpio.neto(), limpio.diaPago(), limpio.cuentaId(), true)))));
    }

    @Override
    public Mono<IngresoFijo> editarIngreso(UUID id, DatosIngreso datos) {
        return Mono.fromCallable(() -> ingresoValido(datos)).flatMap(limpio -> contexto()
                .flatMap(ctx -> ingresoPropio(id, ctx)
                        .flatMap(actual -> cuentaDelHogar(limpio.cuentaId(), ctx.hogar().id())
                                .then(ingresos.actualizar(new IngresoFijo(actual.id(), actual.hogarId(), actual.usuarioId(),
                                        limpio.nombre(), limpio.bruto(), limpio.neto(), limpio.diaPago(), limpio.cuentaId(),
                                        true))))));
    }

    @Override
    public Mono<Void> quitarIngreso(UUID id) {
        return contexto().flatMap(ctx -> ingresoPropio(id, ctx))
                .flatMap(actual -> ingresos.actualizar(new IngresoFijo(actual.id(), actual.hogarId(), actual.usuarioId(),
                        actual.nombre(), actual.bruto(), actual.neto(), actual.diaPago(), actual.cuentaId(), false)))
                .then();
    }

    /** Validaciones de {@code guardarIngresoFijo} del dominio, mas el largo del nombre. */
    private static DatosIngreso ingresoValido(DatosIngreso datos) {
        String nombre = datos.nombre() == null ? "" : datos.nombre().strip();
        if (nombre.isEmpty() || nombre.length() > IngresoFijo.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("El ingreso necesita un nombre de hasta 60 caracteres");
        }
        if (datos.neto() <= 0 || datos.bruto() < datos.neto()) {
            throw DomainException.datosInvalidos("El bruto debe ser mayor o igual al neto");
        }
        if (datos.diaPago() < 1 || datos.diaPago() > 31) {
            throw DomainException.datosInvalidos("El día de pago va de 1 a 31");
        }
        return new DatosIngreso(nombre, datos.bruto(), datos.neto(), datos.diaPago(), datos.cuentaId());
    }

    /** Activo, del hogar y de la persona de la sesion; si no, como si no existiera. */
    private Mono<IngresoFijo> ingresoPropio(UUID id, Contexto ctx) {
        return ingresos.porIdEnHogar(id, ctx.hogar().id())
                .filter(i -> i.activo() && i.usuarioId().equals(ctx.usuario()))
                .switchIfEmpty(Mono.error(FinanzasUseCase::ingresoNoEncontrado));
    }

    private Mono<Void> cuentaDelHogar(UUID cuentaId, UUID hogarId) {
        return registro.cuentaDelHogar(cuentaId, hogarId);
    }

    // --- Recibir y diezmo -------------------------------------------------------------------------------------------

    @Override
    public Mono<Movimiento> recibir(UUID ingresoId) {
        return contexto().flatMap(ctx -> mesAbierto(ctx, mesEnCurso()).then(ingresos.porIdEnHogar(ingresoId, ctx.hogar().id()))
                .filter(IngresoFijo::activo)
                .switchIfEmpty(Mono.error(FinanzasUseCase::ingresoNoEncontrado))
                .flatMap(ingreso -> reglas.dePersona(ingreso.usuarioId())
                        // Genera diezmo si el dueno tiene la regla activa al recibir, como marcarRecibido.
                        .map(ReglaDiezmo::activa)
                        .defaultIfEmpty(false)
                        .flatMap(aplica -> movimientos.registrarRecibido(new Movimiento(UUID.randomUUID(),
                                ctx.hogar().id(), Movimiento.Tipo.INGRESO_FIJO, mesEnCurso(), ingreso.neto(), clock.hoy(),
                                ingreso.usuarioId(), ctx.usuario(), ingreso.cuentaId(), ingreso.id(), ingreso.bruto(),
                                aplica, List.of())))));
    }

    @Override
    public Flux<ObligacionDiezmo> pendientes() {
        return contexto().flatMapMany(ctx -> pendientesDe(ctx.hogar().id()));
    }

    @Override
    public Mono<Movimiento> entregar(List<UUID> obligaciones, UUID cuentaId) {
        Set<UUID> pedidas = obligaciones == null ? Set.of() : Set.copyOf(obligaciones);
        return contexto().flatMap(ctx -> mesAbierto(ctx, mesEnCurso())
                .then(cuentaDelHogar(cuentaId, ctx.hogar().id()))
                .then(transaccion.enTransaccion(pendientesDe(ctx.hogar().id())
                        .filter(o -> pedidas.contains(o.id()))
                        .collectList()
                        .flatMap(cubre -> cubre.isEmpty() ? Mono.error(FinanzasUseCase::sinDiezmo)
                                : movimientos.registrarEntrega(new Movimiento(UUID.randomUUID(), ctx.hogar().id(),
                                        Movimiento.Tipo.DIEZMO_ENTREGADO, mesEnCurso(),
                                        cubre.stream().mapToLong(ObligacionDiezmo::monto).sum(), clock.hoy(), ctx.usuario(),
                                        ctx.usuario(), cuentaId, null, null, false,
                                        cubre.stream().map(ObligacionDiezmo::id).toList()))))));
    }

    /**
     * {@code diezmosPendientes} del dominio: cada ingreso recibido del mes que genero diezmo y no se entrego, con la
     * regla actual de su dueno (sin regla, no aparece).
     */
    private Flux<ObligacionDiezmo> pendientesDe(UUID hogarId) {
        return movimientos.delMes(hogarId, mesEnCurso()).collectList().flatMapMany(movs -> {
            Set<UUID> entregadas = movs.stream()
                    .filter(m -> m.tipo() == Movimiento.Tipo.DIEZMO_ENTREGADO)
                    .flatMap(m -> m.diezmoDe().stream())
                    .collect(Collectors.toSet());
            List<Movimiento> candidatos = movs.stream()
                    .filter(m -> (m.tipo() == Movimiento.Tipo.INGRESO_FIJO || m.tipo() == Movimiento.Tipo.APORTE)
                            && m.aplicaDiezmo() && !entregadas.contains(m.id()))
                    .toList();
            if (candidatos.isEmpty()) {
                return Flux.empty();
            }
            Set<UUID> duenos = candidatos.stream().map(Movimiento::usuarioId).collect(Collectors.toSet());
            return Mono.zip(
                            reglas.dePersonas(duenos).collectMap(ReglaDiezmo::usuarioId),
                            ingresos.delHogar(hogarId).collectMap(IngresoFijo::id, Function.identity()))
                    .flatMapMany(t -> Flux.fromIterable(candidatos)
                            .mapNotNull(m -> obligacion(m, t.getT1(), t.getT2())));
        });
    }

    private static ObligacionDiezmo obligacion(Movimiento m, Map<UUID, ReglaDiezmo> reglasPorDueno,
                                               Map<UUID, IngresoFijo> ingresosPorId) {
        ReglaDiezmo regla = reglasPorDueno.get(m.usuarioId());
        if (regla == null) {
            return null;
        }
        if (m.tipo() == Movimiento.Tipo.APORTE) {
            // Un aporte con diezmo: el porcentaje sobre el aporte, sin base (diezmosPendientes del dominio).
            return new ObligacionDiezmo(m.id(), CalculoDiezmo.sobre(regla.porcentaje(), m.monto()),
                    CalculoDiezmo.detalleAporte(regla.porcentaje(), m.fecha()), m.usuarioId(), m.fecha());
        }
        IngresoFijo ingreso = ingresosPorId.get(m.ingresoFijoId());
        long bruto = m.bruto() == null ? m.monto() : m.bruto();
        return new ObligacionDiezmo(m.id(), CalculoDiezmo.monto(regla.porcentaje(), bruto, m.monto(), regla.base()),
                CalculoDiezmo.detalle(regla.porcentaje(), ingreso == null ? "ingreso" : ingreso.nombre(), m.fecha()),
                m.usuarioId(), m.fecha());
    }

    @Override
    public Mono<Void> definirDiezmoEnHoy(String modo) {
        return Mono.fromCallable(() -> {
            try {
                return DiezmoEnHoy.valueOf(modo);
            } catch (IllegalArgumentException | NullPointerException ex) {
                throw DomainException.datosInvalidos("Diezmo en Hoy es SEPARADO o AGRUPADO");
            }
        }).flatMap(valor -> contexto().flatMap(ctx -> hogares.definirDiezmoEnHoy(ctx.hogar().id(), valor)));
    }

    // --- Cuentas ----------------------------------------------------------------------------------------------------

    @Override
    public Mono<Cuenta> crearCuenta(String nombre, boolean conjunta, long saldo) {
        String limpio = nombre == null ? "" : nombre.strip();
        if (limpio.isEmpty() || limpio.length() > Cuenta.NOMBRE_MAX) {
            return Mono.error(DomainException.datosInvalidos("La cuenta necesita un nombre de hasta 60 caracteres"));
        }
        if (saldo < 0) {
            return Mono.error(DomainException.datosInvalidos("El saldo aproximado no puede ser negativo"));
        }
        // Nace sin cuadrar, con el saldo aproximado como ultimo cuadre (agregarCuenta del dominio).
        return contexto().flatMap(ctx -> cuentas.crear(new Cuenta(UUID.randomUUID(), ctx.hogar().id(), limpio,
                conjunta ? null : ctx.usuario(), saldo, clock.hoy(), false)));
    }

    // --- Comun ------------------------------------------------------------------------------------------------------

    private YearMonth mesEnCurso() {
        return registro.mesEnCurso();
    }

    private Mono<Contexto> contexto() {
        return registro.contexto();
    }

    static DomainException ingresoNoEncontrado() {
        return DomainException.noEncontrado("INGRESO_NO_ENCONTRADO", "Ese ingreso no existe");
    }

    static DomainException sinDiezmo() {
        return DomainException.conflicto("SIN_DIEZMO", "No hay diezmo pendiente");
    }
}
