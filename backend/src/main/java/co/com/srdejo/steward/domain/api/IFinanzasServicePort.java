package co.com.srdejo.steward.domain.api;

import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.UUID;

/**
 * Finanzas del hogar de la sesion (spec steward-finanzas): regla de diezmo, ingresos fijos, recibir, los registros de Hoy y
 * cuentas basicas. Todo se resuelve desde el usuario de la sesion.
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

    /** "Recibi" un ingreso fijo en el mes en curso (un mes sin plan); {@code monto} null es su neto. */
    Mono<Movimiento> recibir(UUID ingresoId, Long monto);

    /** "Recibi" una linea de ingreso de la opcion principal del mes en curso; {@code monto} null es el de la linea. */
    Mono<Movimiento> recibirLinea(UUID planId, UUID escenarioId, UUID lineaId, Long monto);

    /** {@code conjunta} falso: a nombre de quien la crea. */
    Mono<Cuenta> crearCuenta(String nombre, boolean conjunta, long saldo);

    /**
     * "Marcar pago" de un item de la opcion principal del mes en curso. {@code origen}: CUENTA (con {@code cuentaId}),
     * EXTERNA ("Su cuenta") o NINGUNO.
     */
    Mono<Movimiento> pagar(UUID itemId, long monto, UUID usuarioId, String origen, UUID cuentaId);

    /** "Registrar gasto" del mes en curso; {@code itemId} null es "No estaba planeado". */
    Mono<Movimiento> gastar(UUID itemId, long monto, String nota, UUID usuarioId, String origen, UUID cuentaId);

    /** "+ Aporte" para el mes en curso o el siguiente. */
    Mono<Movimiento> aportar(UUID usuarioId, long monto, YearMonth mes, UUID cuentaId, boolean aplicaDiezmo);

    /** Corregir un pago, gasto, ingreso recibido o aporte (design D3 de usabilidad-plan); los null no cambian. */
    Mono<Movimiento> corregirRegistro(UUID id, Long monto, String origen, UUID cuentaId, String nota);

    Mono<Void> borrarRegistro(UUID id);

    /** "Empezar de nuevo" (design D4 de usabilidad-plan). */
    Mono<Void> empezarDeNuevo();

    record DatosIngreso(String nombre, long bruto, long neto, int diaPago, UUID cuentaId) {
    }
}
