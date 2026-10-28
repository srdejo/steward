package co.com.srdejo.steward.domain.exception;

/**
 * Error de negocio con un {@code codigo} estable (en mayusculas) y un mensaje en espanol para la persona. El dominio no
 * conoce HTTP: el {@link Tipo} lo traduce a un estado el {@code ControllerAdvisor}.
 */
public class DomainException extends RuntimeException {

    public enum Tipo {
        DATOS_INVALIDOS,
        NO_AUTENTICADO,
        NO_ENCONTRADO,
        CONFLICTO,
        NO_DISPONIBLE
    }

    private final Tipo tipo;
    private final String codigo;

    public DomainException(Tipo tipo, String codigo, String mensaje) {
        super(mensaje);
        this.tipo = tipo;
        this.codigo = codigo;
    }

    public Tipo tipo() {
        return tipo;
    }

    public String codigo() {
        return codigo;
    }

    public static DomainException noEncontrado(String codigo, String mensaje) {
        return new DomainException(Tipo.NO_ENCONTRADO, codigo, mensaje);
    }

    public static DomainException conflicto(String codigo, String mensaje) {
        return new DomainException(Tipo.CONFLICTO, codigo, mensaje);
    }

    public static DomainException datosInvalidos(String mensaje) {
        return new DomainException(Tipo.DATOS_INVALIDOS, "DATOS_INVALIDOS", mensaje);
    }

    public static DomainException noAutenticado() {
        return new DomainException(Tipo.NO_AUTENTICADO, "NO_AUTENTICADO", "Inicia sesión para continuar");
    }
}
