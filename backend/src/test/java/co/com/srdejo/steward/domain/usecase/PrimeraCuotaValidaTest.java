package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.exception.DomainException;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** La primera cuota va del mes en curso a 12 meses despues; el mes en curso se guarda vacio (design D4 de credito-primera-cuota). */
class PrimeraCuotaValidaTest {

    private static final YearMonth NOV = YearMonth.of(2026, 11);

    @Test
    void rango() {
        assertNull(CuentasUseCase.primeraCuotaValida(null, NOV));
        assertNull(CuentasUseCase.primeraCuotaValida("2026-11", NOV));
        assertEquals(YearMonth.of(2026, 12), CuentasUseCase.primeraCuotaValida("2026-12", NOV));
        assertEquals(YearMonth.of(2027, 11), CuentasUseCase.primeraCuotaValida("2027-11", NOV));
        assertThrows(DomainException.class, () -> CuentasUseCase.primeraCuotaValida("2026-10", NOV));
        assertThrows(DomainException.class, () -> CuentasUseCase.primeraCuotaValida("2027-12", NOV));
        assertThrows(DomainException.class, () -> CuentasUseCase.primeraCuotaValida("dic", NOV));
    }
}
