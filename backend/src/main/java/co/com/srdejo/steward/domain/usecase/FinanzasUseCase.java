package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IFinanzasServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.DiezmoEnHoy;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.ObligacionDiezmo;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IReglaDiezmoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Finanzas del hogar de la sesion (spec steward-finanzas). Reproduce las reglas del dominio compartido: "Recibi"
 * ({@code marcarRecibido}), las obligaciones ({@code diezmosPendientes}, con la regla actual del dueno, design D3) y
 * "Entregado" ({@code entregarDiezmo}). El mes es siempre el en curso del backend (design D4).
 */
public class FinanzasUseCase implements IFinanzasServicePort {

    private static final BigDecimal CIEN = BigDecimal.valueOf(100);

    private final IHogarPersistencePort hogares;
    private final IReglaDiezmoPersistencePort reglas;
    private final IIngresoFijoPersistencePort ingresos;
    private final ICuentaPersistencePort cuentas;
    private final IMovimientoPersistencePort movimientos;
    private final ICurrentUserPort usuarioActual;
    private final ITransaccionPort transaccion;
    private final IClockPort clock;

    public FinanzasUseCase(IHogarPersistencePort hogares, IReglaDiezmoPersistencePort reglas,
                           IIngresoFijoPersistencePort ingresos, ICuentaPersistencePort cuentas,
                           IMovimientoPersistencePort movimientos, ICurrentUserPort usuarioActual,
                           ITransaccionPort transaccion, IClockPort clock) {
        this.hogares = hogares;
        this.reglas = reglas;
        this.ingresos = ingresos;
        this.cuentas = cuentas;
        this.movimientos = movimientos;
        this.usuarioActual = usuarioActual;
        this.transaccion = transaccion;
        this.clock = clock;
    }

    // --- Lectura ---------------------------------------------------------------------------------------------------

    @Override
    public Mono<Finanzas> leer() {
        YearMonth mes = mesEnCurso();
        return contexto().flatMap(ctx -> Mono.zip(
                        hogares.diezmoEnHoy(ctx.hogar().id()).defaultIfEmpty(DiezmoEnHoy.SEPARADO),
                        ingresos.delHogar(ctx.hogar().id()).filter(IngresoFijo::activo).collectList(),
                        cuentas.delHogar(ctx.hogar().id()).collectList(),
                        movimientos.delMes(ctx.hogar().id(), mes).collectList(),
                        hogares.miembros(ctx.hogar().id()).map(m -> m.usuario().id()).collectList())
                .flatMap(t -> {
                    // Las reglas de los miembros y de los duenos de lo recibido este mes (aunque ya no esten).
                    Set<UUID> personas = new HashSet<>(t.getT5());
                    t.getT4().forEach(m -> personas.add(m.usuarioId()));
                    return reglas.dePersonas(personas).collectList()
                            .map(r -> new Finanzas(mes, t.getT1(), t.getT2(), r, t.getT3(), t.getT4()));
                }));
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
        if (cuentaId == null) {
            return Mono.empty();
        }
        return cuentas.porIdEnHogar(cuentaId, hogarId)
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("CUENTA_NO_ENCONTRADA", "Esa cuenta no existe")))
                .then();
    }

    // --- Recibir y diezmo -------------------------------------------------------------------------------------------

    @Override
    public Mono<Movimiento> recibir(UUID ingresoId) {
        return contexto().flatMap(ctx -> ingresos.porIdEnHogar(ingresoId, ctx.hogar().id())
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
        return contexto().flatMap(ctx -> cuentaDelHogar(cuentaId, ctx.hogar().id())
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
                    .filter(m -> m.tipo() == Movimiento.Tipo.INGRESO_FIJO && m.aplicaDiezmo() && !entregadas.contains(m.id()))
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
        return YearMonth.from(clock.hoy());
    }

    private Mono<Contexto> contexto() {
        return usuarioActual.usuarioId().flatMap(usuario -> hogares.hogarDe(usuario)
                .switchIfEmpty(Mono.error(HogarUseCase::sinHogar))
                .map(hogar -> new Contexto(usuario, hogar)));
    }

    static DomainException ingresoNoEncontrado() {
        return DomainException.noEncontrado("INGRESO_NO_ENCONTRADO", "Ese ingreso no existe");
    }

    static DomainException sinDiezmo() {
        return DomainException.conflicto("SIN_DIEZMO", "No hay diezmo pendiente");
    }

    private record Contexto(UUID usuario, Hogar hogar) {
    }
}
