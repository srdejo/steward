package co.com.srdejo.steward.application.dto;

import co.com.srdejo.steward.application.dto.PlanDtos.CategoriaResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.AnualResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.CierreResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.ProyeccionResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.PlanResponse;
import co.com.srdejo.steward.domain.api.ICuentasServicePort.DatosCredito;
import co.com.srdejo.steward.domain.api.ICuentasServicePort.SaldoBanco;
import co.com.srdejo.steward.domain.api.IFinanzasServicePort.DatosIngreso;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Contrato HTTP de las finanzas del hogar; lo consume el adaptador HTTP de la PWA (design D5). */
public final class FinanzasDtos {

    private FinanzasDtos() {
    }

    public record ReglaRequest(boolean activa, @NotNull(message = "Escribe el porcentaje") BigDecimal porcentaje,
                               @NotNull(message = "Elige la base") String base, boolean aplicaAportes) {
    }

    public record IngresoRequest(String nombre, long bruto, long neto, int diaPago, UUID cuentaId) {

        public DatosIngreso datos() {
            return new DatosIngreso(nombre, bruto, neto, diaPago, cuentaId);
        }
    }

    /** "Recibi": {@code monto} null es el de la linea o el neto del ingreso fijo. */
    public record RecibirRequest(Long monto) {
    }

    /** {@code titular}: {@code YO} o {@code CONJUNTA}. */
    public record CuentaRequest(String nombre, @NotNull(message = "Elige el titular") Titular titular, long saldo) {

        public enum Titular {
            YO,
            CONJUNTA
        }
    }

    public record MesResponse(int anio, int mes) {

        public static MesResponse de(YearMonth ref) {
            return new MesResponse(ref.getYear(), ref.getMonthValue());
        }
    }

    public record ReglaResponse(UUID usuarioId, boolean activa, BigDecimal porcentaje, String base, boolean aplicaAportes) {

        public static ReglaResponse de(ReglaDiezmo r) {
            return new ReglaResponse(r.usuarioId(), r.activa(), sinCeros(r.porcentaje()), r.base().name(),
                    r.aplicaAportes());
        }

        /** {@code 10.00} sale como {@code 10} (no {@code 1E+1}) y {@code 12.50} como {@code 12.5}. */
        static BigDecimal sinCeros(BigDecimal valor) {
            BigDecimal limpio = valor.stripTrailingZeros();
            return limpio.scale() < 0 ? limpio.setScale(0) : limpio;
        }
    }

    public record IngresoResponse(UUID id, UUID usuarioId, String nombre, long bruto, long neto, int diaPago,
                                  UUID cuentaId, boolean activo) {

        public static IngresoResponse de(IngresoFijo i) {
            return new IngresoResponse(i.id(), i.usuarioId(), i.nombre(), i.bruto(), i.neto(), i.diaPago(), i.cuentaId(),
                    i.activo());
        }
    }

    /** {@code seqCuadre}: el orden del ultimo movimiento incluido en {@code saldoCuadre} (design D1 de backend-cuentas-creditos). */
    public record CuentaResponse(UUID id, String nombre, UUID titularId, long saldoCuadre, LocalDate fechaCuadre,
                                 boolean cuadrada, long seqCuadre) {

        public static CuentaResponse de(Cuenta c) {
            return new CuentaResponse(c.id(), c.nombre(), c.titularId(), c.saldoCuadre(), c.fechaCuadre(), c.cuadrada(),
                    c.seqCuadre());
        }
    }

    public record CuadreRequest(List<SaldoRequest> saldos) {

        public List<SaldoBanco> datos() {
            return saldos == null ? List.of() : saldos.stream()
                    .map(s -> s == null ? null : new SaldoBanco(s.cuentaId(), s.saldoBanco()))
                    .toList();
        }
    }

    public record SaldoRequest(UUID cuentaId, long saldoBanco) {
    }

    public record TransferenciaRequest(UUID desde, UUID hacia, long monto) {
    }

    public record CreditoRequest(String nombre, String entidad, long saldo, long totalOriginal, long cuota,
                                 @NotNull(message = "Escribe la tasa") BigDecimal tasaEM, int diaPago) {

        public DatosCredito datos() {
            return new DatosCredito(nombre, entidad, saldo, totalOriginal, cuota, tasaEM, diaPago);
        }
    }

