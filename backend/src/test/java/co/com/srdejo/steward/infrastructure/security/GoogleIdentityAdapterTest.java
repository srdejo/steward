package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.contract.GoogleDePrueba;
import org.junit.jupiter.api.Test;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.Instant;

import static co.com.srdejo.steward.contract.GoogleDePrueba.CLIENT_ID;

/** Validaciones del ID token de Google (design D5): emisor, audiencia, vigencia y correo verificado. */
class GoogleIdentityAdapterTest {

    private final GoogleIdentityAdapter google = GoogleIdentityAdapter.conLlaveDePrueba(CLIENT_ID, GoogleDePrueba.LLAVE_PUBLICA);

    @Test
    void tokenValidoDaCorreoYNombre() {
        StepVerifier.create(google.verificar(GoogleDePrueba.token("daniel@ejemplo.com", "Daniel")))
                .expectNextMatches(id -> id.email().equals("daniel@ejemplo.com") && id.nombre().equals("Daniel"))
                .verifyComplete();
    }

    @Test
    void emisorSinEsquemaTambienEsValido() {
        String token = GoogleDePrueba.token("d@ejemplo.com", "D", CLIENT_ID, "accounts.google.com", true, Instant.now());
        StepVerifier.create(google.verificar(token)).expectNextCount(1).verifyComplete();
    }

    @Test
    void rechazaOtroEmisor() {
        rechaza(GoogleDePrueba.token("d@ejemplo.com", "D", CLIENT_ID, "https://otro.com", true, Instant.now()));
    }

    @Test
    void rechazaOtraAudiencia() {
        rechaza(GoogleDePrueba.token("d@ejemplo.com", "D", "otro-client", "https://accounts.google.com", true, Instant.now()));
    }

    @Test
    void rechazaTokenVencido() {
        rechaza(GoogleDePrueba.token("d@ejemplo.com", "D", CLIENT_ID, "https://accounts.google.com", true,
                Instant.now().minus(Duration.ofHours(3))));
    }

    @Test
    void rechazaCorreoNoVerificado() {
        rechaza(GoogleDePrueba.token("d@ejemplo.com", "D", CLIENT_ID, "https://accounts.google.com", false, Instant.now()));
    }

    @Test
    void rechazaBasura() {
        rechaza("no-es-un-jwt");
    }

    @Test
    void sinClientIdNoConsultaAGoogle() {
        GoogleIdentityAdapter deshabilitado = GoogleIdentityAdapter.conJwksDeGoogle("  ");
        assert deshabilitado.clientId().isEmpty();
        StepVerifier.create(deshabilitado.verificar(GoogleDePrueba.token("d@ejemplo.com", "D"))).verifyComplete();
    }

    private void rechaza(String token) {
        StepVerifier.create(google.verificar(token)).verifyComplete();
    }
}
