package co.com.srdejo.steward.application.dto;

import co.com.srdejo.steward.application.dto.FinanzasDtos.MesResponse;
import co.com.srdejo.steward.domain.api.ICierreServicePort.DatosCierre;
import co.com.srdejo.steward.domain.api.IPlanServicePort.DatosItem;
import co.com.srdejo.steward.domain.api.IPlanServicePort.DatosLinea;
import co.com.srdejo.steward.domain.model.CierreMes;
import co.com.srdejo.steward.domain.model.PlanAnual;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Contrato HTTP de categorias y plan del mes; lo consume el adaptador HTTP de la PWA (design D5). */
public final class PlanDtos {

    private PlanDtos() {
    }

    /** Crear (nombre y color opcional) o editar (nombre, color o los dos) una categoria (color-categorias). */
    public record CategoriaRequest(String nombre, String color) {
    }

    public record CrearPlanRequest(int anio, int mes, String modo) {

        public YearMonth ref() {
            return YearMonth.of(anio, mes);
        }
    }

    public record UsarRequest(UUID escenarioId) {
    }

    /** "+ Duplicar": la opcion de la que se copia y una nota opcional. */
    public record DuplicarRequest(UUID desde, String nota) {
    }

    /** "Probarlo como opcion de {mes}". */
    public record ProbarAbonoRequest(int anio, int mes, long abono) {
    }

    public record OpcionNuevaResponse(UUID planId, UUID escenarioId) {
    }

    public record CuotaDto(int actual, int total) {
    }

    public record FilaDto(String nombre, Long plan, long real) {
    }

    public record AnualRequest(int anio) {
    }

    /** {@code opcionId} opcional: sin el, la opcion en uso o la A (design D2 de anual-opciones-y-meses). */
    public record CeldaRequest(UUID categoriaId, int mes, long monto, UUID opcionId) {
    }

    /**
     * {@code categoriaId}, {@code hasta} y {@code enAdelante} son opcionales; {@code enAdelante} solo cuenta sin {@code hasta}
     * (design D2 de anual-evento-rango).
     */
    public record EventoRequest(String nombre, int mes, long monto, String tipo, UUID usuarioId, UUID categoriaId, Boolean enAdelante,
                                UUID opcionId, Integer hasta) {
    }

    /** "Replicar en los 12 meses": {@code tipo} MES (con {@code anio} y {@code mes}), FIJOS o CERO. */
    public record ReplicarRequest(String tipo, Integer anio, Integer mes, UUID opcionId) {
    }

    /** "+ Duplicar Opción X" del año. */
    public record DuplicarOpcionAnualRequest(UUID desdeId, FuenteRequest desde) {
    }

    /** La fuente de un mes base (anual-mes-base-editable): {@code tipo} MES (con {@code anio} y {@code mes}), FIJOS o CERO. */
    public record FuenteRequest(String tipo, Integer anio, Integer mes) {

        public co.com.srdejo.steward.domain.api.IAnualServicePort.Fuente fuente() {
            YearMonth ref = anio == null || mes == null || mes < 1 || mes > 12 ? null : YearMonth.of(anio, mes);
            return new co.com.srdejo.steward.domain.api.IAnualServicePort.Fuente(tipo, ref);
        }
    }

    public record CopiarMesBaseRequest(FuenteRequest desde) {
    }

    /** "Meses con la Opción X": los meses (1 a 12) que se actualizan; sin {@code opcionId}, la en uso o la A. */
    public record MesesAnualRequest(UUID opcionId, List<Integer> actualizar) {
    }

    public record MesDelAnualResponse(int anio, int mes, String accion) {
    }

    public record ProyeccionRequest(UUID usuarioId, int mes, long monto) {
    }

    /** Con {@code hasta} y, para la app 2.2.3, {@code enAdelante} (verdadero si va hasta diciembre desde un mes anterior). */
    public record EventoResponse(UUID id, String nombre, int mes, long monto, String tipo, UUID usuarioId, UUID categoriaId,
                                 boolean enAdelante, int hasta) {

        public static EventoResponse de(PlanAnual.Evento e) {
            return new EventoResponse(e.id(), e.nombre(), e.mes(), e.monto(), e.tipo().name(), e.usuarioId(), e.categoriaId(), e.enAdelante(),
                    e.hasta());
        }
    }

