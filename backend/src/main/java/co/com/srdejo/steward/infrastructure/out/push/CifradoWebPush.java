package co.com.srdejo.steward.infrastructure.out.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Web Push solo con el JDK (design D4 de avisos-pagos): el cifrado del contenido de RFC 8291 ({@code aes128gcm}: ECDH
 * P-256, HKDF y AES-128-GCM) y la firma VAPID de RFC 8292 (JWT ES256). Sin BouncyCastle, para la imagen nativa.
 */
final class CifradoWebPush {

    static final int TAMANO_REGISTRO = 4096;
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder D64 = Base64.getUrlDecoder();
    private static final SecureRandom AZAR = new SecureRandom();
    private static final ECParameterSpec P256 = parametros();

    private CifradoWebPush() {
    }

    private static ECParameterSpec parametros() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"));
            return ((ECPublicKey) g.generateKeyPair().getPublic()).getParams();
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }

    static byte[] b64(String valor) {
        return D64.decode(valor.replace('+', '-').replace('/', '_').replace("=", ""));
    }

    static String b64(byte[] valor) {
        return B64.encodeToString(valor);
    }

    static KeyPair parEfimero() throws GeneralSecurityException {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        return g.generateKeyPair();
    }

    /** Una llave publica P-256 desde su punto sin comprimir (65 bytes, 0x04 || x || y). */
    static ECPublicKey publica(byte[] punto) throws GeneralSecurityException {
        if (punto.length != 65 || punto[0] != 4) throw new GeneralSecurityException("Punto P-256 invalido");
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(punto, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(punto, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
    }

    /** Una llave privada P-256 desde su escalar (32 bytes). */
    static ECPrivateKey privada(byte[] d) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d), P256));
    }

    static byte[] punto(ECPublicKey k) {
        byte[] p = new byte[65];
        p[0] = 4;
        copiar(k.getW().getAffineX(), p, 1);
        copiar(k.getW().getAffineY(), p, 33);
        return p;
    }

    private static void copiar(BigInteger n, byte[] destino, int desde) {
        byte[] b = n.toByteArray();
        int largo = Math.min(b.length, 32);
        System.arraycopy(b, b.length - largo, destino, desde + 32 - largo, largo);
    }

    private static byte[] hmac(byte[] llave, byte[]... partes) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(llave, "HmacSHA256"));
        for (byte[] p : partes) mac.update(p);
        return mac.doFinal();
    }

    private static byte[] unir(byte[]... partes) {
        ByteArrayOutputStream s = new ByteArrayOutputStream();
        for (byte[] p : partes) s.writeBytes(p);
        return s.toByteArray();
    }

    /** RFC 8291: el cuerpo cifrado (cabecera de aes128gcm y un solo registro). */
    static byte[] cifrar(byte[] contenido, byte[] uaPublica, byte[] secretoAuth) throws GeneralSecurityException {
        byte[] sal = new byte[16];
        AZAR.nextBytes(sal);
        return cifrar(contenido, uaPublica, secretoAuth, parEfimero(), sal);
    }

    static byte[] cifrar(byte[] contenido, byte[] uaPublica, byte[] secretoAuth, KeyPair efimero, byte[] sal) throws GeneralSecurityException {
        byte[] asPublica = punto((ECPublicKey) efimero.getPublic());
        KeyAgreement ecdh = KeyAgreement.getInstance("ECDH");
        ecdh.init(efimero.getPrivate());
        ecdh.doPhase(publica(uaPublica), true);
        byte[] secretoEcdh = ecdh.generateSecret();
        byte[] prkLlave = hmac(secretoAuth, secretoEcdh);
        byte[] infoLlave = unir("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[]{0}, uaPublica, asPublica);
        byte[] ikm = hmac(prkLlave, infoLlave, new byte[]{1});
        byte[] prk = hmac(sal, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, "Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII), new byte[]{0, 1}), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, "Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII), new byte[]{0, 1}), 12);
        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] cifrado = aes.doFinal(unir(contenido, new byte[]{2}));
        ByteBuffer cabecera = ByteBuffer.allocate(16 + 4 + 1 + asPublica.length);
        cabecera.put(sal).putInt(TAMANO_REGISTRO).put((byte) asPublica.length).put(asPublica);
        return unir(cabecera.array(), cifrado);
    }

    /** RFC 8292: {@code vapid t=<jwt>, k=<llave publica>} para el origen del endpoint. */
    static String autorizacionVapid(String endpoint, String sujeto, byte[] vapidPrivada, String vapidPublica, long expiraSegundos)
            throws GeneralSecurityException {
        java.net.URI uri = java.net.URI.create(endpoint);
        String aud = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
        String cabecera = b64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String datos = b64(("{\"aud\":\"" + aud + "\",\"exp\":" + expiraSegundos + ",\"sub\":\"" + sujeto + "\"}").getBytes(StandardCharsets.UTF_8));
        Signature firma = Signature.getInstance("SHA256withECDSA");
        firma.initSign(privada(vapidPrivada));
        firma.update((cabecera + "." + datos).getBytes(StandardCharsets.US_ASCII));
        return "vapid t=" + cabecera + "." + datos + "." + b64(derARaw(firma.sign())) + ", k=" + vapidPublica;
    }

    /** La firma ECDSA del JDK viene en DER; JWT la pide como R || S de 32 bytes cada uno. */
    static byte[] derARaw(byte[] der) {
        int i = 2;
        if ((der[1] & 0x80) != 0) i += der[1] & 0x7f;
        int largoR = der[i + 1];
        byte[] r = Arrays.copyOfRange(der, i + 2, i + 2 + largoR);
        i = i + 2 + largoR;
        int largoS = der[i + 1];
        byte[] s = Arrays.copyOfRange(der, i + 2, i + 2 + largoS);
        byte[] raw = new byte[64];
        copiar(new BigInteger(1, r), raw, 0);
        copiar(new BigInteger(1, s), raw, 32);
        return raw;
    }
}
