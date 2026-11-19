package co.com.srdejo.steward.infrastructure.out.r2dbc;

import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.PreferenciasAviso;
import co.com.srdejo.steward.domain.spi.IAvisoPersistencePort;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/** Dispositivos, configuracion y avisos enviados con SQL explicito (V18, avisos-pagos). */
public class AvisoR2dbcAdapter implements IAvisoPersistencePort {

    private final DatabaseClient db;

    public AvisoR2dbcAdapter(DatabaseClient db) {
        this.db = db;
    }

    @Override
    public Mono<Void> guardarDispositivo(DispositivoAviso d) {
        var spec = db.sql("INSERT INTO dispositivo_aviso (id, usuario_id, tipo, token, p256dh, auth) VALUES (:id, :usuario, :tipo, :token, :p256dh, :auth) "
                        + "ON CONFLICT (token) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, tipo = EXCLUDED.tipo, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth")
                .bind("id", d.id())
                .bind("usuario", d.usuarioId())
                .bind("tipo", d.tipo().name())
                .bind("token", d.token());
        spec = Sql.opcional(spec, "p256dh", d.p256dh(), String.class);
        spec = Sql.opcional(spec, "auth", d.auth(), String.class);
        return spec.then();
    }

    @Override
    public Mono<Void> quitarDispositivo(UUID usuarioId, String token) {
        return db.sql("DELETE FROM dispositivo_aviso WHERE usuario_id = :usuario AND token = :token")
                .bind("usuario", usuarioId).bind("token", token).then();
    }

    @Override
    public Mono<Void> quitarToken(String token) {
        return db.sql("DELETE FROM dispositivo_aviso WHERE token = :token").bind("token", token).then();
    }

    @Override
    public Flux<DispositivoAviso> dispositivos(UUID usuarioId) {
        return db.sql("SELECT id, usuario_id, tipo, token, p256dh, auth FROM dispositivo_aviso WHERE usuario_id = :usuario ORDER BY creado_en")
                .bind("usuario", usuarioId)
                .map(r -> new DispositivoAviso(r.get("id", UUID.class), r.get("usuario_id", UUID.class),
                        DispositivoAviso.Tipo.valueOf(r.get("tipo", String.class)), r.get("token", String.class),
                        r.get("p256dh", String.class), r.get("auth", String.class)))
                .all();
    }

    @Override
    public Mono<PreferenciasAviso> preferencias(UUID usuarioId) {
        return db.sql("SELECT tipos_apagados, correo, no_molestar FROM preferencia_aviso WHERE usuario_id = :usuario")
                .bind("usuario", usuarioId)
                .map(r -> new PreferenciasAviso(Set.of(r.get("tipos_apagados", String[].class)),
                        Boolean.TRUE.equals(r.get("correo", Boolean.class)), Boolean.TRUE.equals(r.get("no_molestar", Boolean.class))))
                .one()
                .defaultIfEmpty(PreferenciasAviso.DEFECTO);
    }

    @Override
    public Mono<Void> guardarPreferencias(UUID usuarioId, PreferenciasAviso p) {
        return db.sql("INSERT INTO preferencia_aviso (usuario_id, tipos_apagados, correo, no_molestar) VALUES (:usuario, :tipos, :correo, :noMolestar) "
                        + "ON CONFLICT (usuario_id) DO UPDATE SET tipos_apagados = EXCLUDED.tipos_apagados, correo = EXCLUDED.correo, no_molestar = EXCLUDED.no_molestar")
                .bind("usuario", usuarioId)
                .bind("tipos", p.tiposApagados().stream().sorted().toArray(String[]::new))
                .bind("correo", p.correo())
                .bind("noMolestar", p.noMolestar())
                .then();
    }

    @Override
    public Mono<Boolean> reservar(UUID usuarioId, String clave, String momento, LocalDate fecha) {
        return db.sql("INSERT INTO aviso_enviado (id, usuario_id, clave, momento, fecha, enviado_en) VALUES (:id, :usuario, :clave, :momento, :fecha, now()) "
                        + "ON CONFLICT (usuario_id, clave, momento, fecha) DO NOTHING")
                .bind("id", UUID.randomUUID())
                .bind("usuario", usuarioId)
                .bind("clave", clave)
                .bind("momento", momento)
                .bind("fecha", fecha)
                .fetch().rowsUpdated().map(n -> n > 0);
    }

    @Override
    public Mono<Void> posponer(UUID usuarioId, String clave, LocalDate fecha) {
        return db.sql("INSERT INTO aviso_enviado (id, usuario_id, clave, momento, fecha) VALUES (:id, :usuario, :clave, 'POSPUESTO', :fecha) "
                        + "ON CONFLICT (usuario_id, clave, momento, fecha) DO NOTHING")
                .bind("id", UUID.randomUUID())
                .bind("usuario", usuarioId)
                .bind("clave", clave)
                .bind("fecha", fecha)
                .then();
    }

    @Override
    public Flux<String> pospuestos(UUID usuarioId, LocalDate hasta) {
        return db.sql("SELECT DISTINCT clave FROM aviso_enviado WHERE usuario_id = :usuario AND momento = 'POSPUESTO' AND enviado_en IS NULL AND fecha <= :hasta")
                .bind("usuario", usuarioId)
                .bind("hasta", hasta)
                .map(r -> r.get("clave", String.class))
                .all();
    }

    @Override
    public Mono<Void> marcarPospuestoEnviado(UUID usuarioId, String clave, LocalDate hasta) {
        return db.sql("UPDATE aviso_enviado SET enviado_en = now() WHERE usuario_id = :usuario AND clave = :clave AND momento = 'POSPUESTO' "
                        + "AND enviado_en IS NULL AND fecha <= :hasta")
                .bind("usuario", usuarioId).bind("clave", clave).bind("hasta", hasta).then();
    }
}
