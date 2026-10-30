package co.com.srdejo.steward.infrastructure.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.predicate.RuntimeHintsPredicates;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Lo que el binario nativo necesita y la JVM no nota (produccion-steward D1). */
class NativeHintsTest {

    @Test
    void laLlaveDelGoogleDePruebaEntraAlBinario() {
        RuntimeHints hints = new RuntimeHints();
        new NativeHints().registerHints(hints, getClass().getClassLoader());
        assertTrue(RuntimeHintsPredicates.resource().forResource("contract-google-test-public.pem").test(hints));
    }
}
