package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.ICierreServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.CierreMes;
import co.com.srdejo.steward.domain.spi.ICierrePersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.ICuentaPersistencePort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IMovimientoPersistencePort;
import co.com.srdejo.steward.domain.spi.ITransaccionPort;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * "Cerrar {mes}" (spec steward-plan-mes, design D1 de backend-cierre-mes). La foto (filas, sobrante) la calcula la PWA con
 * {@code vistaCierre} del dominio compartido; el backend no la recalcula. Si valida el reparto ({@code repartoValido}),
 * que "Sin registrar" sea la suma de los ajustes del mes, y que nadie haya registrado algo en el mes despues de calcularla.
 */
public class CierreUseCase implements ICierreServicePort {

    private static final int NOMBRE_FILA_MAX = 60;

    private final ICierrePersistencePort cierres;
    private final IMovimientoPersistencePort movimientos;
    private final ITransaccionPort transaccion;
    private final Registro registro;

    public CierreUseCase(IHogarPersistencePort hogares, ICuentaPersistencePort cuentas, ICierrePersistencePort cierres,
                         IMovimientoPersistencePort movimientos, ICurrentUserPort usuarioActual, ITransaccionPort transaccion,
                         IClockPort clock) {
        this.cierres = cierres;
        this.movimientos = movimientos;
        this.transaccion = transaccion;
        this.registro = new Registro(hogares, cuentas, usuarioActual, clock);
    }

    @Override
    public Mono<CierreMes> cerrar(DatosCierre datos) {
        return Mono.fromCallable(() -> valido(datos)).flatMap(d -> registro.contexto().flatMap(ctx -> {
            CierreMes cierre = new CierreMes(UUID.randomUUID(), ctx.hogar().id(), d.ref(), d.filas(), d.sinRegistrar(),
                    d.sobrante(), d.aAhorro(), d.aSiguiente(), ctx.usuario(), registro.hoy());
            return transaccion.enTransaccion(cierres.estaCerrado(ctx.hogar().id(), d.ref())
                    .flatMap(cerrado -> cerrado ? Mono.<CierreMes>error(PlanUseCase.mesCerrado())
                            : movimientos.paraCierre(ctx.hogar().id(), d.ref()).flatMap(mes ->
                            mes.ajustes() != d.sinRegistrar() || mes.ultimoSeq() > d.ultimoSeq()
                                    ? Mono.<CierreMes>error(desactualizado(d))
                                    : cierres.guardar(cierre))));
        }));
    }

    private DatosCierre valido(DatosCierre d) {
        if (d.ref() == null || d.ref().isAfter(registro.mesEnCurso())) {
            throw DomainException.datosInvalidos("Solo se cierra el mes en curso o uno anterior");
        }
        if (d.filas() == null || d.filas().stream().anyMatch(f -> f == null || f.nombre() == null || f.nombre().isBlank()
                || f.nombre().length() > NOMBRE_FILA_MAX)) {
            throw DomainException.datosInvalidos("Faltan las filas del cierre");
        }
        CierreMes reparto = new CierreMes(null, null, d.ref(), d.filas(), d.sinRegistrar(), d.sobrante(), d.aAhorro(),
                d.aSiguiente(), null, null);
        if (!reparto.repartoValido()) {
            throw new DomainException(DomainException.Tipo.DATOS_INVALIDOS, "REPARTO_INVALIDO",
                    "El reparto debe sumar lo que sobró");
        }
        return d;
    }

    private static DomainException desactualizado(DatosCierre d) {
        return DomainException.conflicto("CIERRE_DESACTUALIZADO", "Alguien registró algo en "
                + Formato.nombreMes(d.ref().getMonthValue()) + "; revisa el cierre otra vez");
    }
}
