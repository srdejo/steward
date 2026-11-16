package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.Amortizacion;
import co.com.srdejo.steward.domain.model.Credito;
import co.com.srdejo.steward.domain.spi.ICreditoPersistencePort;
import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Creditos con SQL explicito. Abonar y pagar la cuota cambian el saldo en la misma sentencia que lo leen (design D4 de
 * backend-cuentas-creditos): dos registros a la vez no lo dejan por debajo de cero.
 */
public class CreditoR2dbcAdapter implements ICreditoPersistencePort {

    private static final String COLUMNAS = "id, hogar_id, nombre, entidad, saldo, saldo_actualizado_en, cuota, tasa_em, "
            + "dia_pago, total_original, metodo, numero_cuotas, cuotas_pagadas, valor_financiado";

    private final DatabaseClient db;

    public CreditoR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Credito> crear(Credito c) {
        DatabaseClient.GenericExecuteSpec spec = db.sql("INSERT INTO credito (" + COLUMNAS + ") VALUES (:id, :hogar, :nombre, "
                        + ":entidad, :saldo, :fecha, :cuota, :tasa, :dia, :total, :metodo, :numero, :pagadas, :valor)")
                .bind("metodo", c.metodo().name())
                .bind("pagadas", (short) c.cuotasPagadas());
        spec = Sql.opcional(spec, "numero", c.numeroCuotas() == null ? null : c.numeroCuotas().shortValue(), Short.class);
        spec = Sql.opcional(spec, "valor", c.valorFinanciado(), Long.class);
        return spec
                .bind("id", c.id())
                .bind("hogar", c.hogarId())
                .bind("nombre", c.nombre())
                .bind("entidad", c.entidad())
                .bind("saldo", c.saldo())
                .bind("fecha", c.saldoActualizadoEn())
                .bind("cuota", c.cuota())
                .bind("tasa", c.tasaEm())
                .bind("dia", (short) c.diaPago())
                .bind("total", c.totalOriginal())
                .then()
                .thenReturn(c);
    }

    @Override
    public Mono<Credito> porIdEnHogar(UUID id, UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM credito WHERE id = :id AND hogar_id = :hogar")
                .bind("id", id)
                .bind("hogar", hogarId)
                .map(CreditoR2dbcAdapter::credito)
                .one();
    }

    @Override
    public Flux<Credito> delHogar(UUID hogarId) {
        return db.sql("SELECT " + COLUMNAS + " FROM credito WHERE hogar_id = :hogar ORDER BY creado_en, id")
                .bind("hogar", hogarId)
                .map(CreditoR2dbcAdapter::credito)
                .all();
    }

    @Override
    public Mono<Void> actualizarSaldo(UUID id, long saldo, LocalDate fecha) {
        return db.sql("UPDATE credito SET saldo = :saldo, saldo_actualizado_en = :fecha WHERE id = :id")
                .bind("id", id)
                .bind("saldo", saldo)
                .bind("fecha", fecha)
                .then();
    }

    @Override
    public Mono<Credito> abonar(UUID id, long monto, LocalDate fecha) {
        return db.sql("UPDATE credito SET saldo = saldo - :monto, saldo_actualizado_en = :fecha "
                        + "WHERE id = :id AND saldo >= :monto RETURNING " + COLUMNAS)
                .bind("id", id)
                .bind("monto", monto)
                .bind("fecha", fecha)
                .map(CreditoR2dbcAdapter::credito)
                .one();
    }

    @Override
    public Mono<Long> pagarCuota(UUID id, long monto) {
        // Como aplicarCuota del dominio, segun el metodo (design D3 de tarjetas-y-creditos). La fila se bloquea mientras se
        // calcula: dos pagos a la vez no la dejan mal. La fecha del saldo no cambia. Devuelve cuanto bajo el saldo.
        return db.sql("SELECT " + COLUMNAS + " FROM credito WHERE id = :id FOR UPDATE")
                .bind("id", id)
                .map(CreditoR2dbcAdapter::credito)
                .one()
                .flatMap(c -> {
                    Amortizacion.Pagado p = Amortizacion.pagarCuota(c, monto);
                    return db.sql("UPDATE credito SET saldo = :saldo, cuotas_pagadas = :pagadas WHERE id = :id")
                            .bind("id", id)
                            .bind("saldo", p.saldo())
                            .bind("pagadas", (short) p.cuotasPagadas())
                            .then()
                            .thenReturn(p.capital());
                });
    }

    @Override
    public Mono<Void> devolver(UUID id, long capital, boolean cuota) {
        // Una cuota borrada tambien descuenta la cuota pagada (salvo a mano, que no las cuenta).
        return db.sql("UPDATE credito SET saldo = saldo + :capital, cuotas_pagadas = CASE WHEN :cuota AND metodo <> 'MANUAL' "
                        + "THEN greatest(0, cuotas_pagadas - 1) ELSE cuotas_pagadas END WHERE id = :id")
                .bind("id", id)
                .bind("capital", capital)
                .bind("cuota", cuota)
                .then();
    }

    @Override
    public Mono<Credito> cambiarMetodo(Credito c) {
        DatabaseClient.GenericExecuteSpec spec = db.sql("UPDATE credito SET metodo = :metodo, saldo = :saldo, cuota = :cuota, "
                        + "tasa_em = :tasa, numero_cuotas = :numero, cuotas_pagadas = :pagadas, valor_financiado = :valor, "
                        + "total_original = :total, saldo_actualizado_en = :fecha WHERE id = :id")
                .bind("id", c.id())
                .bind("metodo", c.metodo().name())
                .bind("saldo", c.saldo())
                .bind("cuota", c.cuota())
                .bind("tasa", c.tasaEm())
                .bind("pagadas", (short) c.cuotasPagadas())
                .bind("total", c.totalOriginal())
                .bind("fecha", c.saldoActualizadoEn());
        spec = Sql.opcional(spec, "numero", c.numeroCuotas() == null ? null : c.numeroCuotas().shortValue(), Short.class);
        spec = Sql.opcional(spec, "valor", c.valorFinanciado(), Long.class);
        return spec.then().thenReturn(c);
    }

    private static Credito credito(Readable row) {
        Short numero = row.get("numero_cuotas", Short.class);
        return new Credito(row.get("id", UUID.class), row.get("hogar_id", UUID.class), row.get("nombre", String.class),
                row.get("entidad", String.class), row.get("saldo", Long.class),
                row.get("saldo_actualizado_en", LocalDate.class), row.get("cuota", Long.class),
                row.get("tasa_em", BigDecimal.class), row.get("dia_pago", Short.class), row.get("total_original", Long.class),
                List.of(), Credito.Metodo.valueOf(row.get("metodo", String.class)), numero == null ? null : numero.intValue(),
                row.get("cuotas_pagadas", Short.class), row.get("valor_financiado", Long.class));
    }
}
