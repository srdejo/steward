package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.IdentidadGoogle;
import reactor.core.publisher.Mono;

import java.util.Optional;

/** Verifica ID tokens de Google Identity Services (design D5). */
public interface IGoogleIdentityPort {

    /** El client id configurado (el de beauty); vacio si el login con Google esta deshabilitado. */
    Optional<String> clientId();

    /** La identidad del token si es valido para nuestro client id; vacio si no. */
    Mono<IdentidadGoogle> verificar(String idToken);
}
