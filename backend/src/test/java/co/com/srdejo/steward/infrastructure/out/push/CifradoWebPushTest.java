package co.com.srdejo.steward.infrastructure.out.push;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;

import static co.com.srdejo.steward.infrastructure.out.push.CifradoWebPush.b64;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** El cifrado de Web Push contra el ejemplo del apendice A de RFC 8291, y la firma VAPID verificable (avisos-pagos, D4). */
class CifradoWebPushTest {

    @Test
    void cifraComoElEjemploDeRfc8291() throws Exception {
        byte[] asPrivada = b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
        byte[] asPublica = b64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
        byte[] uaPublica = b64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] auth = b64("BTBZMqHH6r4Tts7J_aSIgg");
        byte[] sal = b64("DGv6ra1nlYgDCS1FRnbzlw");
        KeyPair efimero = new KeyPair(CifradoWebPush.publica(asPublica), CifradoWebPush.privada(asPrivada));
        byte[] cuerpo = CifradoWebPush.cifrar("When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8), uaPublica, auth, efimero, sal);
        assertEquals("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN", b64(cuerpo));
    }

    @Test
    void firmaVapidVerificable() throws Exception {
        KeyPair vapid = CifradoWebPush.parEfimero();
        byte[] d = ((java.security.interfaces.ECPrivateKey) vapid.getPrivate()).getS().toByteArray();
        byte[] d32 = new byte[32];
        System.arraycopy(d, Math.max(0, d.length - 32), d32, Math.max(0, 32 - d.length), Math.min(32, d.length));
        String publica = b64(CifradoWebPush.punto((ECPublicKey) vapid.getPublic()));
        String auth = CifradoWebPush.autorizacionVapid("https://fcm.googleapis.com/fcm/send/abc", "https://steward.srdejo.com.co", d32, publica, 1_900_000_000L);
        assertTrue(auth.startsWith("vapid t=") && auth.endsWith(", k=" + publica));
        String jwt = auth.substring("vapid t=".length(), auth.indexOf(", k="));
        String[] partes = jwt.split("\\.");
        assertTrue(new String(b64(partes[1]), StandardCharsets.UTF_8).contains("\"aud\":\"https://fcm.googleapis.com\""));
        // R || S de vuelta a DER para verificar con el JDK.
        byte[] raw = b64(partes[2]);
        Signature v = Signature.getInstance("SHA256withECDSAinP1363Format");
        v.initVerify(vapid.getPublic());
        v.update((partes[0] + "." + partes[1]).getBytes(StandardCharsets.US_ASCII));
        assertTrue(v.verify(raw));
    }
}
