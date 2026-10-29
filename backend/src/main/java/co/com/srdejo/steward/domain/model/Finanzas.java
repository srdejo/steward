package co.com.srdejo.steward.domain.model;

import java.time.YearMonth;
import java.util.List;

/**
 * Lo que la PWA superpone a sus datos de prueba (design D5 de backend-ingresos-diezmo y de backend-plan-mes-hoy): el mes
 * en curso, el ajuste de diezmo, las categorias, los ingresos fijos activos, las reglas, las cuentas, y los planes y
 * movimientos desde dos meses antes del mes en curso.
 */
public record Finanzas(YearMonth mes, DiezmoEnHoy diezmoEnHoy, List<Categoria> categorias, List<IngresoFijo> ingresosFijos,
                       List<ReglaDiezmo> reglas, List<Cuenta> cuentas, List<PlanMes> planes, List<Movimiento> movimientos) {
}
