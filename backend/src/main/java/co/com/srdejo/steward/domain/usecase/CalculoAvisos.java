package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.model.Aviso;
import co.com.srdejo.steward.domain.model.Aviso.Destino;
import co.com.srdejo.steward.domain.model.Aviso.Grupo;
import co.com.srdejo.steward.domain.model.CierreMes;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.Tarjeta;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Que se avisa y cuando (spec steward-avisos, "Qué se avisa" y "Cuándo se avisa"; design D1 de avisos-pagos). Reproduce
 * {@code proximosAvisos} y {@code momentosDeHoy} del dominio compartido sobre las finanzas del hogar; las pruebas usan los
 * mismos casos que {@code avisos.test.ts}.
 */
public final class CalculoAvisos {

    /** Lo que muestra Avisos: lo vencido y lo de los proximos 30 dias. */
    public static final int DIAS = 30;
    /** Una cuenta sin cuadrar hace mas de esto se recuerda. */
    static final int DIAS_CUADRE = 30;

    /** Los momentos de push de un pago: el lunes de su semana, el dia anterior y el mismo dia sin pagar. */
    public enum Momento {
        LUNES,
        ANTES,
        DIA
    }

    private static final Map<Grupo, Integer> ORDEN = Map.of(Grupo.VENCIDO, 0, Grupo.SEMANA, 1, Grupo.ADELANTE, 2, Grupo.NO_OLVIDAR, 3);

    private CalculoAvisos() {
    }

    public static List<Aviso> proximos(Finanzas f, LocalDate hoy) {
        return proximos(f, hoy, DIAS);
    }

    public static List<Aviso> proximos(Finanzas f, LocalDate hoy, int dias) {
        YearMonth actual = YearMonth.from(hoy);
        LocalDate hasta = hoy.plusDays(dias);
        List<Aviso> avisos = new ArrayList<>();
        avisos.addAll(pagos(f, actual, hoy, hasta, true));
        avisos.addAll(pagos(f, actual.plusMonths(1), hoy, hasta, false));
        avisos.addAll(cortes(f, hoy, hasta));
        avisos.addAll(ingresos(f, actual, hoy, hasta, true));
        avisos.addAll(ingresos(f, actual.plusMonths(1), hoy, hasta, false));
        avisos.addAll(plan(f, actual, hoy, hasta));
        avisos.addAll(cuadre(f, hoy));
        avisos.sort(Comparator.<Aviso>comparingInt(a -> ORDEN.get(a.grupo())).thenComparing(Aviso::fecha).thenComparing(Aviso::nombre));
        return avisos;
    }

    /** Lo que toca hoy por push para un aviso con fecha (sin vencidos: se ven en Avisos y en Hoy). */
    public static Set<Momento> momentosDeHoy(LocalDate fecha, LocalDate hoy) {
        long dias = ChronoUnit.DAYS.between(hoy, fecha);
        Set<Momento> m = EnumSet.noneOf(Momento.class);
        if (hoy.getDayOfWeek() == DayOfWeek.MONDAY && dias >= 0 && dias <= 6) m.add(Momento.LUNES);
        if (dias == 1) m.add(Momento.ANTES);
        if (dias == 0) m.add(Momento.DIA);
        return m;
    }

    /** Los avisos de la campana: lo vencido y lo de los proximos 7 dias, sin los cortes. */
    public static long pendientes(List<Aviso> avisos) {
        return avisos.stream().filter(a -> (a.grupo() == Grupo.VENCIDO || a.grupo() == Grupo.SEMANA) && !a.corte()).count();
    }

    // --- Reglas ---------------------------------------------------------------------------------------------------

    static String cuando(long dias) {
        if (dias == 0) return "Hoy";
        if (dias == 1) return "Mañana";
        if (dias == -1) return "Ayer";
        return dias > 0 ? "En " + dias + " días" : "Hace " + (-dias) + " días";
    }

    private static Grupo grupo(long dias) {
        return dias < 0 ? Grupo.VENCIDO : dias <= 7 ? Grupo.SEMANA : Grupo.ADELANTE;
    }

    static LocalDate enMes(YearMonth ref, int dia) {
        return ref.atDay(Math.min(dia, ref.lengthOfMonth()));
    }

    private static String clave(YearMonth ref) {
        return ref.toString();
    }

    private static PlanMes planDe(Finanzas f, YearMonth ref) {
        return f.planes().stream().filter(p -> p.ref().equals(ref)).findFirst().orElse(null);
    }

    private static boolean cerrado(Finanzas f, PlanMes plan, YearMonth ref, LocalDate hoy) {
        boolean conCierre = f.cierres().stream().map(CierreMes::ref).anyMatch(ref::equals);
        return conCierre || (plan != null && plan.estadoEn(hoy) == PlanMes.Estado.CERRADO);
    }

