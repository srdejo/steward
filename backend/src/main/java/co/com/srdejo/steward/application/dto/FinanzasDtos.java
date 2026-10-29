package co.com.srdejo.steward.application.dto;

import co.com.srdejo.steward.domain.api.IFinanzasServicePort.DatosIngreso;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.ObligacionDiezmo;
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

    public record EntregaRequest(List<UUID> obligaciones, UUID cuentaId) {
    }

    public record DiezmoEnHoyRequest(String modo) {
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
        private static BigDecimal sinCeros(BigDecimal valor) {
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

    public record CuentaResponse(UUID id, String nombre, UUID titularId, long saldoCuadre, LocalDate fechaCuadre,
                                 boolean cuadrada) {

        public static CuentaResponse de(Cuenta c) {
            return new CuentaResponse(c.id(), c.nombre(), c.titularId(), c.saldoCuadre(), c.fechaCuadre(), c.cuadrada());
        }
    }

    public record MovimientoResponse(UUID id, String tipo, MesResponse ref, long monto, LocalDate fecha, UUID usuarioId,
                                     UUID creadoPor, UUID cuentaId, UUID ingresoFijoId, Long bruto, boolean aplicaDiezmo,
                                     List<UUID> diezmoDe) {

        public static MovimientoResponse de(Movimiento m) {
            return new MovimientoResponse(m.id(), m.tipo().name(), MesResponse.de(m.ref()), m.monto(), m.fecha(),
                    m.usuarioId(), m.creadoPor(), m.cuentaId(), m.ingresoFijoId(), m.bruto(), m.aplicaDiezmo(),
                    m.diezmoDe());
        }
    }

    public record ObligacionResponse(UUID id, long monto, String detalle, UUID usuarioId, LocalDate fecha) {

        public static ObligacionResponse de(ObligacionDiezmo o) {
            return new ObligacionResponse(o.id(), o.monto(), o.detalle(), o.usuarioId(), o.fecha());
        }
    }

    public record FinanzasResponse(MesResponse mes, String diezmoEnHoy, List<IngresoResponse> ingresosFijos,
                                   List<ReglaResponse> reglas, List<CuentaResponse> cuentas,
                                   List<MovimientoResponse> movimientos) {

        public static FinanzasResponse de(Finanzas f) {
            return new FinanzasResponse(MesResponse.de(f.mes()), f.diezmoEnHoy().name(),
                    f.ingresosFijos().stream().map(IngresoResponse::de).toList(),
                    f.reglas().stream().map(ReglaResponse::de).toList(),
                    f.cuentas().stream().map(CuentaResponse::de).toList(),
                    f.movimientos().stream().map(MovimientoResponse::de).toList());
        }
    }
}
