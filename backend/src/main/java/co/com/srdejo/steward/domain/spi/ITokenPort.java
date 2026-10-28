package co.com.srdejo.steward.domain.spi;

import java.util.UUID;

/** Emite el token de sesion de un usuario. Lo valida la seguridad de la infraestructura en cada peticion. */
public interface ITokenPort {

    String emitir(UUID usuarioId);
}
