package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.FinanzasDtos.AporteRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CorregirRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CuentaRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CuentaResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.FinanzasResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.GastoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.IngresoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.IngresoResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.MesResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.MovimientoResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.OrigenDto;
import co.com.srdejo.steward.application.dto.FinanzasDtos.PagoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.RecibirRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.ReglaRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.ReglaResponse;
import co.com.srdejo.steward.domain.api.IFinanzasServicePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.YearMonth;
import java.util.UUID;

/**
 * Finanzas del hogar de la sesion (spec steward-finanzas, design D1). Como en HogarController, el hogar sale de la sesion,
 * nunca de la URL.
 */
@RestController
public class FinanzasController {

    private final IFinanzasServicePort finanzas;
    private final IClockPort clock;

    public FinanzasController(IFinanzasServicePort finanzas, IClockPort clock) {
        this.finanzas = finanzas;
        this.clock = clock;
    }

    @GetMapping("/api/finanzas")
    public Mono<FinanzasResponse> leer() {
        return finanzas.leer().map(f -> FinanzasResponse.de(f, clock.hoy()));
    }

    @PutMapping("/api/regla-diezmo")
    public Mono<ReglaResponse> guardarRegla(@Valid @RequestBody ReglaRequest r) {
        return finanzas.guardarRegla(r.activa(), r.porcentaje(), r.base(), r.aplicaAportes()).map(ReglaResponse::de);
    }

    @PostMapping("/api/ingresos-fijos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<IngresoResponse> crearIngreso(@RequestBody IngresoRequest r) {
        return finanzas.crearIngreso(r.datos()).map(IngresoResponse::de);
    }

    @PutMapping("/api/ingresos-fijos/{id}")
    public Mono<IngresoResponse> editarIngreso(@PathVariable UUID id, @RequestBody IngresoRequest r) {
        return finanzas.editarIngreso(id, r.datos()).map(IngresoResponse::de);
    }

    @DeleteMapping("/api/ingresos-fijos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> quitarIngreso(@PathVariable UUID id) {
        return finanzas.quitarIngreso(id);
    }

    /** "Recibi" un ingreso fijo en un mes sin plan; el cuerpo, con el monto que llego, es opcional. */
    @PostMapping("/api/ingresos-fijos/{id}/recibido")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> recibir(@PathVariable UUID id, @RequestBody(required = false) RecibirRequest r) {
        return finanzas.recibir(id, r == null ? null : r.monto(), r == null ? null : mes(r.mes())).map(MovimientoResponse::de);
    }

    /** "Recibi" una linea de ingreso de la opcion principal del mes en curso (design D8 de diezmo-como-gasto). */
    @PostMapping("/api/planes/{id}/escenarios/{escenarioId}/ingresos/{ingresoId}/recibido")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> recibirLinea(@PathVariable UUID id, @PathVariable UUID escenarioId, @PathVariable UUID ingresoId,
                                                 @RequestBody(required = false) RecibirRequest r) {
        return finanzas.recibirLinea(id, escenarioId, ingresoId, r == null ? null : r.monto()).map(MovimientoResponse::de);
    }

    @PostMapping("/api/pagos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> pagar(@RequestBody PagoRequest r) {
        OrigenDto o = origen(r.origen());
        return finanzas.pagar(r.itemId(), r.monto(), r.usuarioId(), o.tipo(), o.cuentaId(), mes(r.mes())).map(MovimientoResponse::de);
    }

    @PostMapping("/api/gastos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> gastar(@RequestBody GastoRequest r) {
        OrigenDto o = origen(r.origen());
        return finanzas.gastar(r.itemId(), r.monto(), r.nota(), r.usuarioId(), o.tipo(), o.cuentaId(), mes(r.mes()))
                .map(MovimientoResponse::de);
    }

    @PostMapping("/api/aportes")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> aportar(@RequestBody AporteRequest r) {
        return finanzas.aportar(r.usuarioId(), r.monto(), mes(r.mes()), r.cuentaId(), r.aplicaDiezmo()).map(MovimientoResponse::de);
    }

    /** Corregir un registro (design D3 de usabilidad-plan): los campos que no vienen no cambian. */
    @PatchMapping("/api/registros/{id}")
    public Mono<MovimientoResponse> corregirRegistro(@PathVariable UUID id, @RequestBody CorregirRequest r) {
        OrigenDto o = r.origen();
        return finanzas.corregirRegistro(id, r.monto(), o == null ? null : o.tipo(), o == null ? null : o.cuentaId(), r.nota())
                .map(MovimientoResponse::de);
    }

    @DeleteMapping("/api/registros/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> borrarRegistro(@PathVariable UUID id) {
        return finanzas.borrarRegistro(id);
    }

    /** "Empezar de nuevo" (design D4 de usabilidad-plan). */
    @PostMapping("/api/hogar/empezar-de-nuevo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> empezarDeNuevo() {
        return finanzas.empezarDeNuevo();
    }

    private static YearMonth mes(MesResponse m) {
        return m == null ? null : YearMonth.of(m.anio(), m.mes());
    }

    private static OrigenDto origen(OrigenDto o) {
        return o == null ? new OrigenDto("NINGUNO", null) : o;
    }

    @PostMapping("/api/cuentas")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CuentaResponse> crearCuenta(@Valid @RequestBody CuentaRequest r) {
        return finanzas.crearCuenta(r.nombre(), r.titular() == CuentaRequest.Titular.CONJUNTA, r.saldo())
                .map(CuentaResponse::de);
    }
}
