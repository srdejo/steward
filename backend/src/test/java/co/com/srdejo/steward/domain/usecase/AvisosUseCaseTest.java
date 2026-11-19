package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.model.Cuenta;
import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.FilaResumenAviso;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.Hogar;
import co.com.srdejo.steward.domain.model.MensajeAviso;
import co.com.srdejo.steward.domain.model.Miembro;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PlanMes.Escenario;
import co.com.srdejo.steward.domain.model.PlanMes.ItemPlan;
import co.com.srdejo.steward.domain.model.PreferenciasAviso;
import co.com.srdejo.steward.domain.model.Usuario;
import co.com.srdejo.steward.domain.spi.IAvisoPersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.IEnvioPushPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IMailPort;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.lang.reflect.Proxy;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Spec steward-avisos, "Cuándo se avisa", "Resumen por correo" y "Lo que marca el otro miembro" (avisos-pagos). */
class AvisosUseCaseTest {

    static final ZoneId BOGOTA = ZoneId.of("America/Bogota");
    static final UUID HOGAR = UUID.randomUUID();
    static final UUID DANIEL = UUID.randomUUID();
    static final UUID ESPOSA = UUID.randomUUID();
    static final YearMonth OCT = YearMonth.of(2026, 10);
    static final YearMonth NOV = YearMonth.of(2026, 11);
    final UUID master = UUID.randomUUID();
    final UUID luzId = UUID.randomUUID();
    final UUID esc = UUID.randomUUID();
    final UUID escNov = UUID.randomUUID();

    /** Un reloj que se mueve en las pruebas. */
    static final class Reloj implements IClockPort {
        LocalDateTime ahora;

        public Instant ahora() {
            return ahora.atZone(BOGOTA).toInstant();
        }

        public LocalDate hoy() {
            return ahora.toLocalDate();
        }
    }

    /** aviso_enviado, preferencias y dispositivos en memoria. */
    static final class Memoria implements IAvisoPersistencePort {
        final Set<String> enviados = new HashSet<>();
        final Map<String, LocalDate> pospuestos = new HashMap<>();
        final Map<UUID, PreferenciasAviso> prefs = new HashMap<>();

        public Mono<Void> guardarDispositivo(DispositivoAviso d) { return Mono.empty(); }
        public Mono<Void> quitarDispositivo(UUID u, String t) { return Mono.empty(); }
        public Mono<Void> quitarToken(String t) { return Mono.empty(); }
        public Flux<DispositivoAviso> dispositivos(UUID u) {
            return Flux.just(new DispositivoAviso(UUID.randomUUID(), u, DispositivoAviso.Tipo.EXPO, "ExponentPushToken[" + u + "]", null, null));
        }
        public Mono<PreferenciasAviso> preferencias(UUID u) { return Mono.just(prefs.getOrDefault(u, PreferenciasAviso.DEFECTO)); }
        public Mono<Void> guardarPreferencias(UUID u, PreferenciasAviso p) { prefs.put(u, p); return Mono.empty(); }
        public Mono<Boolean> reservar(UUID u, String clave, String momento, LocalDate fecha) {
            return Mono.just(enviados.add(u + "|" + clave + "|" + momento + "|" + fecha));
        }
        public Mono<Void> posponer(UUID u, String clave, LocalDate fecha) { pospuestos.put(u + "|" + clave, fecha); return Mono.empty(); }
        public Flux<String> pospuestos(UUID u, LocalDate hasta) {
            return Flux.fromIterable(pospuestos.entrySet()).filter(e -> e.getKey().startsWith(u + "|") && !e.getValue().isAfter(hasta))
                    .map(e -> e.getKey().substring(e.getKey().indexOf('|') + 1));
        }
        public Mono<Void> marcarPospuestoEnviado(UUID u, String clave, LocalDate hasta) { pospuestos.remove(u + "|" + clave); return Mono.empty(); }
    }

    final Reloj reloj = new Reloj();
    final Memoria memoria = new Memoria();
    final List<String> push = new ArrayList<>();
    final List<String> correos = new ArrayList<>();
    final List<Movimiento> movimientos = new ArrayList<>();

    @SuppressWarnings("unchecked")
    private static <T> T sinUso(Class<T> tipo) {
        return (T) Proxy.newProxyInstance(tipo.getClassLoader(), new Class<?>[]{tipo}, (p, m, a) -> {
            throw new UnsupportedOperationException(m.getName());
        });
    }

