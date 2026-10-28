package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IInvitacionServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Invitacion;
import co.com.srdejo.steward.domain.model.InvitacionEnviada;
import co.com.srdejo.steward.domain.model.InvitacionRecibida;
import co.com.srdejo.steward.domain.model.Miembro;
import co.com.srdejo.steward.domain.model.Sesion;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IInvitacionPersistencePort;
import co.com.srdejo.steward.domain.spi.IMailPort;
import co.com.srdejo.steward.domain.spi.ITokenGeneratorPort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Invitaciones (design D7). El token en claro solo existe en el enlace: invitar, reenviar u obtener el enlace generan
 * uno nuevo y el anterior deja de servir. Si el correo falla, la invitacion queda igual y se puede copiar el enlace.
 */
public class InvitacionUseCase implements IInvitacionServicePort {

    static final Duration VIGENCIA = Duration.ofDays(7);

    private final IHogarPersistencePort hogares;
    private final IInvitacionPersistencePort invitaciones;
    private final IUsuarioPersistencePort usuarios;
    private final ITokenGeneratorPort tokens;
    private final IMailPort correo;
    private final ICurrentUserPort usuarioActual;
    private final ITransaccionPort transaccion;
    private final IClockPort clock;
    private final String publicUrl;

    public InvitacionUseCase(IHogarPersistencePort hogares, IInvitacionPersistencePort invitaciones,
                             IUsuarioPersistencePort usuarios, ITokenGeneratorPort tokens, IMailPort correo,
                             ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock,
                             String publicUrl) {
        this.hogares = hogares;
        this.invitaciones = invitaciones;
        this.usuarios = usuarios;
        this.tokens = tokens;
        this.correo = correo;
        this.usuarioActual = usuarioActual;
        this.transaccion = transaccion;
        this.clock = clock;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    @Override
    public Mono<InvitacionEnviada> invitar(String email) {
        String correoInvitado = email == null ? "" : email.strip();
        return contexto().flatMap(ctx -> hogares.tieneMiembroConEmail(ctx.hogar().id(), correoInvitado)
                .flatMap(yaEsMiembro -> yaEsMiembro
                        ? Mono.error(DomainException.conflicto("YA_ES_MIEMBRO", "Esa persona ya es parte del hogar"))
                        // Una sola pendiente por correo: invitar de nuevo reenvia la misma.
                        : invitaciones.pendientePorEmail(ctx.hogar().id(), correoInvitado)
                                .flatMap(existente -> rotar(ctx, existente, true))
                                .switchIfEmpty(Mono.defer(() -> crearYEnviar(ctx, correoInvitado)))));
    }

    @Override
    public Mono<InvitacionEnviada> reenviar(UUID invitacionId) {
        return contexto().flatMap(ctx -> vigenteDelHogar(invitacionId, ctx).flatMap(inv -> rotar(ctx, inv, true)));
    }

    @Override
    public Mono<InvitacionEnviada> enlace(UUID invitacionId) {
        return contexto().flatMap(ctx -> vigenteDelHogar(invitacionId, ctx).flatMap(inv -> rotar(ctx, inv, false)));
    }

    @Override
    public Mono<InvitacionRecibida> consultar(String token) {
        return vigentePorToken(token).flatMap(inv -> Mono.zip(
                        hogares.miembros(inv.hogarId()).map(Miembro::usuario).collectList(),
                        usuarios.porId(inv.creadaPor()),
                        hogares.porId(inv.hogarId()).switchIfEmpty(Mono.error(InvitacionUseCase::noValida)))
                .map(t -> new InvitacionRecibida(t.getT3().nombre(), t.getT2(), t.getT1(), inv.email())));
    }

    @Override
    public Mono<Sesion> aceptar(String token, String nombre, boolean diezmoAportes) {
        String limpio = nombre == null ? "" : nombre.strip();
        if (limpio.isEmpty() || limpio.length() > Usuario.NOMBRE_MAX) {
            return Mono.error(DomainException.datosInvalidos("El nombre debe tener entre 1 y 60 caracteres"));
        }
        return usuarioActual.usuarioId().flatMap(usuario -> vigentePorToken(token)
                .flatMap(inv -> transaccion.enTransaccion(
                        // Unir primero: si ya tiene hogar falla con YA_TIENE_HOGAR y la invitacion no se consume.
                        hogares.unir(inv.hogarId(), usuario, clock.hoy(), diezmoAportes)
                                .then(invitaciones.marcarAceptada(inv.id(), usuario, clock.ahora()))
                                .flatMap(marcada -> marcada ? usuarios.actualizarNombre(usuario, limpio)
                                        : Mono.error(InvitacionUseCase::noValida))))
                .flatMap(actualizado -> hogares.estadoDe(usuario)
                        .map(estado -> new Sesion(null, actualizado, estado.tieneHogar(), estado.configurado()))));
    }

    private Mono<InvitacionEnviada> crearYEnviar(Contexto ctx, String email) {
        Instant ahora = clock.ahora();
        String token = tokens.nuevo();
        Invitacion nueva = new Invitacion(UUID.randomUUID(), ctx.hogar().id(), email, Invitacion.Estado.PENDIENTE,
                ctx.usuario().id(), ahora, ahora.plus(VIGENCIA));
        return invitaciones.crear(nueva, tokens.hash(token)).flatMap(inv -> enviar(ctx, inv, token, true));
    }

    /** Token nuevo y 7 dias desde ahora; con correo es "reenviar", sin correo es "copiar enlace". */
    private Mono<InvitacionEnviada> rotar(Contexto ctx, Invitacion inv, boolean conCorreo) {
        Instant ahora = clock.ahora();
        String token = tokens.nuevo();
        return invitaciones.rotar(inv.id(), ctx.hogar().id(), tokens.hash(token), ahora, ahora.plus(VIGENCIA))
                .flatMap(rotada -> conCorreo ? enviar(ctx, rotada, token, false)
                        : Mono.just(new InvitacionEnviada(rotada, enlaceDe(token), false, false)));
    }

    private Mono<InvitacionEnviada> enviar(Contexto ctx, Invitacion inv, String token, boolean nueva) {
        String enlace = enlaceDe(token);
        return correo.enviarInvitacion(inv.email(), ctx.usuario().nombre(), ctx.hogar().nombre(), enlace)
                .thenReturn(true)
                // Correo caido: la invitacion ya quedo; se avisa para que copien el enlace (spec "Correo caido").
                .onErrorReturn(false)
                .map(enviado -> new InvitacionEnviada(inv, enlace, enviado, nueva));
    }

    private Mono<Invitacion> vigenteDelHogar(UUID id, Contexto ctx) {
        return invitaciones.porIdEnHogar(id, ctx.hogar().id())
                .filter(inv -> inv.vigenteEn(clock.ahora()))
                .switchIfEmpty(Mono.error(() -> DomainException.noEncontrado("INVITACION_NO_ENCONTRADA",
                        "Esa invitación ya no está pendiente")));
    }

    private Mono<Invitacion> vigentePorToken(String token) {
        if (token == null || token.isBlank()) {
            return Mono.error(InvitacionUseCase::noValida);
        }
        return invitaciones.porTokenHash(tokens.hash(token))
                .filter(inv -> inv.vigenteEn(clock.ahora()))
                .switchIfEmpty(Mono.error(InvitacionUseCase::noValida));
    }

    private Mono<Contexto> contexto() {
        return usuarioActual.usuarioId().flatMap(id -> Mono.zip(
                        usuarios.porId(id).switchIfEmpty(Mono.error(DomainException::noAutenticado)),
                        hogares.hogarDe(id).switchIfEmpty(Mono.error(HogarUseCase::sinHogar)))
                .map(t -> new Contexto(t.getT1(), t.getT2())));
    }

    private String enlaceDe(String token) {
        return publicUrl + "/invitacion/" + token;
    }

    /** Inexistente, vencida o ya usada: la misma respuesta, sin distinguir (spec "Consultar una invitacion"). */
    static DomainException noValida() {
        return DomainException.noEncontrado("INVITACION_NO_VALIDA", "Esta invitación ya no es válida");
    }

    private record Contexto(Usuario usuario, Hogar hogar) {
    }
}
