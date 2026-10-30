package co.com.srdejo.steward.infrastructure.configuration;

import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;

/**
 * Lo que la imagen nativa no descubre sola (produccion-steward D1). Los recursos del classpath solo entran al
 * binario si se registran: la llave publica del Google de prueba la lee el perfil contract por ResourceLoader.
 */
class NativeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.resources().registerPattern("contract-google-test-public.pem");
    }
}