    private Finanzas finanzas() {
 List<ItemPlan> items = List.of(
                new ItemPlan(master, esc, UUID.randomUUID(), "Tarjeta Mastercard", 1_500_000, 30, ItemPlan.Tipo.CREDITO, null, null, 0, null, null, null, null, false, null),
                new ItemPlan(luzId, esc, UUID.randomUUID(), "Recibo Luz", 38_000, 20, ItemPlan.Tipo.FIJO, null, null, 1));
 List<ItemPlan> nov = List.of(
                new ItemPlan(UUID.randomUUID(), escNov, UUID.randomUUID(), "Pensión", 550_000, 5, ItemPlan.Tipo.FIJO, null, null, 0),
                new ItemPlan(UUID.randomUUID(), escNov, UUID.randomUUID(), "Visa · Gasolina", 800_000, 6, ItemPlan.Tipo.FIJO, null, null, 1),
                new ItemPlan(UUID.randomUUID(), escNov, UUID.randomUUID(), "Celular", 50_000, 8, ItemPlan.Tipo.FIJO, null, null, 2));
        List<PlanMes> planes = List.of(
                new PlanMes(UUID.randomUUID(), HOGAR, OCT, PlanMes.Estado.ACTIVO, esc, List.of(new Escenario(esc, UUID.randomUUID(), "A", DANIEL, "", false, List.of(), items))),
                new PlanMes(UUID.randomUUID(), HOGAR, NOV, PlanMes.Estado.ACTIVO, escNov, List.of(new Escenario(escNov, UUID.randomUUID(), "A", DANIEL, "", false, List.of(), nov))));
        return new Finanzas(OCT, List.of(), List.of(), List.of(), List.<Cuenta>of(), planes, List.copyOf(movimientos), List.of(), List.of(), List.of(), List.of(), List.of());
    }

