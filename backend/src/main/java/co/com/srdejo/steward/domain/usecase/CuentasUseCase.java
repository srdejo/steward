package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.ICuentasServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Amortizacion;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.usecase.Registro.Contexto;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cuadre, mover dinero y creditos (spec steward-finanzas, design D3 a D6 de backend-cuentas-creditos). Reproduce
 * {@code cuadrarCuentas}, {@code moverDinero}, {@code agregarCredito}, {@code actualizarSaldoCredito} y
 * {@code registrarAbono} del dominio compartido. El saldo estimado lo calcula la base con la misma tabla de efectos que el
 * dominio.
 */
public class CuentasUseCase implements ICuentasServicePort {

    private static final String GASTOS_SIN_REGISTRAR = "Gastos sin registrar";

    private final ICuentaPersistencePort cuentas;
    private final IMovimientoPersistencePort movimientos;
    private final ICreditoPersistencePort creditos;
    private final IPlanPersistencePort planes;
    private final ICategoriaPersistencePort categorias;
    private final ITransaccionPort transaccion;
    private final Registro registro;

    public CuentasUseCase(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas,
                          IMovimientoPersistencePort movimientos, ICreditoPersistencePort creditos,
                          IPlanPersistencePort planes, ICategoriaPersistencePort categorias, ICurrentUserPort usuarioActual,
                          ITransaccionPort transaccion, IClockPort clock) {
        this.cuentas = cuentas;
        this.movimientos = movimientos;
        this.creditos = creditos;
        this.planes = planes;
        this.categorias = categorias;
        this.transaccion = transaccion;
        this.registro = new Registro(hogares, cuentas, usuarioActual, clock);
    }

    // --- Cuadrar ----------------------------------------------------------------------------------------------------

    /**
     * Todas en una transaccion: si una cuenta no es del hogar, no se cuadra ninguna. Se bloquean en orden de id para que
     * dos cuadres a la vez no se esperen en cruz (design D3).
     */
    @Override
    public Mono<List<Cuenta>> cuadrar(List<SaldoBanco> saldos) {
        if (saldos == null || saldos.isEmpty()) {
            return Mono.error(DomainException.datosInvalidos("Escribe el saldo de al menos una cuenta"));
        }
        Map<UUID, Long> porCuenta = new LinkedHashMap<>();
        for (SaldoBanco s : saldos) {
            if (s == null || s.cuentaId() == null || s.saldoBanco() < 0) {
                return Mono.error(DomainException.datosInvalidos("El saldo del banco no puede ser negativo"));
            }
            porCuenta.put(s.cuentaId(), s.saldoBanco());
        }
        List<UUID> enOrden = porCuenta.keySet().stream().sorted(Comparator.naturalOrder()).toList();
        return registro.contexto().flatMap(ctx -> transaccion.enTransaccion(Flux.fromIterable(enOrden)
                        .concatMap(id -> cuadrarUna(ctx, id, porCuenta.get(id)))
                        .collectMap(Cuenta::id))
                .map(cuadradas -> porCuenta.keySet().stream().map(cuadradas::get).toList()));
    }

    private Mono<Cuenta> cuadrarUna(Contexto ctx, UUID cuentaId, long saldoBanco) {
        return cuentas.paraCuadrar(cuentaId, ctx.hogar().id())
                .switchIfEmpty(Mono.error(Registro::cuentaNoEncontrada))
                .flatMap(cuenta -> movimientos.saldoEstimado(cuenta).flatMap(estimado -> {
                    long diferencia = estimado.saldo() - saldoBanco;
                    // Positiva: salio dinero sin registrar; negativa: entro (cuadrarCuentas del dominio).
                    Mono<Long> seq = diferencia == 0 ? Mono.just(estimado.ultimoSeq())
                            : movimientos.registrar(new Movimiento(UUID.randomUUID(), ctx.hogar().id(),
                                    Movimiento.Tipo.AJUSTE_CUADRE, registro.mesEnCurso(), diferencia, registro.hoy(),
                                    ctx.usuario(), ctx.usuario(), cuenta.id(), null, null, false, List.of(), null,
                                    GASTOS_SIN_REGISTRAR, Movimiento.Origen.CUENTA)).map(Movimiento::seq);
                    return seq.flatMap(s -> cuentas.cuadrar(cuenta, saldoBanco, registro.hoy(), s));
                }));
    }

