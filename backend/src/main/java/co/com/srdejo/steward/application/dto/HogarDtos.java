package co.com.srdejo.steward.application.dto;

import co.com.srdejo.steward.application.dto.AuthDtos.UsuarioResponse;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.Invitacion;
import co.com.srdejo.steward.domain.model.InvitacionEnviada;
import co.com.srdejo.steward.domain.model.InvitacionRecibida;
import co.com.srdejo.steward.domain.model.MiInvitacion;
import co.com.srdejo.steward.domain.model.VistaHogar;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Contrato HTTP del hogar e invitaciones; lo consume el adaptador HTTP de la PWA (design D9). */
public final class HogarDtos {

    private HogarDtos() {
    }

    public record NombreHogarRequest(
            @NotBlank(message = "Escribe el nombre del hogar")
            @Size(max = Hogar.NOMBRE_MAX, message = "Máximo 60 caracteres") String nombre) {
    }

    public record InvitarRequest(
            @NotBlank(message = "Escribe un correo")
            @Email(message = "Ese correo no es válido") String email) {
    }

    public record AceptarRequest(
            @NotBlank(message = "Escribe tu nombre")
            @Size(max = 60, message = "Máximo 60 caracteres") String nombre,
            boolean diezmoAportes) {
    }

    public record MiembroResponse(UsuarioResponse usuario, LocalDate unidoEn, boolean esActual) {
    }

    public record InvitacionResponse(UUID id, String email, String estado, Instant enviadaEn, Instant expiraEn) {

        public static InvitacionResponse de(Invitacion inv) {
            return new InvitacionResponse(inv.id(), inv.email(), inv.estado().name(), inv.enviadaEn(), inv.expiraEn());
        }
    }

    public record HogarResponse(UUID id, String nombre, boolean configurado, List<MiembroResponse> miembros,
                                List<InvitacionResponse> invitaciones) {

        public static HogarResponse de(VistaHogar vista) {
            return new HogarResponse(vista.hogar().id(), vista.hogar().nombre(), vista.hogar().configurado(),
                    vista.miembros().stream()
                            .map(m -> new MiembroResponse(UsuarioResponse.de(m.usuario()), m.unidoEn(),
                                    m.usuario().id().equals(vista.usuarioActual())))
                            .toList(),
                    vista.invitaciones().stream().map(InvitacionResponse::de).toList());
        }
    }

    /** {@code enlace} lleva el token nuevo: el anterior ya no sirve. */
    public record InvitacionEnviadaResponse(InvitacionResponse invitacion, String enlace, boolean correoEnviado) {

        public static InvitacionEnviadaResponse de(InvitacionEnviada enviada) {
            return new InvitacionEnviadaResponse(InvitacionResponse.de(enviada.invitacion()), enviada.enlace(),
                    enviada.correoEnviado());
        }
    }

    /** Invitacion pendiente para el correo de la sesion (se acepta por id, sin el enlace). */
    public record MiInvitacionResponse(UUID id, String hogar, UsuarioResponse invitadoPor, List<UsuarioResponse> miembros,
                                       String email) {

        public static MiInvitacionResponse de(MiInvitacion mi) {
            InvitacionRecibida r = mi.detalle();
            return new MiInvitacionResponse(mi.id(), r.hogar(), UsuarioResponse.de(r.invitadoPor()),
                    r.miembros().stream().map(UsuarioResponse::de).toList(), r.email());
        }
    }

    public record InvitacionRecibidaResponse(String hogar, UsuarioResponse invitadoPor, List<UsuarioResponse> miembros,
                                             String email) {

        public static InvitacionRecibidaResponse de(InvitacionRecibida recibida) {
            return new InvitacionRecibidaResponse(recibida.hogar(), UsuarioResponse.de(recibida.invitadoPor()),
                    recibida.miembros().stream().map(UsuarioResponse::de).toList(), recibida.email());
        }
    }
}
