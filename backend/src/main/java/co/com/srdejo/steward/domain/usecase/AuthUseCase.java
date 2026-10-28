package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IAuthServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.IdentidadGoogle;
import co.com.srdejo.steward.domain.model.Sesion;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IGoogleIdentityPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.ITokenPort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import reactor.core.publisher.Mono;

import java.util.Optional;
import java.util.UUID;

public class AuthUseCase implements IAuthServicePort {

    private final IGoogleIdentityPort google;
    private final IUsuarioPersistencePort usuarios;
    private final IHogarPersistencePort hogares;
    private final ITokenPort tokens;
    private final ICurrentUserPort usuarioActual;
    private final IClockPort clock;

    public AuthUseCase(IGoogleIdentityPort google, IUsuarioPersistencePort usuarios, IHogarPersistencePort hogares,
                       ITokenPort tokens, ICurrentUserPort usuarioActual, IClockPort clock) {
        this.google = google;
        this.usuarios = usuarios;
        this.hogares = hogares;
        this.tokens = tokens;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    @Override
    public Optional<String> googleClientId() {
        return google.clientId();
    }

    @Override
    public Mono<Sesion> loginConGoogle(String idToken) {
        if (google.clientId().isEmpty()) {
            return Mono.error(new DomainException(DomainException.Tipo.NO_DISPONIBLE, "GOOGLE_NO_CONFIGURADO",
                    "El acceso con Google no está disponible"));
        }
        return google.verificar(idToken)
                .switchIfEmpty(Mono.error(() -> new DomainException(DomainException.Tipo.NO_AUTENTICADO,
                        "GOOGLE_TOKEN_INVALIDO", "No pudimos verificar tu cuenta de Google. Intenta de nuevo.")))
                .flatMap(this::usuarioDe)
                .flatMap(usuario -> sesionDe(usuario, tokens.emitir(usuario.id())));
    }

    @Override
    public Mono<Sesion> sesionActual() {
        return usuarioActual.usuarioId()
                .flatMap(this::existente)
                .flatMap(usuario -> sesionDe(usuario, null));
    }

    @Override
    public Mono<Usuario> cambiarNombre(String nombre) {
        String limpio = nombre == null ? "" : nombre.strip();
        if (limpio.isEmpty() || limpio.length() > Usuario.NOMBRE_MAX) {
            return Mono.error(DomainException.datosInvalidos("El nombre debe tener entre 1 y 60 caracteres"));
        }
        return usuarioActual.usuarioId()
                .flatMap(this::existente)
                .flatMap(usuario -> usuarios.actualizarNombre(usuario.id(), limpio));
    }

    private Mono<Usuario> usuarioDe(IdentidadGoogle identidad) {
        return usuarios.porEmail(identidad.email())
                .switchIfEmpty(Mono.defer(() -> usuarios.crearOObtener(new Usuario(UUID.randomUUID(),
                        identidad.email().strip(), nombreInicial(identidad), clock.ahora()))));
    }

    /** Un token valido de un usuario que ya no existe (base limpiada) se trata como sin sesion. */
    private Mono<Usuario> existente(UUID id) {
        return usuarios.porId(id).switchIfEmpty(Mono.error(DomainException::noAutenticado));
    }

    private Mono<Sesion> sesionDe(Usuario usuario, String token) {
        return hogares.estadoDe(usuario.id())
                .map(estado -> new Sesion(token, usuario, estado.tieneHogar(), estado.configurado()));
    }

    private static String nombreInicial(IdentidadGoogle identidad) {
        String nombre = identidad.nombre() == null ? "" : identidad.nombre().strip();
        if (nombre.isEmpty()) {
            nombre = identidad.email().substring(0, Math.max(1, identidad.email().indexOf('@')));
        }
        return nombre.length() > Usuario.NOMBRE_MAX ? nombre.substring(0, Usuario.NOMBRE_MAX) : nombre;
    }
}
