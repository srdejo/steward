package co.com.srdejo.steward.application.dto;

import co.com.srdejo.steward.application.dto.FinanzasDtos.MesResponse;
import co.com.srdejo.steward.domain.api.IPlanServicePort.DatosItem;
import co.com.srdejo.steward.domain.model.Categoria;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
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

    public record CuotaDto(int actual, int total) {
    }

    public record ItemRequest(UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo, CuotaDto cuota) {

        public DatosItem datos() {
            return new DatosItem(categoriaId, nombre, monto, diaVence, tipo, cuota == null ? null : cuota.actual(),
                    cuota == null ? null : cuota.total());
        }
    }

    public record CategoriaResponse(UUID id, String nombre, String color, int orden, String tipo, boolean sistema) {

        public static CategoriaResponse de(Categoria c) {
            return new CategoriaResponse(c.id(), c.nombre(), c.color(), c.orden(), c.tipo().name(), c.sistema());
        }
    }

    public record ItemResponse(UUID id, UUID categoriaId, String nombre, long monto, Integer diaVence, String tipo,
                               CuotaDto cuota) {

        public static ItemResponse de(ItemPlan i) {
            return new ItemResponse(i.id(), i.categoriaId(), i.nombre(), i.monto(), i.diaVence(), i.tipo().name(),
                    i.cuotaActual() == null ? null : new CuotaDto(i.cuotaActual(), i.cuotaTotal()));
        }
    }

    public record EscenarioResponse(UUID id, String letra, UUID creadoPor, String nota, boolean archivado,
                                    List<ItemResponse> items) {

        public static EscenarioResponse de(Escenario e) {
            return new EscenarioResponse(e.id(), e.letra(), e.creadoPor(), e.nota(), e.archivado(),
                    e.items().stream().map(ItemResponse::de).toList());
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
