package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.spi.IClockPort;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

public class SystemClockAdapter implements IClockPort {

    private final Clock clock;

    public SystemClockAdapter(Clock clock) {
        this.clock = clock;
    }

    public static SystemClockAdapter enZona(String zona) {
        return new SystemClockAdapter(Clock.system(ZoneId.of(zona)));
    }

    @Override
    public Instant ahora() {
        return clock.instant();
    }

    @Override
    public LocalDate hoy() {
        return LocalDate.now(clock);
    }
}
