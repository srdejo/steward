package co.com.srdejo.steward.domain.spi;

import co.com.srdejo.steward.domain.model.Movimiento;

/** Se llama al registrarse un pago o un aporte, para avisar al otro miembro (design D7 de avisos-pagos). */
public interface IActividadPort {

    IActividadPort NINGUNA = m -> { };

    void registrado(Movimiento movimiento);
}
