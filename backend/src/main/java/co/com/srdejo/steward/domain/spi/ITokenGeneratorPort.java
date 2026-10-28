package co.com.srdejo.steward.domain.spi;

/** Tokens de invitacion: aleatorios e imposibles de adivinar; en la base solo va su hash (design D7). */
public interface ITokenGeneratorPort {

    String nuevo();

    String hash(String token);
}
