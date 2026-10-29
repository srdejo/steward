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

    /** "+ Agregar credito": su cuota entra al plan del mes en curso si tiene plan y no esta cerrado. */
    Mono<Credito> crearCredito(DatosCredito datos);

    Mono<Credito> actualizarSaldo(UUID creditoId, long saldo);

    Mono<Movimiento> abonar(UUID creditoId, long monto, UUID usuarioId, String origen, UUID cuentaId);

    record SaldoBanco(UUID cuentaId, long saldoBanco) {
    }

    record DatosCredito(String nombre, String entidad, long saldo, long totalOriginal, long cuota, BigDecimal tasaEm,
                        int diaPago) {
    }
}
