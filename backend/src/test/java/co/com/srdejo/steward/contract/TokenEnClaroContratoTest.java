package co.com.srdejo.steward.contract;

import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/** Design D7: en la base solo queda el hash del token; un volcado no sirve para unirse. */
class TokenEnClaroContratoTest extends ContratoBase {

    @Test
    void laBaseNoGuardaElToken() throws Exception {
        String daniel = entrar("daniel@ejemplo.com", "Daniel");
        crearHogar(daniel, "Nuestra casa").expectStatus().isCreated();
        String token = tokenDe(invitar(daniel, "esposa@ejemplo.com"));
        try (Connection c = DriverManager.getConnection(DB_URL, "postgres", "postgres");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery("SELECT * FROM invitacion")) {
            while (r.next()) {
                for (int i = 1; i <= r.getMetaData().getColumnCount(); i++) {
                    String valor = r.getString(i);
                    if (valor != null && valor.contains(token)) {
                        throw new AssertionError("El token en claro esta en la columna " + r.getMetaData().getColumnName(i));
                    }
                }
            }
        }
    }
}
