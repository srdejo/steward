package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.model.Aviso;
import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.IngresoFijo;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.IngresoPlan;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.Tarjeta;
import co.com.srdejo.steward.domain.usecase.CalculoAvisos.Momento;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Spec steward-avisos, "Qué se avisa" y "Cuándo se avisa" (avisos-pagos): los casos de avisos.test.ts del dominio, al
 * lunes 26 oct 2026 con lo esencial de los datos de prueba.
 */
class CalculoAvisosTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 26);
    private static final YearMonth OCT = YearMonth.of(2026, 10);
    private static final YearMonth NOV = YearMonth.of(2026, 11);
    private static final UUID HOGAR = UUID.randomUUID();
    private static final UUID DANIEL = UUID.randomUUID();
    private final UUID nu = UUID.randomUUID();
    private final UUID master = UUID.randomUUID();
    private final UUID salario = UUID.randomUUID();
    private final UUID escOct = UUID.randomUUID();
    private final UUID itemMaster = UUID.randomUUID();

    private ItemPlan item(UUID id, UUID esc, String nombre, long monto, Integer dia, ItemPlan.Tipo tipo, Integer cuota, Integer total, UUID tarjeta) {
        return new ItemPlan(id, esc, UUID.randomUUID(), nombre, monto, dia, tipo, cuota, total, 0, null, null, null, null, false, tarjeta);
    }

    private Finanzas finanzas(List<Movimiento> movimientos) {
        UUID linea = UUID.randomUUID();
        Escenario oct = new Escenario(escOct, UUID.randomUUID(), "A", DANIEL, "", false,
                List.of(new IngresoPlan(linea, escOct, "Salario Daniel", 6_288_000, DANIEL, IngresoPlan.Tipo.FIJO, salario, 7_000_000, 0)),
                List.of(item(UUID.randomUUID(), escOct, "Compra a cuotas", 375_000, 20, ItemPlan.Tipo.CUOTA, 4, 12, null),
                        item(UUID.randomUUID(), escOct, "Tarjeta Nu · Mercado", 320_000, 28, ItemPlan.Tipo.CREDITO, null, null, nu),
                        item(itemMaster, escOct, "Tarjeta Mastercard", 1_500_000, 30, ItemPlan.Tipo.CREDITO, null, null, master),
                        item(UUID.randomUUID(), escOct, "Transporte", 250_000, null, ItemPlan.Tipo.VARIABLE, null, null, null),
                        item(UUID.randomUUID(), escOct, "Diezmo del salario", 700_000, 25, ItemPlan.Tipo.DIEZMO, null, null, null)));
        UUID escNov = UUID.randomUUID();
        List<Escenario> nov = new ArrayList<>();
        for (String letra : List.of("A", "B", "C")) {
            UUID e = letra.equals("A") ? escNov : UUID.randomUUID();
            nov.add(new Escenario(e, UUID.randomUUID(), letra, DANIEL, "", false,
                    List.of(new IngresoPlan(UUID.randomUUID(), e, "Salario Daniel", 6_288_000, DANIEL, IngresoPlan.Tipo.FIJO, salario, 7_000_000, 0)),
                    List.of(item(UUID.randomUUID(), e, "Pensión", 550_000, 5, ItemPlan.Tipo.FIJO, null, null, null))));
        }
        List<PlanMes> planes = List.of(
                new PlanMes(UUID.randomUUID(), HOGAR, OCT, PlanMes.Estado.ACTIVO, escOct, List.of(oct)),
                new PlanMes(UUID.randomUUID(), HOGAR, NOV, PlanMes.Estado.BORRADOR, null, nov));
        List<Tarjeta> tarjetas = List.of(new Tarjeta(nu, HOGAR, "Nu", 13, 28, "Mercado", Tarjeta.Pago.COMPLETA, 320_000),
                new Tarjeta(master, HOGAR, "Mastercard", 15, 30, "", Tarjeta.Pago.FIJO, 1_500_000));
        List<Cuenta> cuentas = List.of(new Cuenta(UUID.randomUUID(), HOGAR, "Davivienda", DANIEL, 0, HOY.minusDays(3), true, 0),
                new Cuenta(UUID.randomUUID(), HOGAR, "Ahorros Esposa", null, 0, LocalDate.of(2026, 9, 20), true, 0));
        List<IngresoFijo> fijos = List.of(new IngresoFijo(salario, HOGAR, DANIEL, "Salario Daniel", 7_000_000, 6_288_000, 25, null, true));
        List<Movimiento> movs = new ArrayList<>(movimientos);
        movs.add(movimiento(Movimiento.Tipo.INGRESO_FIJO, null, salario, LocalDate.of(2026, 10, 25)));
        return new Finanzas(OCT, List.of(), fijos, List.of(), cuentas, planes, movs, List.of(), List.of(), List.of(), List.of(), tarjetas);
    }

    private Movimiento movimiento(Movimiento.Tipo tipo, UUID itemId, UUID ingresoFijo, LocalDate fecha) {
        return new Movimiento(UUID.randomUUID(), HOGAR, tipo, OCT, 1, fecha, DANIEL, DANIEL, null, ingresoFijo, null, false,
                List.of(), itemId, "", Movimiento.Origen.NINGUNO, null, null, null, null, 0);
    }

    private static List<String> grupo(List<Aviso> avisos, Aviso.Grupo g) {
        return avisos.stream().filter(a -> a.grupo() == g)
                .map(a -> a.fecha() + " " + a.nombre() + " | " + a.detalle() + (a.monto() == null ? "" : " | " + a.monto())).toList();
    }

    @Test
    void proximosEl26DeOctubre() {
        List<Aviso> avisos = CalculoAvisos.proximos(finanzas(List.of()), HOY);
        assertEquals(List.of("2026-10-20 Compra a cuotas | Cuota 4 de 12 · hace 6 días | 375000"), grupo(avisos, Aviso.Grupo.VENCIDO));
        assertEquals(List.of(
                "2026-10-28 Nu · Mercado | En 2 días · valor del extracto | 320000",
                "2026-10-30 Mastercard | En 4 días · pago fijo | 1500000",
                "2026-10-31 Cerrar octubre | En 5 días · último día del mes",
                "2026-11-01 Elegir opción de noviembre | Noviembre empieza en 6 días · 3 opciones"), grupo(avisos, Aviso.Grupo.SEMANA));
        assertTrue(grupo(avisos, Aviso.Grupo.ADELANTE).contains("2026-11-05 Pensión | En 10 días | 550000"));
        assertTrue(grupo(avisos, Aviso.Grupo.ADELANTE).contains("2026-11-13 Corte Nu | En 18 días"));
        assertTrue(grupo(avisos, Aviso.Grupo.ADELANTE).contains("2026-11-25 ¿Llegó Salario Daniel? | En 30 días | 6288000"));
        assertEquals(List.of("2026-10-26 Cuadrar Ahorros Esposa | Sin cuadrar desde el 20 sep"), grupo(avisos, Aviso.Grupo.NO_OLVIDAR));
        // Ni variables ni diezmo; y el salario de octubre ya llego.
        assertFalse(avisos.stream().anyMatch(a -> a.nombre().startsWith("Transporte") || a.nombre().startsWith("Diezmo")));
        assertEquals(5, CalculoAvisos.pendientes(avisos));
    }

    @Test
    void loPagadoDejaDeAvisarse() {
        Movimiento pago = movimiento(Movimiento.Tipo.PAGO, itemMaster, null, LocalDate.of(2026, 10, 27));
        List<Aviso> avisos = CalculoAvisos.proximos(finanzas(List.of(pago)), HOY.plusDays(1));
        assertFalse(avisos.stream().anyMatch(a -> a.nombre().equals("Mastercard") && a.fecha().getMonthValue() == 10));
    }

    @Test
    void elLunesElDiaAnteriorYElMismoDia() {
        LocalDate viernes = LocalDate.of(2026, 10, 30);
        assertEquals(Set.of(Momento.LUNES), CalculoAvisos.momentosDeHoy(viernes, HOY));
        assertEquals(Set.of(), CalculoAvisos.momentosDeHoy(viernes, LocalDate.of(2026, 10, 28)));
        assertEquals(Set.of(Momento.ANTES), CalculoAvisos.momentosDeHoy(viernes, LocalDate.of(2026, 10, 29)));
        assertEquals(Set.of(Momento.DIA), CalculoAvisos.momentosDeHoy(viernes, viernes));
        assertEquals(Set.of(), CalculoAvisos.momentosDeHoy(viernes, LocalDate.of(2026, 10, 31)));
        assertEquals(Set.of(Momento.LUNES, Momento.ANTES), CalculoAvisos.momentosDeHoy(LocalDate.of(2026, 10, 27), HOY));
        assertEquals(Set.of(), CalculoAvisos.momentosDeHoy(LocalDate.of(2026, 11, 2), HOY));
    }
}
