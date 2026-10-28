package co.com.srdejo.steward.domain.spi;

import java.time.Instant;
import java.time.LocalDate;

/** Reloj del hogar (hora de Colombia). Los tests lo fijan para probar vencimientos. */
public interface IClockPort {

    Instant ahora();

    LocalDate hoy();
}
