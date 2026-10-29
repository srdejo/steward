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
import co.com.srdejo.steward.application.dto.PlanDtos.OpcionNuevaResponse;
import co.com.srdejo.steward.application.dto.PlanDtos.ProbarAbonoRequest;
import co.com.srdejo.steward.domain.api.ICuentasServicePort;
import co.com.srdejo.steward.domain.api.IPlanServicePort;
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
    private final IPlanServicePort plan;

    public CuentasController(ICuentasServicePort cuentas, IPlanServicePort plan) {
        this.cuentas = cuentas;
        this.plan = plan;
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

    /** "Probarlo como opcion de {mes}" (design D2 de backend-opciones-mes): una opcion nueva del mes con el abono extra. */
    @PostMapping("/api/creditos/{id}/probar")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<OpcionNuevaResponse> probar(@PathVariable UUID id, @RequestBody ProbarAbonoRequest r) {
        return Mono.fromCallable(() -> {
                    if (r.mes() < 1 || r.mes() > 12) {
                        throw co.com.srdejo.steward.domain.exception.DomainException.datosInvalidos("El mes va de 1 a 12");
                    }
                    return java.time.YearMonth.of(r.anio(), r.mes());
                })
                .flatMap(ref -> plan.probarAbono(id, ref, r.abono()))
                .map(o -> new OpcionNuevaResponse(o.planId(), o.escenarioId()));
    }

    @PostMapping("/api/creditos/{id}/abonos")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<MovimientoResponse> abonar(@PathVariable UUID id, @RequestBody AbonoRequest r) {
        OrigenDto o = r.origen() == null ? new OrigenDto("NINGUNO", null) : r.origen();
        return cuentas.abonar(id, r.monto(), r.usuarioId(), o.tipo(), o.cuentaId()).map(MovimientoResponse::de);
    }
}