    // --- Mover dinero -----------------------------------------------------------------------------------------------

    @Override
    public Mono<Movimiento> transferir(UUID desde, UUID hacia, long monto) {
        return Mono.fromCallable(() -> {
                    if (desde == null || hacia == null) {
                        throw DomainException.datosInvalidos("Elige las dos cuentas");
                    }
                    if (desde.equals(hacia)) {
                        throw new DomainException(DomainException.Tipo.DATOS_INVALIDOS, "MISMA_CUENTA",
                                "Elige dos cuentas distintas");
                    }
                    return Registro.montoValido(monto, "El monto debe ser mayor que cero");
                })
                .flatMap(m -> registro.contexto().flatMap(ctx -> registro.cuentaDelHogar(desde, ctx.hogar().id())
                        .then(registro.cuentaDelHogar(hacia, ctx.hogar().id()))
                        .then(movimientos.registrar(new Movimiento(UUID.randomUUID(), ctx.hogar().id(),
                                Movimiento.Tipo.TRANSFERENCIA, registro.mesEnCurso(), m, registro.hoy(), ctx.usuario(),
                                ctx.usuario(), desde, null, null, false, List.of(), null, "", Movimiento.Origen.CUENTA,
                                hacia, null, null, null, 0)))));
    }

    // --- Eliminar ---------------------------------------------------------------------------------------------------

    @Override
    public Mono<Void> eliminar(UUID cuentaId) {
        if (cuentaId == null) {
            return Mono.error(Registro::cuentaNoEncontrada);
        }
        return registro.contexto().flatMap(ctx -> cuentas.porIdEnHogar(cuentaId, ctx.hogar().id())
                .switchIfEmpty(Mono.error(Registro::cuentaNoEncontrada))
                .flatMap(cuenta -> {
                    if (cuenta.titularId() != null && !cuenta.titularId().equals(ctx.usuario())) {
                        return Mono.error(new DomainException(DomainException.Tipo.CONFLICTO, "SOLO_TUYAS",
                                "Solo puedes eliminar tus cuentas o las conjuntas"));
                    }
                    return cuentas.eliminar(cuenta.id(), ctx.hogar().id());
                }));
    }

    // --- Creditos ---------------------------------------------------------------------------------------------------

    @Override
    public Mono<Credito> crearCredito(DatosCredito datos) {
        return Mono.fromCallable(() -> creditoValido(datos, registro.hoy())).flatMap(d -> registro.contexto().flatMap(ctx -> {
            Credito credito = new Credito(UUID.randomUUID(), ctx.hogar().id(), d.nombre(), d.entidad(), d.saldo(),
                    d.saldoActualizadoEn(), d.cuota(), d.tasaEm(), d.diaPago(), d.totalOriginal(), List.of(), d.metodo(),
                    d.numeroCuotas(), d.cuotasPagadas(), d.valorFinanciado());
            return transaccion.enTransaccion(creditos.crear(credito)
                    .flatMap(c -> cuotaEnElMes(ctx, c).thenReturn(c)));
        }));
    }

    /** Su cuota entra a la opcion principal del mes en curso, si tiene plan y no esta cerrado (design D5). */
    private Mono<Void> cuotaEnElMes(Contexto ctx, Credito credito) {
        return planes.deMes(ctx.hogar().id(), registro.mesEnCurso())
                .filter(plan -> plan.estado() != PlanMes.Estado.CERRADO)
                .flatMap(plan -> Mono.justOrEmpty(plan.principal()))
                .flatMap(esc -> categorias.delHogar(ctx.hogar().id()).collectList()
                        .flatMap(cats -> planes.crearItem(PlanUseCase.cuotaDe(credito, esc.id(), categoriaDeCreditos(cats),
                                esc.items().stream().mapToInt(ItemPlan::orden).max().orElse(0) + 1))))
                .then();
    }