    public record SaldoCreditoRequest(long saldo) {
    }

    public record AbonoRequest(long monto, UUID usuarioId, OrigenDto origen) {
    }

    public record PagoCreditoResponse(LocalDate fecha, long monto, String tipo) {
    }

    /** {@code pagos}: los ultimos, del mas reciente al mas antiguo (salen de lo registrado). */
    public record CreditoResponse(UUID id, String nombre, String entidad, long saldo, LocalDate saldoActualizadoEn,
                                  long cuota, BigDecimal tasaEM, int diaPago, long totalOriginal,
                                  List<PagoCreditoResponse> pagos) {

        public static CreditoResponse de(Credito c) {
            return new CreditoResponse(c.id(), c.nombre(), c.entidad(), c.saldo(), c.saldoActualizadoEn(), c.cuota(),
                    ReglaResponse.sinCeros(c.tasaEm()), c.diaPago(), c.totalOriginal(),
                    c.pagos().stream().map(p -> new PagoCreditoResponse(p.fecha(), p.monto(), p.tipo().name())).toList());
        }
    }

    /** {@code origen}: CUENTA (con {@code cuentaId}), EXTERNA ("Su cuenta") o NINGUNO. */
    public record OrigenDto(String tipo, UUID cuentaId) {
    }

    public record PagoRequest(UUID itemId, long monto, UUID usuarioId, OrigenDto origen) {
    }

    public record GastoRequest(UUID itemId, long monto, String nota, UUID usuarioId, OrigenDto origen) {
    }

    public record AporteRequest(UUID usuarioId, long monto, MesResponse mes, UUID cuentaId, boolean aplicaDiezmo) {
    }

    /** PATCH /api/registros/{id}: monto, origen o nota; los null no cambian. */
    public record CorregirRequest(Long monto, OrigenDto origen, String nota) {
    }

    public record MovimientoResponse(UUID id, String tipo, MesResponse ref, long monto, LocalDate fecha, UUID usuarioId,
                                     UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                                     List<UUID> diezmoDe, UUID itemId, String nota, String origen, UUID cuentaDestinoId,
                                     UUID creditoId, UUID ingresoPlanId, Long capital, long seq) {

        public static MovimientoResponse de(Movimiento m) {
            return new MovimientoResponse(m.id(), m.tipo().name(), MesResponse.de(m.ref()), m.monto(), m.fecha(),
                    m.usuarioId(), m.creadoPor(), m.cuentaId(), m.ingresoFijoId(), m.bruto(), m.aplicaDiezmo(),
                    m.diezmoDe(), m.itemId(), m.nota(), m.origen().name(), m.cuentaDestinoId(), m.creditoId(),
                    m.ingresoPlanId(), m.capital(), m.seq());
        }
    }

    public record FinanzasResponse(MesResponse mes, List<CategoriaResponse> categorias,
                                   List<IngresoResponse> ingresosFijos, List<ReglaResponse> reglas,
                                   List<CuentaResponse> cuentas, List<PlanResponse> planes,
                                   List<MovimientoResponse> movimientos, List<CreditoResponse> creditos,
                                   List<CierreResponse> cierres, List<AnualResponse> anuales,
                                   List<ProyeccionResponse> proyecciones) {

        /** Los planes ya traen su estado efectivo (lo calcula el caso de uso). */
        public static FinanzasResponse de(Finanzas f, LocalDate hoy) {
            return new FinanzasResponse(MesResponse.de(f.mes()),
                    f.categorias().stream().map(CategoriaResponse::de).toList(),
                    f.ingresosFijos().stream().map(IngresoResponse::de).toList(),
                    f.reglas().stream().map(ReglaResponse::de).toList(),
                    f.cuentas().stream().map(CuentaResponse::de).toList(),
                    f.planes().stream().map(p -> PlanResponse.de(p, hoy)).toList(),
                    f.movimientos().stream().map(MovimientoResponse::de).toList(),
                    f.creditos().stream().map(CreditoResponse::de).toList(),
                    f.cierres().stream().map(CierreResponse::de).toList(),
                    f.anuales().stream().map(AnualResponse::de).toList(),
                    f.proyecciones().stream().map(ProyeccionResponse::de).toList());
        }
    }
}
