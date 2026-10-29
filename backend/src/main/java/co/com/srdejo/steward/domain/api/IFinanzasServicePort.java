package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.ObligacionDiezmo;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Finanzas del hogar de la sesion (spec steward-finanzas): regla de diezmo, ingresos fijos, recibir y entregar el diezmo,
 * "Diezmo en Hoy" y cuentas basicas. Todo se resuelve desde el usuario de la sesion.
 */
public interface IFinanzasServicePort {

    /** Todo lo que la PWA superpone a sus datos de prueba, en una lectura. */
    Mono<Finanzas> leer();

    /** Crea o reemplaza la regla propia; el texto de la base y el porcentaje se validan aqui. */
    Mono<ReglaDiezmo> guardarRegla(boolean activa, BigDecimal porcentaje, String base, boolean aplicaAportes);

    Mono<IngresoFijo> crearIngreso(DatosIngreso datos);

    Mono<IngresoFijo> editarIngreso(UUID id, DatosIngreso datos);

    /** Lo desactiva: lo ya recibido lo sigue nombrando. */
    Mono<Void> quitarIngreso(UUID id);

    /** "Recibi" en el mes en curso. */
    Mono<Movimiento> recibir(UUID ingresoId);

    Flux<ObligacionDiezmo> pendientes();

    /** "Entregado": cubre las obligaciones pendientes de esa lista; los demas ids se ignoran. */
    Mono<Movimiento> entregar(List<UUID> obligaciones, UUID cuentaId);

    Mono<Void> definirDiezmoEnHoy(String modo);

    /** {@code conjunta} falso: a nombre de quien la crea. */
    Mono<Cuenta> crearCuenta(String nombre, boolean conjunta, long saldo);

    record DatosIngreso(String nombre, long bruto, long neto, int diaPago, UUID cuentaId) {
    }
}