    private AvisosUseCase uso() {
        FinanzasUseCase finanzas = new FinanzasUseCase(null, null, null, null, null, null, null, null, null, null, null, null, null, reloj, null) {
            @Override
            public Mono<Finanzas> leerHogar(UUID hogarId) {
                return Mono.just(finanzas());
            }
        };
        IHogarPersistencePort hogares = (IHogarPersistencePort) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{IHogarPersistencePort.class}, (p, m, a) -> switch (m.getName()) {
            case "todos" -> Flux.just(HOGAR);
            case "miembros" -> Flux.just(new Miembro(new Usuario(DANIEL, "daniel@ejemplo.com", "Daniel", Instant.now()), LocalDate.of(2026, 1, 1)),
                    new Miembro(new Usuario(ESPOSA, "esposa@ejemplo.com", "Esposa", Instant.now()), LocalDate.of(2026, 1, 2)));
            case "porId" -> Mono.just(new Hogar(HOGAR, "Nuestra casa", true));
            default -> throw new UnsupportedOperationException(m.getName());
        });
        IEnvioPushPort envio = new IEnvioPushPort() {
            public Mono<Boolean> enviar(DispositivoAviso d, MensajeAviso m) {
                push.add((d.usuarioId().equals(DANIEL) ? "D" : "E") + " " + m.titulo() + " | " + m.cuerpo() + (m.categoria() == null ? "" : " [" + m.categoria() + "]"));
                return Mono.just(false);
            }
            public String clavePublicaWeb() { return null; }
        };
        IMailPort mail = new IMailPort() {
            public Mono<Void> enviarInvitacion(String para, String q, String h, String e) { return Mono.empty(); }
            public Mono<Void> enviarResumenAvisos(String para, String nombre, List<FilaResumenAviso> filas, long total, String enlace) {
                correos.add(para + " " + filas.size() + " " + total);
                return Mono.empty();
            }
        };
        return new AvisosUseCase(hogares, memoria, finanzas, envio, mail, sinUso(co.com.srdejo.steward.domain.spi.ICurrentUserPort.class),
                new co.com.srdejo.steward.domain.spi.IComoUsuarioPort() {
                    public <T> Mono<T> como(UUID u, Mono<T> a) { return a; }
                }, reloj, new FirmaAviso("secreto-de-prueba-0123456789"), "America/Bogota", "https://steward.test");
    }

    @Test
    void elLunesUnSoloAvisoConLaSemana() {
        reloj.ahora = LocalDateTime.of(2026, 11, 2, 8, 0);
        uso().correr().block();
        assertEquals(List.of("D Esta semana: 3 pagos · $1.400.000 | Pensión, Visa · Gasolina, Celular",
                "E Esta semana: 3 pagos · $1.400.000 | Pensión, Visa · Gasolina, Celular"), push);
        // Y el resumen por correo de los dos.
        assertEquals(List.of("daniel@ejemplo.com 3 1400000", "esposa@ejemplo.com 3 1400000"), correos);
    }

    @Test
    void elDiaAnteriorYElMismoDiaConSusAccionesYSinRepetir() {
        reloj.ahora = LocalDateTime.of(2026, 10, 29, 8, 0);
        AvisosUseCase uso = uso();
        uso.correr().block();
        assertEquals(List.of("D Mastercard | Mañana · 1.500.000".replace("· 1", "· $1"), "E Mastercard | Mañana · $1.500.000")
                .stream().map(s -> s + " [pago]").toList(), push);
        // Otra corrida el mismo dia no repite.
        uso.correr().block();
        assertEquals(2, push.size());
        // Antes de las 8:00 no sale nada.
        push.clear();
        reloj.ahora = LocalDateTime.of(2026, 10, 30, 7, 45);
        uso.correr().block();
        assertTrue(push.isEmpty());
        reloj.ahora = LocalDateTime.of(2026, 10, 30, 8, 0);
        uso.correr().block();
        assertEquals(List.of("D Mastercard | Hoy · $1.500.000 · También: Cerrar octubre [pago]", "E Mastercard | Hoy · $1.500.000 · También: Cerrar octubre [pago]"), push);
        // Al dia siguiente, vencida, no hay push.
        push.clear();
        reloj.ahora = LocalDateTime.of(2026, 10, 31, 8, 0);
        uso.correr().block();
        assertTrue(push.stream().noneMatch(p -> p.contains("Mastercard")));
    }

    @Test
    void yaPagadoNoSeAvisa() {
        movimientos.add(new Movimiento(UUID.randomUUID(), HOGAR, Movimiento.Tipo.PAGO, OCT, 1_500_000, LocalDate.of(2026, 10, 29), DANIEL, DANIEL,
                null, null, null, false, List.of(), master, "", Movimiento.Origen.NINGUNO, null, null, null, null, 1));
        reloj.ahora = LocalDateTime.of(2026, 10, 30, 8, 0);
        uso().correr().block();
        assertTrue(push.stream().noneMatch(p -> p.contains("Mastercard")));
    }

    @Test
    void recordarManianaSoloParaQuienLoPide() {
        reloj.ahora = LocalDateTime.of(2026, 10, 26, 9, 0);
        memoria.posponer(DANIEL, "CUOTA:" + master + ":2026-10", LocalDate.of(2026, 10, 27)).block();
        reloj.ahora = LocalDateTime.of(2026, 10, 27, 8, 0);
        uso().correr().block();
        assertEquals(List.of("D Mastercard | En 3 días · 1500000"), push.stream().map(p -> p.replace("$1.500.000", "1500000").replace(" [pago]", "")).toList());
    }

    @Test
    void loQueMarcaElOtroYSuNoMolestar() {
        AvisosUseCase uso = uso();
        Movimiento luz = new Movimiento(UUID.randomUUID(), HOGAR, Movimiento.Tipo.PAGO, OCT, 38_000, LocalDate.of(2026, 10, 26), ESPOSA, ESPOSA,
                null, null, null, false, List.of(), luzId, "", Movimiento.Origen.EXTERNA,
                null, null, null, null, 2);
        reloj.ahora = LocalDateTime.of(2026, 10, 26, 15, 0);
        movimientos.add(luz);
        uso.registrado(luz);
        esperar(() -> push.size() == 1);
        assertEquals(List.of("D Esposa pagó Recibo Luz | $38.000 desde su cuenta · cuenta como aporte"), push);
        // A las 10:00 p. m. espera a las 7:00 a. m.
        push.clear();
        Movimiento aporte = new Movimiento(UUID.randomUUID(), HOGAR, Movimiento.Tipo.APORTE, OCT, 500_000, LocalDate.of(2026, 10, 26), ESPOSA, ESPOSA,
                null, null, null, false, List.of(), null, "", Movimiento.Origen.NINGUNO, null, null, null, null, 3);
        reloj.ahora = LocalDateTime.of(2026, 10, 26, 22, 0);
        movimientos.add(aporte);
        uso.registrado(aporte);
        esperar(() -> !memoria.pospuestos.isEmpty());
        assertTrue(push.isEmpty());
        reloj.ahora = LocalDateTime.of(2026, 10, 27, 7, 0);
        uso.correr().block();
        assertTrue(push.contains("D Esposa registró un aporte | $500.000"), push.toString());
    }

    private static void esperar(java.util.function.BooleanSupplier listo) {
        long fin = System.currentTimeMillis() + 3000;
        while (!listo.getAsBoolean() && System.currentTimeMillis() < fin) {
            Thread.onSpinWait();
        }
    }
}
