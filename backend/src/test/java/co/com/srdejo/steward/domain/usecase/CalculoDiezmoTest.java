package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.model.ReglaDiezmo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Las cifras de los tests del dominio compartido (rules.test.ts) y de la spec steward-finanzas. */
class CalculoDiezmoTest {

    private static final BigDecimal DIEZ = new BigDecimal("10.00");

    @Test
    void salarioDanielSobreElBrutoYSobreElNeto() {
        assertEquals(700_000, CalculoDiezmo.monto(DIEZ, 7_000_000, 6_288_000, ReglaDiezmo.Base.BRUTO));
        assertEquals(628_800, CalculoDiezmo.monto(DIEZ, 7_000_000, 6_288_000, ReglaDiezmo.Base.NETO));
    }

    @Test
    void redondeaAlPesoConLasMitadesHaciaArriba() {
        // 12,5 % de 1.000.005 = 125.000,625 → 125.001; 10 % de 15 = 1,5 → 2 (como Math.round).
        assertEquals(125_001, CalculoDiezmo.monto(new BigDecimal("12.50"), 1_000_005, 0, ReglaDiezmo.Base.BRUTO));
        assertEquals(2, CalculoDiezmo.monto(DIEZ, 15, 15, ReglaDiezmo.Base.NETO));
    }

    @Test
    void detalleComoEnElDominio() {
        assertEquals("10% de Salario Daniel · recibido 25 oct",
                CalculoDiezmo.detalle(DIEZ, "Salario Daniel", LocalDate.of(2026, 10, 25)));
        assertEquals("12,5%", CalculoDiezmo.porcentaje(new BigDecimal("12.50")));
        assertEquals("100%", CalculoDiezmo.porcentaje(new BigDecimal("100.00")));
        assertEquals("5 sep", CalculoDiezmo.fechaCorta(LocalDate.of(2026, 9, 5)));
    }
}
