package co.com.srdejo.steward.infrastructure.security;

import co.com.srdejo.steward.domain.spi.ITokenGeneratorPort;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** 32 bytes de SecureRandom en Base64URL; en la base solo va su SHA-256 (design D7, como denti-caja). */
public class SecureTokenGenerator implements ITokenGeneratorPort {

    private final SecureRandom random = new SecureRandom();

    @Override
    public String nuevo() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Override
    public String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
