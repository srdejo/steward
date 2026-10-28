package co.com.srdejo.steward;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import java.util.TimeZone;

@SpringBootApplication
@ConfigurationPropertiesScan
public class StewardApplication {

	public static void main(String[] args) {
		// Fechas de union, vencimientos de invitaciones y el mes del hogar se cuentan en hora de Colombia.
		TimeZone.setDefault(TimeZone.getTimeZone("America/Bogota"));
		SpringApplication.run(StewardApplication.class, args);
	}

}
