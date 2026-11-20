package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.ITarjetasServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.Tarjeta;
import co.com.srdejo.steward.domain.spi.ICategoriaPersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IPlanPersistencePort;
import co.com.srdejo.steward.domain.spi.ITarjetaPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.usecase.Registro.Contexto;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Tarjetas de credito, como {@code rules/tarjetas.ts} del dominio compartido (spec steward-tarjetas, design D1 y D6 de
 * tarjetas-y-creditos). La tarjeta es la linea del plan: un item FIJO en Creditos enlazado a ella.
 */
public class TarjetasUseCase implements ITarjetasServicePort {

    private final ITarjetaPersistencePort tarjetas;
    private final IPlanPersistencePort planes;
    private final ICategoriaPersistencePort categorias;
    private final ITransaccionPort transaccion;
    private final Registro registro;

    public TarjetasUseCase(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas, ITarjetaPersistencePort tarjetas,
                           IPlanPersistencePort planes, ICategoriaPersistencePort categorias, ICurrentUserPort usuarioActual,
                           ITransaccionPort transaccion, IClockPort clock) {
        this.tarjetas = tarjetas;
        this.planes = planes;
        this.categorias = categorias;
        this.transaccion = transaccion;
        this.registro = new Registro(hogares, cuentas, usuarioActual, clock);
    }

    @Override
    public Flux<Tarjeta> delHogar() {
        return registro.contexto().flatMapMany(ctx -> tarjetas.delHogar(ctx.hogar().id()));
    }