    private static boolean pagado(Finanzas f, ItemPlan i, YearMonth ref) {
        return f.movimientos().stream().anyMatch(m -> (m.tipo() == Movimiento.Tipo.PAGO || m.tipo() == Movimiento.Tipo.GASTO)
                && i.id().equals(m.itemId()) && ref.equals(m.ref()));
    }

    private static Aviso.Tipo tipoDe(ItemPlan i) {
        if (i.tarjetaId() != null) return Aviso.Tipo.TARJETA;
        if (i.tipo() == ItemPlan.Tipo.CREDITO || i.tipo() == ItemPlan.Tipo.CUOTA) return Aviso.Tipo.CUOTA;
        return Aviso.Tipo.PAGO;
    }

    /** "Cuota 4 de 12"; {@code adelante}: meses despues del en curso. */
    private static String cuotaDe(Finanzas f, ItemPlan i, int adelante) {
        if (i.cuotaActual() != null && i.cuotaTotal() != null) return "Cuota " + i.cuotaActual() + " de " + i.cuotaTotal();
        Credito c = i.creditoId() == null ? null : f.creditos().stream().filter(x -> x.id().equals(i.creditoId())).findFirst().orElse(null);
        if (c != null && c.metodo() == Credito.Metodo.PLAN && c.numeroCuotas() != null && !i.nombre().startsWith("Abono")) {
            return "Cuota " + Math.min(c.numeroCuotas(), c.cuotasPagadas() + 1 + adelante) + " de " + c.numeroCuotas();
        }
        return null;
    }

    private static List<Aviso> pagos(Finanzas f, YearMonth ref, LocalDate hoy, LocalDate hasta, boolean conVencidos) {
        PlanMes plan = planDe(f, ref);
        if (plan == null || cerrado(f, plan, ref, hoy) || plan.principal() == null) return List.of();
        List<Aviso> avisos = new ArrayList<>();
        for (ItemPlan i : plan.principal().items()) {
            if (i.tipo() == ItemPlan.Tipo.VARIABLE || i.tipo() == ItemPlan.Tipo.DIEZMO || i.diaVence() == null) continue;
            if (pagado(f, i, ref)) continue;
            LocalDate fecha = enMes(ref, i.diaVence());
            long dias = ChronoUnit.DAYS.between(hoy, fecha);
            if (fecha.isAfter(hasta) || (dias < 0 && !conVencidos)) continue;
            Aviso.Tipo tipo = tipoDe(i);
            Tarjeta tarjeta = i.tarjetaId() == null ? null : f.tarjetas().stream().filter(t -> t.id().equals(i.tarjetaId())).findFirst().orElse(null);
            String cuota = tipo == Aviso.Tipo.CUOTA ? cuotaDe(f, i, conVencidos ? 0 : 1) : null;
            String c = cuando(dias);
            String detalle = cuota != null ? cuota + " · " + c.toLowerCase()
                    : tarjeta != null ? c + " · " + (tarjeta.pagoTipo() == Tarjeta.Pago.FIJO ? "pago fijo" : "valor del extracto") : c;
            avisos.add(new Aviso(tipo + ":" + i.id() + ":" + clave(ref), tipo, fecha, i.nombre().replaceFirst("^Tarjeta ", ""), detalle,
                    i.monto(), false, grupo(dias), new Aviso.Pago(i.id(), ref), null));
        }
        return avisos;
    }

    /** {@code proximaFecha}: la primera fecha con ese dia desde hoy, incluido. */
    static LocalDate proximaFecha(int dia, LocalDate hoy) {
        LocalDate este = enMes(YearMonth.from(hoy), dia);
        return este.isBefore(hoy) ? enMes(YearMonth.from(hoy).plusMonths(1), dia) : este;
    }

    private static List<Aviso> cortes(Finanzas f, LocalDate hoy, LocalDate hasta) {
        List<Aviso> avisos = new ArrayList<>();
        for (Tarjeta t : f.tarjetas()) {
            LocalDate fecha = proximaFecha(t.diaCorte(), hoy);
            if (fecha.isAfter(hasta)) continue;
            long dias = ChronoUnit.DAYS.between(hoy, fecha);
            avisos.add(new Aviso("CORTE:" + t.id() + ":" + clave(YearMonth.from(fecha)), Aviso.Tipo.TARJETA, fecha, "Corte " + t.nombre(),
                    cuando(dias), null, true, grupo(dias), null, null));
        }
        return avisos;
    }

