package co.com.srdejo.steward.infrastructure.input.rest;

import co.com.srdejo.steward.application.dto.FinanzasDtos.AbonoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CreditoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CreditoResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CuadreRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.CuentaResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.MovimientoResponse;
import co.com.srdejo.steward.application.dto.FinanzasDtos.OrigenDto;
import co.com.srdejo.steward.application.dto.FinanzasDtos.SaldoCreditoRequest;
import co.com.srdejo.steward.application.dto.FinanzasDtos.TransferenciaRequest;
import co.com.srdejo.steward.domain.api.ICuentasServicePort;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Cuadre, mover dinero y creditos (spec steward-finanzas, design D6 de backend-cuentas-creditos). El hogar sale de la
 * sesion, nunca de la URL.
 */
@RestController
public class CuentasController {

    private final ICuentasServicePort cuentas;

    public CuentasController(ICuentasServicePort cuentas) {
        this.cuentas = cuentas;
    }

    @PostMapping("/api/cuentas/cuadre")
    public Flux<CuentaResponse> cuadrar(@RequestBody CuadreRequest r) {
        return cuentas.cuadrar(r.datos()).flatMapMany(Flux::fromIterable).map(CuentaResponse::de);
    }

    @PostMapping("/api/transferencias")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> transferir(@RequestBody TransferenciaRequest r) {
        return cuentas.transferir(r.desde(), r.hacia(), r.monto()).map(MovimientoResponse::de);
    }

    @PostMapping("/api/creditos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CreditoResponse> crearCredito(@Valid @RequestBody CreditoRequest r) {
        return cuentas.crearCredito(r.datos()).map(CreditoResponse::de);
    }

    @PutMapping("/api/creditos/{id}/saldo")
    public Mono<CreditoResponse> actualizarSaldo(@PathVariable UUID id, @RequestBody SaldoCreditoRequest r) {
        return cuentas.actualizarSaldo(id, r.saldo()).map(CreditoResponse::de);
    }

    @PostMapping("/api/creditos/{id}/abonos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> abonar(@PathVariable UUID id, @RequestBody AbonoRequest r) {
        OrigenDto o = r.origen() == null ? new OrigenDto("NINGUNO", null) : r.origen();
        return cuentas.abonar(id, r.monto(), r.usuarioId(), o.tipo(), o.cuentaId()).map(MovimientoResponse::de);
    }
}
