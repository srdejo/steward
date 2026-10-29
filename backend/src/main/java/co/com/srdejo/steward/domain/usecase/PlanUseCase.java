package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IPlanServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
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
 * {@code guardarItem}, {@code quitarItem} y {@code usarEscenario} del dominio compartido. En la Etapa 4 solo existe la
 * Opcion A. Todo se resuelve desde el hogar de la sesion. Los creditos con saldo traen su cuota a cada mes nuevo (design D5
 * de backend-cuentas-creditos).
 */
public class PlanUseCase implements IPlanServicePort {

    private final IHogarPersistencePort hogares;
    private final ICategoriaPersistencePort categorias;
    private final IPlanPersistencePort planes;
    private final IMovimientoPersistencePort movimientos;
    private final ICreditoPersistencePort creditos;
    private final ICurrentUserPort usuarioActual;
    private final ITransaccionPort transaccion;

    public PlanUseCase(IHogarPersistencePort hogares, ICategoriaPersistencePort categorias, IPlanPersistencePort planes,
                       IMovimientoPersistencePort movimientos, ICreditoPersistencePort creditos,
                       ICurrentUserPort usuarioActual, ITransaccionPort transaccion) {
        this.hogares = hogares;
        this.categorias = categorias;
        this.planes = planes;
        this.movimientos = movimientos;
        this.creditos = creditos;
        this.usuarioActual = usuarioActual;
        this.transaccion = transaccion;
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
                        .flatMap(c -> categorias.renombrar(c, limpio))));
    }

    private static String nombreCategoria(String nombre) {
        String limpio = nombre == null ? "" : nombre.strip();
        if (limpio.isEmpty() || limpio.length() > Categoria.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("La categoría necesita un nombre de hasta 40 caracteres");
        }
        if (limpio.toLowerCase(Locale.ROOT).equals("diezmo")) {
            throw new DomainException(DomainException.Tipo.DATOS_INVALIDOS, "RESERVADA",
                    "El diezmo se calcula solo; no es una categoría");
        }
        return limpio;
    }

    // --- Plan del mes -----------------------------------------------------------------------------------------------

    @Override
    public Mono<PlanMes> crearPlan(YearMonth ref, String modo) {
        return Mono.fromCallable(() -> modoValido(modo)).flatMap(m -> contexto().flatMap(ctx -> planes
                .deMes(ctx.hogar().id(), ref.minusMonths(1))
                .map(anterior -> base(anterior, m))
                .defaultIfEmpty(List.of())
                .zipWith(Mono.zip(creditos.delHogar(ctx.hogar().id()).collectMap(Credito::id),
                        categorias.delHogar(ctx.hogar().id()).collectList()))
                .flatMap(t -> {
                    UUID planId = UUID.randomUUID();
                    UUID escenarioId = UUID.randomUUID();
                    List<ItemPlan> items = conCuotas(t.getT1().stream()
                            .map(i -> new ItemPlan(UUID.randomUUID(), escenarioId, i.categoriaId(), i.nombre(), i.monto(),
                                    i.diaVence(), i.tipo(), i.cuotaActual(), i.cuotaTotal(), i.orden(), i.creditoId()))
                            .toList(), escenarioId, t.getT2().getT1(), t.getT2().getT2());
                    PlanMes plan = new PlanMes(planId, ctx.hogar().id(), ref, PlanMes.Estado.BORRADOR, null,
                            List.of(new Escenario(escenarioId, planId, "A", ctx.usuario(), "", false, items)));
                    return transaccion.enTransaccion(planes.crear(plan));
                })));
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
     * terminadas; FIJOS deja los variables en $0; CERO, nada.
     */
    private static List<ItemPlan> base(PlanMes anterior, Modo modo) {
        Escenario principal = anterior.principal();
        if (modo == Modo.CERO || principal == null) {
            return List.of();
        }
        return principal.items().stream()
                .map(i -> i.cuotaActual() == null ? i : new ItemPlan(i.id(), i.escenarioId(), i.categoriaId(), i.nombre(),
                        i.monto(), i.diaVence(), i.tipo(), i.cuotaActual() + 1, i.cuotaTotal(), i.orden(), i.creditoId()))
                .filter(i -> i.cuotaActual() == null || i.cuotaActual() <= i.cuotaTotal())
                .map(i -> modo == Modo.FIJOS && i.tipo() == ItemPlan.Tipo.VARIABLE
                        ? new ItemPlan(i.id(), i.escenarioId(), i.categoriaId(), i.nombre(), 0, i.diaVence(), i.tipo(),
                        i.cuotaActual(), i.cuotaTotal(), i.orden(), i.creditoId())
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
                                        // Sin credito en la edicion, conserva el que tenia.
                                        .then(planes.actualizarItem(new ItemPlan(actual.id(), esc.id(), d.categoriaId(),
                                                d.nombre(), d.monto(), d.diaVence(), tipo(d.tipo()), d.cuotaActual(),
                                                d.cuotaTotal(), actual.orden(),
                                                d.creditoId() == null ? actual.creditoId() : d.creditoId())))))));
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

    @Override
    public Mono<PlanMes> usar(UUID planId, UUID escenarioId) {
        return contexto().flatMap(ctx -> escenarioEditable(planId, escenarioId, ctx)
                .flatMap(esc -> transaccion.enTransaccion(planes.usar(planId, esc.id()).thenReturn(true)))
                .then(planes.porIdEnHogar(planId, ctx.hogar().id())));
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
            throw DomainException.datosInvalidos("El tipo es FIJO, VARIABLE, CUOTA o CREDITO");
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