    /** Los ingresos fijos por recibir con su dia: las lineas FIJO del plan, o los ingresos fijos sin plan. */
    private static List<Aviso> ingresos(Finanzas f, YearMonth ref, LocalDate hoy, LocalDate hasta, boolean conVencidos) {
        PlanMes plan = planDe(f, ref);
        if (cerrado(f, plan, ref, hoy)) return List.of();
        record Linea(String id, String nombre, long monto, IngresoFijo fijo, java.util.UUID lineaId) {
        }
        List<Linea> lineas = new ArrayList<>();
        if (plan != null && plan.principal() != null) {
            for (PlanMes.IngresoPlan l : plan.principal().ingresos()) {
                if (l.tipo() != PlanMes.IngresoPlan.Tipo.FIJO || l.ingresoFijoId() == null) continue;
                f.ingresosFijos().stream().filter(x -> x.id().equals(l.ingresoFijoId())).findFirst()
                        .ifPresent(fijo -> lineas.add(new Linea(l.id().toString(), l.nombre(), l.monto(), fijo, l.id())));
            }
        } else {
            for (IngresoFijo fijo : f.ingresosFijos()) lineas.add(new Linea(fijo.id().toString(), fijo.nombre(), fijo.neto(), fijo, null));
        }
        List<Aviso> avisos = new ArrayList<>();
        for (Linea l : lineas) {
            boolean recibido = f.movimientos().stream().anyMatch(m -> m.tipo() == Movimiento.Tipo.INGRESO_FIJO && ref.equals(m.ref())
                    && ((l.lineaId() != null && l.lineaId().equals(m.ingresoPlanId())) || l.fijo().id().equals(m.ingresoFijoId())));
            if (recibido) continue;
            LocalDate fecha = enMes(ref, l.fijo().diaPago());
            long dias = ChronoUnit.DAYS.between(hoy, fecha);
            if (fecha.isAfter(hasta) || (dias < 0 && !conVencidos)) continue;
            avisos.add(new Aviso("INGRESO:" + l.id() + ":" + clave(ref), Aviso.Tipo.INGRESO, fecha, "¿Llegó " + l.nombre() + "?", cuando(dias),
                    l.monto(), false, grupo(dias), null, new Destino("HOY", null, null)));
        }
        return avisos;
    }

    private static List<Aviso> plan(Finanzas f, YearMonth actual, LocalDate hoy, LocalDate hasta) {
        List<Aviso> avisos = new ArrayList<>();
        PlanMes planActual = planDe(f, actual);
        if (planActual != null && !cerrado(f, planActual, actual, hoy)) {
            LocalDate fecha = actual.atEndOfMonth();
            long dias = ChronoUnit.DAYS.between(hoy, fecha);
            if (!fecha.isAfter(hasta)) {
                avisos.add(new Aviso("PLAN:cerrar:" + clave(actual), Aviso.Tipo.PLAN, fecha, "Cerrar " + Formato.nombreMes(actual.getMonthValue()),
                        cuando(dias) + " · último día del mes", null, false, grupo(dias), null, new Destino("CIERRE", actual, null)));
            }
        }
        YearMonth siguiente = actual.plusMonths(1);
        PlanMes planSiguiente = planDe(f, siguiente);
        long opciones = planSiguiente == null ? 0 : planSiguiente.escenarios().stream().filter(e -> !e.archivado()).count();
        if (planSiguiente != null && planSiguiente.escenarioActivoId() == null && opciones > 1 && planSiguiente.estadoEn(hoy) == PlanMes.Estado.BORRADOR) {
            LocalDate fecha = siguiente.atDay(1);
            long dias = ChronoUnit.DAYS.between(hoy, fecha);
            if (!fecha.isAfter(hasta)) {
                String mes = Formato.nombreMes(siguiente.getMonthValue());
                String empieza = dias <= 0 ? "hoy" : dias == 1 ? "mañana" : "en " + dias + " días";
                avisos.add(new Aviso("PLAN:opcion:" + clave(siguiente), Aviso.Tipo.PLAN, fecha, "Elegir opción de " + mes,
                        Character.toUpperCase(mes.charAt(0)) + mes.substring(1) + " empieza " + empieza + " · " + opciones + " opciones",
                        null, false, grupo(dias), null, new Destino("COMPARAR", siguiente, null)));
            }
        }
        return avisos;
    }

    private static List<Aviso> cuadre(Finanzas f, LocalDate hoy) {
        List<Aviso> avisos = new ArrayList<>();
        for (Cuenta c : f.cuentas()) {
            long dias = ChronoUnit.DAYS.between(c.fechaCuadre(), hoy);
            if (c.cuadrada() && dias <= DIAS_CUADRE) continue;
            avisos.add(new Aviso("CUADRAR:" + c.id() + ":" + clave(YearMonth.from(hoy)), Aviso.Tipo.CUADRAR, hoy, "Cuadrar " + c.nombre(),
                    "Sin cuadrar desde el " + Formato.fechaCorta(c.fechaCuadre()), null, false, Grupo.NO_OLVIDAR, null, new Destino("CUENTA", null, c.id())));
        }
        return avisos;
    }
}