    public record CeldaResponse(UUID categoriaId, int mes, long monto) {
    }

    /** Solo las celdas tocadas; las demas valen cero (design D2 de backend-plan-anual). */
    public record MesRefResponse(int anio, int mes) {
    }

/** Una opcion del año: sus celdas tocadas, sus eventos y su mes base (design D2 de anual-opciones-y-meses). */
    public record OpcionAnualResponse(UUID id, String letra, UUID creadoPor, String nota, List<CeldaResponse> celdas,
                                      List<EventoResponse> eventos, MesRefResponse base, MesBaseResponse mesBase) {

        public static OpcionAnualResponse de(PlanAnual.Opcion o) {
            return new OpcionAnualResponse(o.id(), o.letra(), o.creadoPor(), o.nota(),
                    o.celdas().stream().map(c -> new CeldaResponse(c.categoriaId(), c.mes(), c.monto())).toList(),
                    o.eventos().stream().map(EventoResponse::de).toList(),
                    o.base() == null ? null : new MesRefResponse(o.base().getYear(), o.base().getMonthValue()),
                    o.mesBase() == null ? null : new MesBaseResponse(
                            o.mesBase().origen() == null ? null : new MesRefResponse(o.mesBase().origen().getYear(), o.mesBase().origen().getMonthValue()),
                            o.mesBase().items().stream().map(ItemResponse::de).toList()));
        }
    }

    /** El mes base editable de una opcion (anual-mes-base-editable). */
    public record MesBaseResponse(MesRefResponse origen, List<ItemResponse> items) {
    }

    public record AnualResponse(int anio, String estado, List<OpcionAnualResponse> opciones, UUID opcionEnUso) {

        public static AnualResponse de(PlanAnual a) {
            return new AnualResponse(a.anio(), a.estado().name(), a.opciones().stream().map(OpcionAnualResponse::de).toList(), a.opcionEnUso());
        }
    }

    public record ProyeccionResponse(UUID usuarioId, int anio, int mes, long monto) {

        public static ProyeccionResponse de(PlanAnual.Proyeccion p) {
            return new ProyeccionResponse(p.usuarioId(), p.anio(), p.mes(), p.monto());
        }
    }

    /** La foto que calcula la PWA con vistaCierre, el reparto y el orden del ultimo movimiento del mes que vio. */
    public record CierreRequest(int anio, int mes, List<FilaDto> filas, long sinRegistrar, long sobrante, long aAhorro,
                                long aSiguiente, long ultimoSeq) {

        public DatosCierre datos() {
            if (mes < 1 || mes > 12) {
                throw co.com.srdejo.steward.domain.exception.DomainException.datosInvalidos("El mes va de 1 a 12");
            }
            return new DatosCierre(YearMonth.of(anio, mes), filas == null ? null : filas.stream()
                    .map(f -> f == null ? null : new CierreMes.Fila(f.nombre(), f.plan(), f.real())).toList(),
                    sinRegistrar, sobrante, aAhorro, aSiguiente, ultimoSeq);
        }
    }

    public record CierreResponse(MesResponse ref, List<FilaDto> filas, long sinRegistrar, long sobrante, long aAhorro,
                                 long aSiguiente, UUID cerradoPor, LocalDate cerradoEn) {

        public static CierreResponse de(CierreMes c) {
            return new CierreResponse(MesResponse.de(c.ref()),
                    c.filas().stream().map(f -> new FilaDto(f.nombre(), f.plan(), f.real())).toList(), c.sinRegistrar(),
                    c.sobrante(), c.aAhorro(), c.aSiguiente(), c.cerradoPor(), c.cerradoEn());
        }
    }