    /** La de creditos del hogar, o la primera si no la hay, como agregarCredito del dominio. */
    static UUID categoriaDeCreditos(List<Categoria> cats) {
        return cats.stream().filter(c -> c.tipo() == Categoria.Tipo.CREDITO).findFirst()
                .or(() -> cats.stream().min(Comparator.comparingInt(Categoria::orden)))
                .map(Categoria::id)
                .orElseThrow(() -> DomainException.datosInvalidos("El hogar no tiene categorías"));
    }

    /** El credito valido, con el saldo y la cuota de su metodo (sin id ni hogar). */
    private static Credito creditoValido(DatosCredito d, LocalDate hoy) {
        String nombre = d.nombre() == null ? "" : d.nombre().strip();
        String entidad = d.entidad() == null ? "" : d.entidad().strip();
        if (nombre.isEmpty() || nombre.length() > Credito.NOMBRE_MAX || entidad.length() > Credito.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("El crédito necesita un nombre de hasta 40 caracteres");
        }
        if (d.diaPago() < 1 || d.diaPago() > 31) {
            throw DomainException.datosInvalidos("El día de pago va de 1 a 31");
        }
        boolean plan = "PLAN".equals(d.metodo());
        if (!plan && (d.totalOriginal() <= 0 || d.totalOriginal() < d.saldo())) {
            throw DomainException.datosInvalidos("Revisa el saldo, el total original y la cuota");
        }
        Credito base = new Credito(null, null, nombre, entidad, 0, hoy, 0, BigDecimal.ZERO, d.diaPago(), d.totalOriginal(), List.of());
        return conMetodo(base, d.metodoYDatos(), hoy);
    }

    /**
     * {@code camposMetodo} del dominio: valida los datos del metodo y devuelve el credito con ellos. En PLAN la cuota y el
     * saldo salen de la tabla, y el total original es el valor financiado.
     */
    static Credito conMetodo(Credito c, DatosMetodo d, LocalDate hoy) {
        Credito.Metodo metodo;
        try {
            metodo = Credito.Metodo.valueOf(d.metodo());
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw DomainException.datosInvalidos("El método es TASA, PLAN o MANUAL");
        }
        BigDecimal tasa = d.tasaEm() == null ? BigDecimal.ZERO : d.tasaEm();
        if (tasa.signum() < 0 || tasa.compareTo(Credito.TASA_MAX) > 0 || tasa.stripTrailingZeros().scale() > 2) {
            throw DomainException.datosInvalidos("La tasa efectiva mensual va de 0 a 10 %, con hasta dos decimales");
        }
        if (metodo == Credito.Metodo.PLAN) {
            int n = d.numeroCuotas() == null ? 0 : d.numeroCuotas();
            long valor = d.valorFinanciado() == null ? 0 : d.valorFinanciado();
            int pagadas = d.cuotasPagadas();
            if (valor <= 0 || n < 1 || n > 600 || pagadas < 0 || pagadas >= n) {
                throw DomainException.datosInvalidos("Revisa el valor, el número de cuotas y las cuotas pagadas");
            }
            long cuota = Amortizacion.cuotaFija(valor, n, tasa);
            long saldo = Amortizacion.saldoPlan(valor, n, tasa, cuota, pagadas);
            return new Credito(c.id(), c.hogarId(), c.nombre(), c.entidad(), saldo, saldo == c.saldo() ? c.saldoActualizadoEn() : hoy,
                    cuota, tasa, c.diaPago(), Math.max(valor, saldo), c.pagos(), metodo, n, pagadas, valor);
        }
        if (d.saldo() < 0 || d.cuota() <= 0) {
            throw DomainException.datosInvalidos("Revisa el saldo y la cuota");
        }
        return new Credito(c.id(), c.hogarId(), c.nombre(), c.entidad(), d.saldo(), d.saldo() == c.saldo() ? c.saldoActualizadoEn() : hoy,
                d.cuota(), metodo == Credito.Metodo.MANUAL ? BigDecimal.ZERO : tasa, c.diaPago(), Math.max(c.totalOriginal(), d.saldo()),
                c.pagos(), metodo, null, d.cuotasPagadas(), null);
    }

