package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

/**
 * Lo comun de lo que se registra en el hogar de la sesion (design D6 de backend-cuentas-creditos): el hogar, el mes en
 * curso del backend, quien pago o aporto y desde donde.
 */
final class Registro {

    private final IHogarPersistencePort hogares;
    private final ICuentaPersistencePort cuentas;
    private final ICurrentUserPort usuarioActual;
    private final IClockPort clock;

    Registro(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas, ICurrentUserPort usuarioActual,
             IClockPort clock) {
        this.hogares = hogares;
        this.cuentas = cuentas;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    LocalDate hoy() {
        return clock.hoy();
    }

    YearMonth mesEnCurso() {
        return YearMonth.from(clock.hoy());
    }

    Mono<Contexto> contexto() {
        return usuarioActual.usuarioId().flatMap(usuario -> hogares.hogarDe(usuario)
                .switchIfEmpty(Mono.error(HogarUseCase::sinHogar))
                .map(hogar -> new Contexto(usuario, hogar)));
    }

    static long montoValido(long monto, String mensaje) {
        if (monto <= 0) {
            throw DomainException.datosInvalidos(mensaje);
        }
        return monto;
    }

    /** Quien pago (o aporto) es del hogar, y el origen es una cuenta del hogar, "Su cuenta" o ninguno. */
    Mono<OrigenValido> origenValido(Contexto ctx, UUID usuarioId, String origen, UUID cuentaId) {
        Movimiento.Origen tipo;
        try {
            tipo = Movimiento.Origen.valueOf(origen);
        } catch (IllegalArgumentException | NullPointerException ex) {
            return Mono.error(DomainException.datosInvalidos("El origen es CUENTA, EXTERNA o NINGUNO"));
        }
        Mono<Void> miembro = hogares.miembros(ctx.hogar().id())
                .filter(m -> m.usuario().id().equals(usuarioId))
                .next()
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("MIEMBRO_NO_ENCONTRADO",
                        "Esa persona no es del hogar")))
                .then();
        if (tipo != Movimiento.Origen.CUENTA) {
            return miembro.thenReturn(new OrigenValido(tipo, null));
        }
        if (cuentaId == null) {
            return Mono.error(DomainException.datosInvalidos("Elige la cuenta"));
        }
        return miembro.then(cuentaDelHogar(cuentaId, ctx.hogar().id())).thenReturn(new OrigenValido(tipo, cuentaId));
    }

    Mono<Void> cuentaDelHogar(UUID cuentaId, UUID hogarId) {
        if (cuentaId == null) {
            return Mono.empty();
        }
        return cuentas.porIdEnHogar(cuentaId, hogarId)
                .switchIfEmpty(Mono.error(Registro::cuentaNoEncontrada))
                .then();
    }

    static DomainException cuentaNoEncontrada() {
        return DomainException.noEncontrado("CUENTA_NO_ENCONTRADA", "Esa cuenta no existe");
    }

    record Contexto(UUID usuario, Hogar hogar) {
    }

    record OrigenValido(Movimiento.Origen origen, UUID cuentaId) {
    }
}
