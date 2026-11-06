package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IAuthServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.IdentidadApple;
import co.com.srdejo.steward.domain.model.IdentidadGoogle;
import co.com.srdejo.steward.domain.model.Sesion;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IAppleIdentityPort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IGoogleIdentityPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IIngresoFijoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITokenPort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import co.com.srdejo.steward.domain.spi.IUsuarioPersistencePort;
import reactor.core.publisher.Mono;

import java.util.Optional;
import java.util.UUID;

public class AuthUseCase implements IAuthServicePort {

    private final IGoogleIdentityPort google;
    private final IAppleIdentityPort apple;
    private final IIngresoFijoPersistencePort ingresos;
    private final ICuentaPersistencePort cuentas;
    private final ITransaccionPort transaccion;
    private final IUsuarioPersistencePort usuarios;
    private final IHogarPersistencePort hogares;
    private final ITokenPort tokens;
    private final ICurrentUserPort usuarioActual;
    private final IClockPort clock;
    private final boolean devLogin;

    public AuthUseCase(IGoogleIdentityPort google, IAppleIdentityPort apple, IUsuarioPersistencePort usuarios, IHogarPersistencePort hogares,
                       IIngresoFijoPersistencePort ingresos, ICuentaPersistencePort cuentas, ITokenPort tokens,
                       ICurrentUserPort usuarioActual, ITransaccionPort transaccion, IClockPort clock, boolean devLogin) {
        this.google = google;
        this.apple = apple;
        this.ingresos = ingresos;
        this.cuentas = cuentas;
        this.transaccion = transaccion;
        this.usuarios = usuarios;
        this.hogares = hogares;
        this.tokens = tokens;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
        this.devLogin = devLogin;
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

    /** Se busca por su identificador de Apple; si no existe, por su correo verificado (design D4 de app-movil-conectada). */
    @Override
    public Mono<Sesion> loginConApple(String identityToken, String nombre) {
        return apple.verificar(identityToken)
                .switchIfEmpty(Mono.error(() -> new DomainException(DomainException.Tipo.NO_AUTENTICADO,
                        "APPLE_TOKEN_INVALIDO", "No pudimos verificar tu cuenta de Apple. Intenta de nuevo.")))
                .flatMap(identidad -> usuarios.porAppleSub(identidad.sub())
                        .switchIfEmpty(Mono.defer(() -> primeraVezConApple(identidad, nombre))))
                .flatMap(usuario -> sesionDe(usuario, tokens.emitir(usuario.id())));
    }

    private Mono<Usuario> primeraVezConApple(IdentidadApple identidad, String nombre) {
        // Sin correo verificado, uno reservado: la columna es obligatoria y el usuario se reconoce por su identificador.
        String email = identidad.email() == null ? "apple-" + identidad.sub() + "@apple.invalid" : identidad.email();
        return usuarioDe(new IdentidadGoogle(email, nombre)).flatMap(usuario -> usuarios.enlazarApple(usuario.id(), identidad.sub()));
    }

    /**
     * Sale de su hogar, como "Salir del hogar", y la cuenta se borra o se anonimiza si quedan registros suyos en un hogar
     * compartido (design D5 de app-movil-conectada). Revocar va despues y no puede impedirlo.
     */
    @Override
    public Mono<Void> eliminarCuenta(String appleAuthorizationCode) {
        return usuarioActual.usuarioId().flatMap(usuario -> transaccion.enTransaccion(hogares.hogarDe(usuario)
                        .flatMap(hogar -> ingresos.desactivarDe(hogar.id(), usuario)
                                .then(cuentas.quitarPropias(hogar.id(), usuario))
                                .then(hogares.salir(hogar.id(), usuario))
                                .thenReturn(true))
                        .then(usuarios.eliminar(usuario))
                        .thenReturn(true))
                .then(apple.revocar(appleAuthorizationCode)));
    }

    @Override
    public boolean devLogin() {
        return devLogin;
    }

    @Override
    public Mono<Sesion> loginDesarrollo(String email, String nombre) {
        if (!devLogin) {
            return Mono.error(() -> DomainException.noEncontrado("NO_ENCONTRADO", "No encontrado"));
        }
        return usuarioDe(new IdentidadGoogle(email.strip(), nombre))
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
