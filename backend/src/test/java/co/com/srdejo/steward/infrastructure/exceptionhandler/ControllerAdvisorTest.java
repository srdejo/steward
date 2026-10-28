package co.com.srdejo.steward.infrastructure.exceptionhandler;

import co.com.srdejo.steward.domain.exception.DomainException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/** Formato de error estandar de la spec steward-backend-plataforma, sin levantar la app. */
class ControllerAdvisorTest {

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToController(new PruebaController())
                .controllerAdvice(new ControllerAdvisor())
                .build();
    }

    @Test
    void validacionDevuelve400ConCampos() {
        client.post().uri("/prueba").contentType(MediaType.APPLICATION_JSON).bodyValue("{\"nombre\":\"\"}")
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS")
                .jsonPath("$.campos.nombre").isNotEmpty();
    }

    @Test
    void cuerpoMalFormadoDevuelve400() {
        client.post().uri("/prueba").contentType(MediaType.APPLICATION_JSON).bodyValue("{no es json")
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody().jsonPath("$.codigo").isEqualTo("DATOS_INVALIDOS");
    }

    @Test
    void erroresDeDominioUsanSuEstadoYCodigo() {
        esperar("no-autenticado", 401, "NO_AUTENTICADO");
        esperar("no-encontrado", 404, "SIN_HOGAR");
        esperar("conflicto", 409, "YA_TIENE_HOGAR");
        esperar("no-disponible", 503, "GOOGLE_NO_CONFIGURADO");
    }

    @Test
    void errorInesperadoNoExponeDetalles() {
        client.get().uri("/prueba/inesperado").exchange()
                .expectStatus().is5xxServerError()
                .expectBody()
                .jsonPath("$.codigo").isEqualTo("ERROR_INTERNO")
                .jsonPath("$.mensaje").isEqualTo("Algo salió mal. Intenta de nuevo.")
                .jsonPath("$.trace").doesNotExist()
                .consumeWith(r -> {
                    String body = new String(r.getResponseBody());
                    if (body.contains("SELECT") || body.contains("Exception")) {
                        throw new AssertionError("El cuerpo expone detalles internos: " + body);
                    }
                });
    }

    @Test
    void rutaInexistenteDevuelve404Estandar() {
        client.get().uri("/no-existe").exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.codigo").isEqualTo("NO_ENCONTRADO");
    }

    private void esperar(String caso, int estado, String codigo) {
        client.get().uri("/prueba/{caso}", caso).exchange()
                .expectStatus().isEqualTo(estado)
                .expectBody()
                .jsonPath("$.codigo").isEqualTo(codigo)
                .jsonPath("$.mensaje").isNotEmpty();
    }

    record Datos(@NotBlank(message = "Escribe un nombre") String nombre) {
    }

    @RestController
    static class PruebaController {

        @PostMapping("/prueba")
        Mono<String> crear(@Valid @RequestBody Datos datos) {
            return Mono.just(datos.nombre());
        }

        @GetMapping("/prueba/inesperado")
        Mono<String> inesperado() {
            return Mono.error(new IllegalStateException("SELECT * FROM hogar fallo"));
        }

        @GetMapping("/prueba/{caso}")
        Mono<String> caso(@PathVariable String caso) {
            return Mono.error(switch (caso) {
                case "no-autenticado" -> DomainException.noAutenticado();
                case "no-encontrado" -> DomainException.noEncontrado("SIN_HOGAR", "Todavía no tienes un hogar");
                case "conflicto" -> DomainException.conflicto("YA_TIENE_HOGAR", "Ya perteneces a un hogar");
                case "no-disponible" -> new DomainException(DomainException.Tipo.NO_DISPONIBLE, "GOOGLE_NO_CONFIGURADO",
                        "El acceso con Google no está disponible");
                default -> new IllegalArgumentException(caso);
            });
        }
    }
}
