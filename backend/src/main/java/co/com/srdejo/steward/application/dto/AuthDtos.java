package co.com.srdejo.steward.application.dto;

import co.com.srdejo.steward.domain.model.Sesion;
import co.com.srdejo.steward.domain.model.Usuario;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Contrato HTTP de acceso; lo consume el adaptador HTTP de la PWA (design D9). */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record AuthConfigResponse(String googleClientId) {
    }

    public record GoogleLoginRequest(@NotBlank(message = "Falta el token de Google") String idToken) {
    }

    public record PerfilRequest(
            @NotBlank(message = "Escribe tu nombre")
            @Size(max = Usuario.NOMBRE_MAX, message = "Máximo 60 caracteres") String nombre) {
    }

    public record UsuarioResponse(UUID id, String nombre, String email, String inicial) {

        public static UsuarioResponse de(Usuario usuario) {
            return new UsuarioResponse(usuario.id(), usuario.nombre(), usuario.email(), usuario.inicial());
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SesionResponse(String token, UsuarioResponse usuario, boolean tieneHogar, boolean hogarConfigurado) {

        public static SesionResponse de(Sesion sesion) {
            return new SesionResponse(sesion.token(), UsuarioResponse.de(sesion.usuario()), sesion.tieneHogar(),
                    sesion.hogarConfigurado());
        }
    }
}