    @Override
    public Mono<Tarjeta> crear(DatosTarjeta datos, UUID itemId) {
        return Mono.fromCallable(() -> valida(datos)).flatMap(d -> registro.contexto().flatMap(ctx -> {
            Tarjeta tarjeta = new Tarjeta(UUID.randomUUID(), ctx.hogar().id(), d.nombre(), d.diaCorte(), d.diaPago(), d.uso(),
                    Tarjeta.Pago.valueOf(d.pagoTipo()), d.pagoMonto());
            Mono<PlanMes.Escenario> principal = planes.deMes(ctx.hogar().id(), registro.mesEnCurso())
                    .filter(plan -> plan.estado() != PlanMes.Estado.CERRADO)
                    .flatMap(plan -> Mono.justOrEmpty(plan.principal()));
            Mono<Void> linea = itemId != null
                    ? principal.flatMap(esc -> Mono.justOrEmpty(esc.items().stream().filter(i -> i.id().equals(itemId)).findFirst()))
                            .flatMap(item -> enlazable(ctx, item))
                            .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("ITEM_NO_ENCONTRADO", "Ese ítem no se puede enlazar")))
                            .flatMap(item -> categorias.delHogar(ctx.hogar().id()).collectList().flatMap(cats -> planes.actualizarItem(
                                    enCategoria(item.conTarjeta(tarjeta).conMonto(item.nombre(), item.monto(), item.ajustadoAMano()), categoriaDeTarjetas(cats)))))
                            .then()
                    // Si su dia de pago de este mes ya paso, la linea empieza el mes siguiente (agregarTarjeta del dominio).
                    : pagoPendiente(tarjeta, registro.hoy()) ? principal.flatMap(esc -> categorias.delHogar(ctx.hogar().id()).collectList()
                            .flatMap(cats -> planes.crearItem(lineaDe(tarjeta, esc.id(), categoriaDeTarjetas(cats),
                                    esc.items().stream().mapToInt(ItemPlan::orden).max().orElse(0) + 1))))
                            .then() : Mono.empty();
            return transaccion.enTransaccion(tarjetas.crear(tarjeta).flatMap(t -> linea.thenReturn(t)));
        }));
    }

    /** El dia de pago de este mes todavia no pasa (el ultimo dia del mes si no existe). */
    static boolean pagoPendiente(Tarjeta t, java.time.LocalDate hoy) {
        java.time.YearMonth mes = java.time.YearMonth.from(hoy);
        return !mes.atDay(Math.min(t.diaPago(), mes.lengthOfMonth())).isBefore(hoy);
    }

    /** Un item de Creditos sin tarjeta ni credito (itemsEnlazables del dominio). */
    private Mono<ItemPlan> enlazable(Contexto ctx, ItemPlan item) {
        return categorias.delHogar(ctx.hogar().id()).collectList()
                // Los gastos sueltos de Tarjetas o de Creditos (alli quedaron las tarjetas de antes de V13).
                .filter(cats -> item.tarjetaId() == null && item.creditoId() == null && cats.stream()
                        .anyMatch(c -> c.id().equals(item.categoriaId()) && (c.tipo() == Categoria.Tipo.TARJETA || c.tipo() == Categoria.Tipo.CREDITO)))
                .map(cats -> item);
    }

    @Override
    public Mono<Tarjeta> editar(UUID id, DatosTarjeta datos) {
        return Mono.fromCallable(() -> valida(datos)).flatMap(d -> registro.contexto().flatMap(ctx -> tarjetaDelHogar(id, ctx)
                .flatMap(actual -> {
                    Tarjeta t = new Tarjeta(actual.id(), actual.hogarId(), d.nombre(), d.diaCorte(), d.diaPago(), d.uso(),
                            Tarjeta.Pago.valueOf(d.pagoTipo()), d.pagoMonto());
                    Mono<Void> borradores = planes.desde(ctx.hogar().id(), registro.mesEnCurso())
                            .filter(p -> p.estado() == PlanMes.Estado.BORRADOR)
                            .flatMapIterable(p -> p.escenarios().stream().flatMap(e -> e.items().stream())
                                    .filter(i -> t.id().equals(i.tarjetaId())).toList())
                            .concatMap(i -> planes.actualizarItem(i.conTarjeta(t).conMonto(t.nombreLinea(), t.pagoMonto(), false)))
                            .then();
                    return transaccion.enTransaccion(tarjetas.actualizar(t).flatMap(g -> borradores.thenReturn(g)));
                })));
    }

    @Override
    public Mono<Void> quitar(UUID id) {
        return registro.contexto().flatMap(ctx -> tarjetaDelHogar(id, ctx).flatMap(t -> tarjetas.borrar(t.id())));
    }

    private Mono<Tarjeta> tarjetaDelHogar(UUID id, Contexto ctx) {
        return tarjetas.porIdEnHogar(id, ctx.hogar().id())
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("TARJETA_NO_ENCONTRADA", "Esa tarjeta no existe")));
    }

    private static DatosTarjeta valida(DatosTarjeta d) {
        String nombre = d.nombre() == null ? "" : d.nombre().strip();
        String uso = d.uso() == null ? "" : d.uso().strip();
        if (nombre.isEmpty() || nombre.length() > Tarjeta.NOMBRE_MAX || uso.length() > Tarjeta.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("La tarjeta necesita un nombre de hasta 40 caracteres");
        }
        if (d.diaCorte() < 1 || d.diaCorte() > 31 || d.diaPago() < 1 || d.diaPago() > 31) {
            throw DomainException.datosInvalidos("Los días de corte y de pago van de 1 a 31");
        }
        if (!"COMPLETA".equals(d.pagoTipo()) && !"FIJO".equals(d.pagoTipo())) {
            throw DomainException.datosInvalidos("La tarjeta se paga COMPLETA o con pago FIJO");
        }
        if ("FIJO".equals(d.pagoTipo()) ? d.pagoMonto() <= 0 : d.pagoMonto() < 0) {
            throw DomainException.datosInvalidos("El pago fijo debe ser mayor que cero");
        }
        return new DatosTarjeta(nombre, d.diaCorte(), d.diaPago(), uso, d.pagoTipo(), d.pagoMonto());
    }

    /** La categoria de las lineas de tarjeta: Tarjetas, o Creditos si el hogar no la tiene. */
    static UUID categoriaDeTarjetas(List<Categoria> cats) {
        return cats.stream().filter(c -> c.tipo() == Categoria.Tipo.TARJETA).map(Categoria::id).findFirst()
                .orElseGet(() -> CuentasUseCase.categoriaDeCreditos(cats));
    }

    private static ItemPlan enCategoria(ItemPlan i, UUID categoria) {
        return new ItemPlan(i.id(), i.escenarioId(), categoria, i.nombre(), i.monto(), i.diaVence(), i.tipo(), i.cuotaActual(),
                i.cuotaTotal(), i.orden(), i.creditoId(), i.ingresoFijoId(), i.aporteId(), i.ingresoPlanId(), i.ajustadoAMano(),
                i.tarjetaId(), i.enlacePago(), i.codigoPago());
    }

    /** La linea de una tarjeta: Tarjetas, FIJO, "Tarjeta {nombre} · {uso}", su monto y su dia de pago. */
    static ItemPlan lineaDe(Tarjeta t, UUID escenarioId, UUID categoriaId, int orden) {
        return new ItemPlan(UUID.randomUUID(), escenarioId, categoriaId, t.nombreLinea(), t.pagoMonto(), t.diaPago(),
                ItemPlan.Tipo.FIJO, null, null, orden, null, null, null, null, false, t.id());
    }

    /**
     * Al nacer un mes (lineasDeTarjetas del dominio): las lineas copiadas toman el monto y el dia de su tarjeta, las de una
     * tarjeta quitada quedan sin enlace, y cada tarjeta sin linea gana la suya.
     */
    static List<ItemPlan> conTarjetas(List<ItemPlan> items, UUID escenarioId, List<Tarjeta> deHogar, List<Categoria> cats) {
        Map<UUID, Tarjeta> porId = deHogar.stream().collect(Collectors.toMap(Tarjeta::id, Function.identity()));
        List<ItemPlan> con = new ArrayList<>();
        Set<UUID> enlazadas = new HashSet<>();
        for (ItemPlan i : items) {
            if (i.tarjetaId() == null) {
                con.add(i);
            } else {
                Tarjeta t = porId.get(i.tarjetaId());
                con.add(t == null ? i.conTarjeta(null) : enCategoria(i.conTarjeta(t), categoriaDeTarjetas(cats)));
                if (t != null) {
                    enlazadas.add(t.id());
                }
            }
        }
        int orden = con.stream().mapToInt(ItemPlan::orden).max().orElse(0);
        for (Tarjeta t : deHogar) {
            if (!enlazadas.contains(t.id())) {
                con.add(lineaDe(t, escenarioId, categoriaDeTarjetas(cats), ++orden));
            }
        }
        return con;
    }
}
