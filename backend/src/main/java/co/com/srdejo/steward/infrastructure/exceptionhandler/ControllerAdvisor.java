package co.com.srdejo.steward.infrastructure.exceptionhandler;

import co.com.srdejo.steward.domain.exception.DomainException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebInputException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Formato de error estandar (spec steward-backend-plataforma): {@code codigo} estable y {@code mensaje} en espanol;
 * la validacion agrega {@code campos}. Los 5xx se loguean con su traza, pero nunca la devuelven.
 */
@RestControllerAdvice
public class ControllerAdvisor {

    private static final Logger log = LoggerFactory.getLogger(ControllerAdvisor.class);

    @ExceptionHandler(WebExchangeBindException.class)
    public ResponseEntity<Map<String, Object>> validacion(WebExchangeBindException ex) {
        Map<String, String> campos = new LinkedHashMap<>();
        for (FieldError error : ex.getFieldErrors()) {
            campos.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        Map<String, Object> body = cuerpo("DATOS_INVALIDOS", "Revisa los datos");
        body.put("campos", campos);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(ServerWebInputException.class)
    public ResponseEntity<Map<String, Object>> malFormada(ServerWebInputException ignored) {
        return ResponseEntity.badRequest().body(cuerpo("DATOS_INVALIDOS", "La petición no es válida"));
    }

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<Map<String, Object>> dominio(DomainException ex) {
        HttpStatus status = switch (ex.tipo()) {
            case DATOS_INVALIDOS -> HttpStatus.BAD_REQUEST;
            case NO_AUTENTICADO -> HttpStatus.UNAUTHORIZED;
            case NO_ENCONTRADO -> HttpStatus.NOT_FOUND;
            case CONFLICTO -> HttpStatus.CONFLICT;
            case NO_DISPONIBLE -> HttpStatus.SERVICE_UNAVAILABLE;
        };
        return ResponseEntity.status(status).body(cuerpo(ex.codigo(), ex.getMessage()));
    }

    /** Ruta inexistente (404), metodo no permitido (405) y demas errores de WebFlux que ya traen su estado. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> estado(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null || status.is5xxServerError()) {
            return inesperado(ex);
        }
        return status == HttpStatus.NOT_FOUND
                ? ResponseEntity.status(status).body(cuerpo("NO_ENCONTRADO", "No encontrado"))
                : ResponseEntity.status(status).body(cuerpo("PETICION_NO_VALIDA", "La petición no es válida"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> inesperado(Exception ex) {
        log.error("Error no controlado", ex);
        return ResponseEntity.internalServerError().body(cuerpo("ERROR_INTERNO", "Algo salió mal. Intenta de nuevo."));
    }

    public static Map<String, Object> cuerpo(String codigo, String mensaje) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("codigo", codigo);
        body.put("mensaje", mensaje);
        return body;
    }
}
