package co.com.srdejo.steward.domain.model;

import java.time.YearMonth;
import java.util.List;

/**
 * Lo que la PWA superpone a sus datos de prueba (design D5): el mes en curso, el ajuste de diezmo, los ingresos fijos
 * activos, las reglas, las cuentas y los movimientos del mes.
 */
public record Finanzas(YearMonth mes, DiezmoEnHoy diezmoEnHoy, List<IngresoFijo> ingresosFijos, List<ReglaDiezmo> reglas,
                       List<Cuenta> cuentas, List<Movimiento> movimientos) {
}
