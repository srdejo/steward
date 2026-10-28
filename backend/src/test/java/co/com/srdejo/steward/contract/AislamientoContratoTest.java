package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.util.List;
import java.util.Map;

/** Spec steward-hogar, "Aislamiento entre hogares": recursos ajenos dan 404 y no hay fugas con concurrencia. */
class AislamientoContratoTest extends ContratoBase {

    @Test
    void invitacionAjena() {
        String a = entrar("a@ejemplo.com", "Ana");
        crearHogar(a, "Casa A").expectStatus().isCreated();
        String b = entrar("b@ejemplo.com", "Beto");
        crearHogar(b, "Casa B").expectStatus().isCreated();
        String tokenDeB = tokenDe(invitar(b, "invitado-b@ejemplo.com"));
        String idDeB = idDeInvitacion(b);

        client.post().uri("/api/hogar/invitaciones/{id}/reenviar", idDeB).header("Authorization", "Bearer " + a)
                .exchange().expectStatus().isNotFound();
        client.post().uri("/api/hogar/invitaciones/{id}/enlace", idDeB).header("Authorization", "Bearer " + a)
                .exchange().expectStatus().isNotFound();
        // La invitacion de B no cambio: su enlace sigue sirviendo.
        client.get().uri("/api/invitaciones/{t}", tokenDeB).exchange().expectStatus().isOk();
    }

    @Test
    void peticionesSimultaneas() {
        String a = entrar("a@ejemplo.com", "Ana");
        crearHogar(a, "Casa A").expectStatus().isCreated();
        String b = entrar("b@ejemplo.com", "Beto");
        crearHogar(b, "Casa B").expectStatus().isCreated();

        List<String> errores = Flux.range(0, 50)
                .flatMap(i -> Flux.just(new String[]{a, "Casa A"}, new String[]{b, "Casa B"}))
                .parallel(16).runOn(Schedulers.boundedElastic())
                .map(par -> {
                    Map<?, ?> hogar = client.get().uri("/api/hogar").header("Authorization", "Bearer " + par[0])
                            .exchange().expectStatus().isOk().expectBody(Map.class).returnResult().getResponseBody();
                    return par[1].equals(hogar.get("nombre")) ? "" : "esperaba " + par[1] + " y llego " + hogar.get("nombre");
                })
                .sequential()
                .filter(e -> !e.isEmpty())
                .collectList()
                .block();
        if (!errores.isEmpty()) {
            throw new AssertionError("Fuga entre hogares: " + errores);
        }
    }

    private String idDeInvitacion(String token) {
        Map<?, ?> hogar = client.get().uri("/api/hogar").header("Authorization", "Bearer " + token).exchange()
                .expectBody(Map.class).returnResult().getResponseBody();
        return (String) ((Map<?, ?>) ((List<?>) hogar.get("invitaciones")).getFirst()).get("id");
    }
}