    @Override
    public Mono<Credito> cambiarMetodo(UUID creditoId, DatosMetodo datos) {
        return registro.contexto().flatMap(ctx -> creditoDelHogar(creditoId, ctx)
                .flatMap(actual -> Mono.fromCallable(() -> conMetodo(actual, datos, registro.hoy())))
                .flatMap(c -> transaccion.enTransaccion(creditos.cambiarMetodo(c)
                        .flatMap(g -> cuotaEnBorradores(ctx, g).thenReturn(g)))));
    }

    /** La cuota nueva en los items "Cuota ..." de los meses en Borrador (cambiarMetodoCredito del dominio). */
    private Mono<Void> cuotaEnBorradores(Contexto ctx, Credito c) {
        return planes.desde(ctx.hogar().id(), registro.mesEnCurso())
                .filter(p -> p.estado() == PlanMes.Estado.BORRADOR)
                .flatMapIterable(p -> p.escenarios().stream().flatMap(e -> e.items().stream())
                        .filter(i -> c.id().equals(i.creditoId()) && i.nombre().startsWith("Cuota ")).toList())
                .concatMap(i -> planes.actualizarItem(i.conMonto(i.nombre(), c.cuota(), i.ajustadoAMano())))
                .then();
    }

    @Override
    public Mono<Credito> actualizarSaldo(UUID creditoId, long saldo) {
        if (saldo < 0) {
            return Mono.error(DomainException.datosInvalidos("El saldo no puede ser negativo"));
        }
        return registro.contexto().flatMap(ctx -> creditoDelHogar(creditoId, ctx)
                .flatMap(c -> creditos.actualizarSaldo(c.id(), saldo, registro.hoy())
                        .then(creditos.porIdEnHogar(c.id(), ctx.hogar().id()))));
    }

    /** Abono a capital: baja el saldo y queda como movimiento del mes en curso, en una transaccion. */
    @Override
    public Mono<Movimiento> abonar(UUID creditoId, long monto, UUID usuarioId, String origen, UUID cuentaId) {
        return Mono.fromCallable(() -> Registro.montoValido(monto, "El abono debe ser mayor que cero"))
                .flatMap(m -> registro.contexto().flatMap(ctx -> creditoDelHogar(creditoId, ctx)
                        .flatMap(c -> registro.origenValido(ctx, usuarioId, origen, cuentaId)
                                .flatMap(o -> transaccion.enTransaccion(creditos.abonar(c.id(), m, registro.hoy())
                                        .switchIfEmpty(Mono.error(() -> new DomainException(
                                                DomainException.Tipo.DATOS_INVALIDOS, "ABONO_MAYOR",
                                                "El abono es mayor que el saldo")))
                                        .then(movimientos.registrar(new Movimiento(UUID.randomUUID(), ctx.hogar().id(),
                                                Movimiento.Tipo.ABONO_CREDITO, registro.mesEnCurso(), m, registro.hoy(),
                                                usuarioId, ctx.usuario(), o.cuentaId(), null, null, false, List.of(), null,
                                                "", o.origen(), null, c.id(), null, m, 0))))))));
    }

    @Override
    public Mono<Void> eliminarCredito(UUID creditoId) {
        return registro.contexto().flatMap(ctx -> creditoDelHogar(creditoId, ctx)
                .flatMap(c -> transaccion.enTransaccion(creditos.eliminar(c.id(), registro.mesEnCurso()))));
    }

    private Mono<Credito> creditoDelHogar(UUID creditoId, Contexto ctx) {
        return creditos.porIdEnHogar(creditoId, ctx.hogar().id())
                .switchIfEmpty(Mono.error(CuentasUseCase::creditoNoEncontrado));
    }

    static DomainException creditoNoEncontrado() {
        return DomainException.noEncontrado("CREDITO_NO_ENCONTRADO", "Ese crédito no existe");
    }
}
