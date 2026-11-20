package co.com.srdejo.steward.domain.model;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** La primera cuota en {@code pagaEnMes} (design D2 de credito-primera-cuota), con "Johana" y hoy en noviembre de 2026. */
class PrimeraCuotaTest {

    private static final YearMonth NOV = YearMonth.of(2026, 11);
    private static final YearMonth DIC = YearMonth.of(2026, 12);

    private static Credito johana(YearMonth primera) {
        return new Credito(UUID.randomUUID(), UUID.randomUUID(), "Johana", "Johana", 192_000_000, LocalDate.of(2026, 11, 3),
                2_000_000, BigDecimal.ZERO, 1, 192_000_000, List.of(), Credito.Metodo.TASA, null, 0, null, primera);
    }

    @Test
    void noPagaAntesDeLaPrimeraCuotaYTerminaUnMesDespues() {
        Credito c = johana(DIC);
        assertFalse(Amortizacion.pagaEnMes(c, NOV, NOV, false));
        assertTrue(Amortizacion.pagaEnMes(c, DIC, NOV, false));
        // 96 cuotas desde diciembre: la ultima es noviembre de 2034.
        assertTrue(Amortizacion.pagaEnMes(c, YearMonth.of(2034, 11), NOV, false));
        assertFalse(Amortizacion.pagaEnMes(c, YearMonth.of(2034, 12), NOV, false));
        // Sin primera cuota, la ultima es octubre de 2034.
        assertFalse(Amortizacion.pagaEnMes(johana(null), YearMonth.of(2034, 11), NOV, false));
    }

    @Test
    void desdeElMesDeLaPrimeraCuotaNoInfluye() {
        Credito c = johana(DIC);
        assertNull(c.primeraCuotaPendiente(DIC));
        assertEquals(DIC, c.primeraCuotaPendiente(NOV));
        assertTrue(Amortizacion.pagaEnMes(c, DIC, DIC, false));
        // Pagada la de diciembre, la proxima es enero, como cualquier credito.
        assertFalse(Amortizacion.pagaEnMes(c, DIC, DIC, true));
        assertTrue(Amortizacion.pagaEnMes(c, DIC.plusMonths(1), DIC, true));
    }

}
