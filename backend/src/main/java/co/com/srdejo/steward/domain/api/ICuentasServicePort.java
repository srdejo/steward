package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Movimiento;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Cuadre, mover dinero y creditos del hogar de la sesion (spec steward-finanzas, backend-cuentas-creditos). Todo se
 * resuelve desde el usuario de la sesion.
 */
public interface ICuentasServicePort {

    /** "Cuadrar todas": las cuentas cuadradas, en el orden en que llegaron. */
    Mono<List<Cuenta>> cuadrar(List<SaldoBanco> saldos);

    /** "Mover dinero" entre dos cuentas del hogar. */
    Mono<Movimiento> transferir(UUID desde, UUID hacia, long monto);

    /**
     * "Eliminar cuenta", con cualquier saldo: el total del hogar baja en ese saldo y lo registrado queda en el historial,
     * sin cuenta. Solo las propias o las conjuntas.
     */
    Mono<Void> eliminar(UUID cuentaId);

    /** "+ Agregar credito": su cuota entra al plan del mes en curso si tiene plan y no esta cerrado. */
    Mono<Credito> crearCredito(DatosCredito datos);

    /**
     * "Eliminar credito" (credito-escritorio-y-eliminar): sus movimientos quedan sin credito, sus items sin pagos de los
     * meses abiertos desde el mes en curso se borran y los demas quedan sin enlace.
     */
    Mono<Void> eliminarCredito(UUID creditoId);

    /** "Corregir con extracto": el saldo que dice el banco, con la fecha de hoy. */
    Mono<Credito> actualizarSaldo(UUID creditoId, long saldo);

    /** "Cambiar" como baja el saldo (design D3 de tarjetas-y-creditos). */
    Mono<Credito> cambiarMetodo(UUID creditoId, DatosMetodo datos);

    Mono<Movimiento> abonar(UUID creditoId, long monto, UUID usuarioId, String origen, UUID cuentaId);

    record SaldoBanco(UUID cuentaId, long saldoBanco) {
    }

    /** {@code metodo} null es TASA; en PLAN, la cuota y el saldo salen de la tabla. */
    record DatosCredito(String nombre, String entidad, long saldo, long totalOriginal, long cuota, BigDecimal tasaEm,
                        int diaPago, String metodo, Integer numeroCuotas, int cuotasPagadas, Long valorFinanciado,
                        String primeraCuota) {

        public DatosCredito(String nombre, String entidad, long saldo, long totalOriginal, long cuota, BigDecimal tasaEm,
                            int diaPago, String metodo, Integer numeroCuotas, int cuotasPagadas, Long valorFinanciado) {
            this(nombre, entidad, saldo, totalOriginal, cuota, tasaEm, diaPago, metodo, numeroCuotas, cuotasPagadas, valorFinanciado, null);
        }

        /** Con la tasa, como antes de tarjetas-y-creditos. */
        public DatosCredito(String nombre, String entidad, long saldo, long totalOriginal, long cuota, BigDecimal tasaEm,
                            int diaPago) {
            this(nombre, entidad, saldo, totalOriginal, cuota, tasaEm, diaPago, null, null, 0, null, null);
        }

        public DatosMetodo metodoYDatos() {
            return new DatosMetodo(metodo == null ? "TASA" : metodo, saldo, cuota, tasaEm, numeroCuotas, cuotasPagadas, valorFinanciado, null);
        }
    }

    /** TASA y MANUAL: saldo y cuota; PLAN: valor, numero de cuotas, tasa y cuotas pagadas. */
    /** {@code primeraCuota}: "YYYY-MM"; null conserva la que habia (design D5 de credito-primera-cuota). */
    record DatosMetodo(String metodo, long saldo, long cuota, BigDecimal tasaEm, Integer numeroCuotas, int cuotasPagadas,
                       Long valorFinanciado, String primeraCuota) {

        public DatosMetodo(String metodo, long saldo, long cuota, BigDecimal tasaEm, Integer numeroCuotas, int cuotasPagadas,
                           Long valorFinanciado) {
            this(metodo, saldo, cuota, tasaEm, numeroCuotas, cuotasPagadas, valorFinanciado, null);
        }
    }
}