    /** {@code enlacePago}/{@code codigoPago}: null conserva al editar, "" quita (gastos-datos-pago). */
    public record ItemRequest(UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo, CuotaDto cuota,
                              UUID creditoId, String enlacePago, String codigoPago, Boolean aplicarAMeses) {

        public DatosItem datos() {
            return new DatosItem(categoriaId, nombre, monto, diaVence, tipo, cuota == null ? null : cuota.actual(),
                    cuota == null ? null : cuota.total(), creditoId, enlacePago, codigoPago, Boolean.TRUE.equals(aplicarAMeses));
        }
    }

    public record CategoriaResponse(UUID id, String nombre, String color, int orden, String tipo, boolean sistema) {

        public static CategoriaResponse de(Categoria c) {
            return new CategoriaResponse(c.id(), c.nombre(), c.color(), c.orden(), c.tipo().name(), c.sistema());
        }
    }

    /** {@code ingresoFijoId} y {@code aporteId}: el ingreso o el aporte que origina un item de diezmo. */
    public record ItemResponse(UUID id, UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo,
                               CuotaDto cuota, UUID creditoId, UUID ingresoFijoId, UUID aporteId, UUID ingresoPlanId,
                               boolean ajustadoAMano, UUID tarjetaId, String enlacePago, String codigoPago) {

        public static ItemResponse de(ItemPlan i) {
            return new ItemResponse(i.id(), i.categoriaId(), i.nombre(), i.monto(), i.diaVence(), i.tipo().name(),
                    i.cuotaActual() == null ? null : new CuotaDto(i.cuotaActual(), i.cuotaTotal()), i.creditoId(),
                    i.ingresoFijoId(), i.aporteId(), i.ingresoPlanId(), i.ajustadoAMano(), i.tarjetaId(), i.enlacePago(), i.codigoPago());
        }
    }

    /** Conteos para confirmar "Borrar plan de {mes}". */
    public record ConteoBorradoResponse(int pagos, int gastos, int ingresos, boolean cerrado) {

        public static ConteoBorradoResponse de(co.com.srdejo.steward.domain.api.IPlanServicePort.ConteoBorrado c) {
            return new ConteoBorradoResponse(c.pagos(), c.gastos(), c.ingresos(), c.cerrado());
        }
    }

    /** "+ Ingreso" o editar una linea de ingreso de la opcion (design D8 de diezmo-como-gasto). */
    public record LineaRequest(String nombre, long monto, UUID usuarioId, Long bruto, Boolean aplicarDiezmo) {

        public DatosLinea datos() {
            return new DatosLinea(nombre, monto, usuarioId, bruto, Boolean.TRUE.equals(aplicarDiezmo));
        }
    }

    public record LineaResponse(UUID id, String nombre, long monto, UUID usuarioId, String tipo, UUID ingresoFijoId, long bruto) {

        public static LineaResponse de(IngresoPlan l) {
            return new LineaResponse(l.id(), l.nombre(), l.monto(), l.usuarioId(), l.tipo().name(), l.ingresoFijoId(), l.bruto());
        }
    }

    public record EscenarioResponse(UUID id, String letra, UUID creadoPor, String nota, boolean archivado,
                                    List<LineaResponse> ingresos, List<ItemResponse> items) {

        public static EscenarioResponse de(Escenario e) {
            return new EscenarioResponse(e.id(), e.letra(), e.creadoPor(), e.nota(), e.archivado(),
                    e.ingresos().stream().map(LineaResponse::de).toList(), e.items().stream().map(ItemResponse::de).toList());
        }
    }

    /** {@code estado} es el efectivo: un Borrador con opcion elegida se lee Activo cuando llega su mes. */
    public record PlanResponse(UUID id, MesResponse ref, String estado, UUID escenarioActivoId,
                               List<EscenarioResponse> escenarios) {

        public static PlanResponse de(PlanMes p, LocalDate hoy) {
            return new PlanResponse(p.id(), MesResponse.de(p.ref()), p.estadoEn(hoy).name(), p.escenarioActivoId(),
                    p.escenarios().stream().map(EscenarioResponse::de).toList());
        }
    }
}
