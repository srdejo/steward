package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IHogarServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.VistaHogar;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IInvitacionPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * El hogar siempre se resuelve desde el usuario de la sesion, nunca desde la peticion (design D6): un usuario solo
 * puede ver y cambiar el suyo.
 */
public class HogarUseCase implements IHogarServicePort {

    private final IHogarPersistencePort hogares;
    private final IInvitacionPersistencePort invitaciones;
    private final ICurrentUserPort usuarioActual;
    private final ITransaccionPort transaccion;
    private final IClockPort clock;

    public HogarUseCase(IHogarPersistencePort hogares, IInvitacionPersistencePort invitaciones,
                        ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock) {
        this.hogares = hogares;
        this.invitaciones = invitaciones;
        this.usuarioActual = usuarioActual;
        this.transaccion = transaccion;
        this.clock = clock;
    }

    @Override
    public Mono<VistaHogar> crear(String nombre) {
        return Mono.fromCallable(() -> nombreValido(nombre)).flatMap(limpio -> usuarioActual.usuarioId()
                .flatMap(usuario -> transaccion.enTransaccion(
                                hogares.crear(new Hogar(UUID.randomUUID(), limpio, false), usuario, clock.hoy()))
                        .flatMap(hogar -> vista(hogar, usuario))));
    }

    @Override
    public Mono<VistaHogar> obtener() {
        return usuarioActual.usuarioId().flatMap(usuario -> hogarDe(usuario).flatMap(hogar -> vista(hogar, usuario)));
    }

    @Override
    public Mono<VistaHogar> renombrar(String nombre) {
        return Mono.fromCallable(() -> nombreValido(nombre)).flatMap(limpio -> usuarioActual.usuarioId()
                .flatMap(usuario -> hogarDe(usuario)
                        .flatMap(hogar -> hogares.renombrar(hogar.id(), limpio)
                                .then(vista(new Hogar(hogar.id(), limpio, hogar.configurado()), usuario)))));
    }

    @Override
    public Mono<Void> completarOnboarding() {
        return usuarioActual.usuarioId().flatMap(this::hogarDe).flatMap(hogar -> hogares.marcarConfigurado(hogar.id()));
    }

    @Override
    public Mono<Void> salir() {
        return usuarioActual.usuarioId().flatMap(usuario -> hogarDe(usuario)
                .flatMap(hogar -> transaccion.enTransaccion(hogares.salir(hogar.id(), usuario).thenReturn(true))))
                .then();
    }

    private Mono<Hogar> hogarDe(UUID usuario) {
        return hogares.hogarDe(usuario).switchIfEmpty(Mono.error(() -> sinHogar()));
    }

    private Mono<VistaHogar> vista(Hogar hogar, UUID usuario) {
        return Mono.zip(hogares.miembros(hogar.id()).collectList(),
                        invitaciones.pendientesVigentes(hogar.id(), clock.ahora()).collectList())
                .map(t -> new VistaHogar(hogar, t.getT1(), usuario, t.getT2()));
    }

    static DomainException sinHogar() {
        return DomainException.noEncontrado("SIN_HOGAR", "Todavía no tienes un hogar");
    }

    private static String nombreValido(String nombre) {
        String limpio = nombre == null ? "" : nombre.strip();
        if (limpio.isEmpty() || limpio.length() > Hogar.NOMBRE_MAX) {
            throw DomainException.datosInvalidos("El nombre del hogar debe tener entre 1 y 60 caracteres");
        }
        return limpio;
    }
}
