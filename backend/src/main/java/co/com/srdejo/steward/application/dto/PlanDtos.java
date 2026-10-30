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

    public record NombreRequest(String nombre) {
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

    public record CeldaRequest(UUID categoriaId, int mes, long monto) {
    }

    public record EventoRequest(String nombre, int mes, long monto, String tipo, UUID usuarioId) {
    }

    public record ProyeccionRequest(UUID usuarioId, int mes, long monto) {
    }

    public record MesCreadoResponse(int anio, int mes) {
    }

    public record EventoResponse(UUID id, String nombre, int mes, long monto, String tipo, UUID usuarioId) {

        public static EventoResponse de(PlanAnual.Evento e) {
            return new EventoResponse(e.id(), e.nombre(), e.mes(), e.monto(), e.tipo().name(), e.usuarioId());
        }
    }

    public record CeldaResponse(UUID categoriaId, int mes, long monto) {
    }

    /** Solo las celdas tocadas; las demas valen cero (design D2 de backend-plan-anual). */
    public record AnualResponse(int anio, String estado, List<CeldaResponse> celdas, List<EventoResponse> eventos) {

        public static AnualResponse de(PlanAnual a) {
            return new AnualResponse(a.anio(), a.estado().name(),
                    a.celdas().stream().map(c -> new CeldaResponse(c.categoriaId(), c.mes(), c.monto())).toList(),
                    a.eventos().stream().map(EventoResponse::de).toList());
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

    public record ItemRequest(UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo, CuotaDto cuota,
                              UUID creditoId) {

        public DatosItem datos() {
            return new DatosItem(categoriaId, nombre, monto, diaVence, tipo, cuota == null ? null : cuota.actual(),
                    cuota == null ? null : cuota.total(), creditoId);
        }
    }

    public record CategoriaResponse(UUID id, String nombre, String color, int orden, String tipo, boolean sistema) {

        public static CategoriaResponse de(Categoria c) {
            return new CategoriaResponse(c.id(), c.nombre(), c.color(), c.orden(), c.tipo().name(), c.sistema());
        }
    }

    /** {@code ingresoFijoId} y {@code aporteId}: el ingreso o el aporte que origina un item de diezmo. */
    public record ItemResponse(UUID id, UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo,
                               CuotaDto cuota, UUID creditoId, UUID ingresoFijoId, UUID aporteId) {

        public static ItemResponse de(ItemPlan i) {
            return new ItemResponse(i.id(), i.categoriaId(), i.nombre(), i.monto(), i.diaVence(), i.tipo().name(),
                    i.cuotaActual() == null ? null : new CuotaDto(i.cuotaActual(), i.cuotaTotal()), i.creditoId(),
                    i.ingresoFijoId(), i.aporteId());
        }
    }

    /** "+ Ingreso" o editar una linea de ingreso de la opcion (design D8 de diezmo-como-gasto). */
    public record LineaRequest(String nombre, long monto, UUID usuarioId) {

        public DatosLinea datos() {
            return new DatosLinea(nombre, monto, usuarioId);
        }
    }

    public record LineaResponse(UUID id, String nombre, long monto, UUID usuarioId, String tipo, UUID ingresoFijoId) {

        public static LineaResponse de(IngresoPlan l) {
            return new LineaResponse(l.id(), l.nombre(), l.monto(), l.usuarioId(), l.tipo().name(), l.ingresoFijoId());
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
