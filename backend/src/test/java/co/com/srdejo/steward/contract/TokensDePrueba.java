package co.com.srdejo.steward.contract;

import co.com.srdejo.steward.infrastructure.security.JwtTokenAdapter;
import co.com.srdejo.steward.infrastructure.security.SystemClockAdapter;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

/** Tokens de sesion firmados con el secreto del perfil contract (application-contract.yml). */
public final class TokensDePrueba {

    public static final String SECRETO_CONTRACT = "contract-only-secret-steward-0123456789abcdef0123456789abcdef0123456789";

    private TokensDePrueba() {
    }

    public static String sesion(UUID usuarioId, Instant emitidoEn) {
        Clock fijo = Clock.fixed(emitidoEn, ZoneId.of("America/Bogota"));
        return new JwtTokenAdapter(SECRETO_CONTRACT, Duration.ofDays(7), new SystemClockAdapter(fijo)).emitir(usuarioId);
    }

    public static String conOtroSecreto(UUID usuarioId) {
        Clock ahora = Clock.system(ZoneId.of("America/Bogota"));
        return new JwtTokenAdapter("otro-secreto-que-no-es-el-del-servidor-0123456789abcdef0123456789abc",
                Duration.ofDays(7), new SystemClockAdapter(ahora)).emitir(usuarioId);
    }
}
