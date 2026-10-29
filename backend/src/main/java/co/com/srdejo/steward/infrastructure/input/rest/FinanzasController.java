package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.FinanzasDtos.AporteRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CuentaRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CuentaResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.DiezmoEnHoyRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.EntregaRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.FinanzasResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.GastoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.IngresoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.IngresoResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.MovimientoResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.ObligacionResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.OrigenDto;
import co.com.srdejo.steward.application.dto.FinanzasDtos.PagoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.ReglaRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.ReglaResponse;
import co.com.srdejo.steward.domain.api.IFinanzasServicePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
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

    @PostMapping("/api/ingresos-fijos/{id}/recibido")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> recibir(@PathVariable UUID id) {
        return finanzas.recibir(id).map(MovimientoResponse::de);
    }

    @GetMapping("/api/diezmo/pendientes")
    public Flux<ObligacionResponse> pendientes() {
        return finanzas.pendientes().map(ObligacionResponse::de);
    }

    @PostMapping("/api/diezmo/entregas")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> entregar(@RequestBody EntregaRequest r) {
        return finanzas.entregar(r.obligaciones(), r.cuentaId()).map(MovimientoResponse::de);
    }

    @PutMapping("/api/hogar/diezmo-en-hoy")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> definirDiezmoEnHoy(@RequestBody DiezmoEnHoyRequest r) {
        return finanzas.definirDiezmoEnHoy(r.modo());
    }

    @PostMapping("/api/pagos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> pagar(@RequestBody PagoRequest r) {
        OrigenDto o = origen(r.origen());
        return finanzas.pagar(r.itemId(), r.monto(), r.usuarioId(), o.tipo(), o.cuentaId()).map(MovimientoResponse::de);
    }

    @PostMapping("/api/gastos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> gastar(@RequestBody GastoRequest r) {
        OrigenDto o = origen(r.origen());
        return finanzas.gastar(r.itemId(), r.monto(), r.nota(), r.usuarioId(), o.tipo(), o.cuentaId())
                .map(MovimientoResponse::de);
    }

    @PostMapping("/api/aportes")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> aportar(@RequestBody AporteRequest r) {
        YearMonth mes = r.mes() == null ? null : YearMonth.of(r.mes().anio(), r.mes().mes());
        return finanzas.aportar(r.usuarioId(), r.monto(), mes, r.cuentaId(), r.aplicaDiezmo()).map(MovimientoResponse::de);
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
