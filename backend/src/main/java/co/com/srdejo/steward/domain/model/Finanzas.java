package co.com.srdejo.steward.domain.model;

import java.time.YearMonth;
import java.util.List;

/**
 * Lo que la PWA superpone a sus datos de prueba (design D5 de backend-ingresos-diezmo y de backend-plan-mes-hoy): el mes
 * en curso, el ajuste de diezmo, las categorias, los ingresos fijos activos, las reglas, las cuentas, los creditos con sus
 * ultimos pagos, y los planes y movimientos desde dos meses antes del mes en curso (mas lo de antes que todavia cuenta en
 * el saldo estimado de una cuenta, design D2 de backend-cuentas-creditos), y los cierres desde el mes anterior a esos (design D4
 * de backend-cierre-mes), y los planes anuales y aportes proyectados desde el año de esos meses (design D5 de
 * backend-plan-anual).
 */
public record Finanzas(YearMonth mes, DiezmoEnHoy diezmoEnHoy, List<Categoria> categorias, List<IngresoFijo> ingresosFijos,
                       List<ReglaDiezmo> reglas, List<Cuenta> cuentas, List<PlanMes> planes, List<Movimiento> movimientos,
                       List<Credito> creditos, List<CierreMes> cierres, List<PlanAnual> anuales,
                       List<PlanAnual.Proyeccion> proyecciones) {
}
